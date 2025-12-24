import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Lock, RefreshCw, Loader2, Eye, CheckCircle2, AlertCircle, 
  Clock, FileText, AlertTriangle, Unlock, X
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import ModernKPI from "@/components/dashboard/ModernKPI";
import { createNotification, createAuditLog } from "@/components/utils/emailTemplateHelper";

export default function CloseBatch() {
  const [user, setUser] = useState(null);
  const [batches, setBatches] = useState([]);
  const [debtors, setDebtors] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showReopenRequestDialog, setShowReopenRequestDialog] = useState(false);
  const [showReopenApprovalDialog, setShowReopenApprovalDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [closeRemarks, setCloseRemarks] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [reopenImpact, setReopenImpact] = useState('Data');
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [filters, setFilters] = useState({
    contract: 'all',
    status: 'all'
  });

  const isTugure = user?.role === 'TUGURE' || user?.role === 'admin';
  const isSupervisor = user?.role === 'admin';

  useEffect(() => {
    loadUser();
    loadData();
  }, []);

  const loadUser = async () => {
    try {
      const demoUserStr = localStorage.getItem('demo_user');
      if (demoUserStr) {
        setUser(JSON.parse(demoUserStr));
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [batchData, debtorData, contractData] = await Promise.all([
        base44.entities.Batch.list(),
        base44.entities.Debtor.list(),
        base44.entities.Contract.list()
      ]);
      setBatches(batchData || []);
      setDebtors(debtorData || []);
      setContracts(contractData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  const handleCloseBatch = async () => {
    if (!selectedBatch) return;

    // VALIDATION: Check prerequisites
    const batchDebtors = debtors.filter(d => d.batch_id === selectedBatch.batch_id);
    const pendingReview = batchDebtors.filter(d => 
      d.underwriting_status !== 'APPROVED' && 
      d.underwriting_status !== 'REJECTED'
    );

    if (pendingReview.length > 0) {
      alert(`❌ BLOCKED: Cannot close batch.\n\n${pendingReview.length} debtor(s) pending review.\n\nAll debtors must be reviewed before closing batch.`);
      
      await createAuditLog(
        'BLOCKED_BATCH_CLOSE',
        'DEBTOR',
        'Batch',
        selectedBatch.id,
        {},
        { blocked_reason: 'Pending debtor review', pending_count: pendingReview.length },
        user?.email,
        user?.role,
        'Attempted to close batch with pending debtor review'
      );
      
      return;
    }

    setProcessing(true);
    try {
      await base44.entities.Batch.update(selectedBatch.id, {
        status: 'Closed',
        operational_locked: true,
        closed_by: user?.email,
        closed_date: new Date().toISOString().split('T')[0]
      });

      await createNotification(
        'Batch Closed - Operational Lock Active',
        `Batch ${selectedBatch.batch_id} is now CLOSED. Debtor revisions and document updates are BLOCKED. Financial operations (Nota, Reconciliation) remain active.`,
        'INFO',
        'DEBTOR',
        selectedBatch.id,
        'ALL'
      );

      await createAuditLog(
        'BATCH_CLOSED',
        'DEBTOR',
        'Batch',
        selectedBatch.id,
        { status: selectedBatch.status, operational_locked: false },
        { status: 'Closed', operational_locked: true },
        user?.email,
        user?.role,
        closeRemarks
      );

      setSuccessMessage('Batch closed successfully - operational lock enabled');
      setShowCloseDialog(false);
      setSelectedBatch(null);
      setCloseRemarks('');
      loadData();
    } catch (error) {
      console.error('Close batch error:', error);
    }
    setProcessing(false);
  };

  const handleRequestReopen = async () => {
    if (!selectedBatch || !reopenReason) return;

    setProcessing(true);
    try {
      await base44.entities.Batch.update(selectedBatch.id, {
        status: 'Reopen Requested',
        reopen_requested_by: user?.email,
        reopen_requested_date: new Date().toISOString(),
        reopen_reason: reopenReason,
        reopen_impact: reopenImpact
      });

      await createNotification(
        '⚠️ Batch Reopen Request - Approval Required',
        `Batch ${selectedBatch.batch_id} reopen requested by ${user?.email}. Impact: ${reopenImpact}. Reason: ${reopenReason}`,
        'ACTION_REQUIRED',
        'DEBTOR',
        selectedBatch.id,
        'ADMIN'
      );

      await createAuditLog(
        'BATCH_REOPEN_REQUESTED',
        'DEBTOR',
        'Batch',
        selectedBatch.id,
        { status: 'Closed' },
        { status: 'Reopen Requested', reopen_impact: reopenImpact },
        user?.email,
        user?.role,
        reopenReason
      );

      setSuccessMessage('Reopen request submitted - awaiting supervisor approval');
      setShowReopenRequestDialog(false);
      setSelectedBatch(null);
      setReopenReason('');
      loadData();
    } catch (error) {
      console.error('Reopen request error:', error);
    }
    setProcessing(false);
  };

  const handleApproveReopen = async (approve) => {
    if (!selectedBatch) return;

    setProcessing(true);
    try {
      if (approve) {
        await base44.entities.Batch.update(selectedBatch.id, {
          status: 'Reopened',
          operational_locked: false,
          reopen_approved_by: user?.email,
          reopen_approved_date: new Date().toISOString()
        });

        await createNotification(
          '✅ Batch Reopened - LIMITED MODE',
          `Batch ${selectedBatch.batch_id} reopened. ONLY rejected debtor revisions allowed. Financial operations remain active.`,
          'WARNING',
          'DEBTOR',
          selectedBatch.id,
          'ALL'
        );

        await createAuditLog(
          'BATCH_REOPEN_APPROVED',
          'DEBTOR',
          'Batch',
          selectedBatch.id,
          { status: 'Reopen Requested' },
          { status: 'Reopened', operational_locked: false },
          user?.email,
          user?.role,
          approvalRemarks
        );

        setSuccessMessage('Batch reopened - limited revision mode enabled');
      } else {
        await base44.entities.Batch.update(selectedBatch.id, {
          status: 'Closed',
          reopen_requested_by: null,
          reopen_requested_date: null,
          reopen_reason: null
        });

        await createNotification(
          'Batch Reopen Request Rejected',
          `Batch ${selectedBatch.batch_id} reopen request rejected. Batch remains closed.`,
          'INFO',
          'DEBTOR',
          selectedBatch.id,
          selectedBatch.reopen_requested_by
        );

        await createAuditLog(
          'BATCH_REOPEN_REJECTED',
          'DEBTOR',
          'Batch',
          selectedBatch.id,
          { status: 'Reopen Requested' },
          { status: 'Closed' },
          user?.email,
          user?.role,
          approvalRemarks
        );

        setSuccessMessage('Reopen request rejected - batch remains closed');
      }

      setShowReopenApprovalDialog(false);
      setSelectedBatch(null);
      setApprovalRemarks('');
      loadData();
    } catch (error) {
      console.error('Approve reopen error:', error);
    }
    setProcessing(false);
  };

  const filteredBatches = batches.filter(b => {
    if (filters.contract !== 'all' && b.contract_id !== filters.contract) return false;
    if (filters.status !== 'all' && b.status !== filters.status) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Close Batch - Operational Lock"
        subtitle="Lock batch for operational changes while keeping financial operations active"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Close Batch' }
        ]}
        actions={
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        }
      />

      {successMessage && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">{successMessage}</AlertDescription>
        </Alert>
      )}

      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-700">
          <strong>🔒 Batch Close - Operational Lock Only:</strong>
          <br/><br/>
          <strong>Prerequisites for Close:</strong><br/>
          • All debtors reviewed (approved or rejected)<br/>
          • No active debtor revisions<br/>
          <br/>
          <strong>When Closed - DISABLED:</strong><br/>
          • Revise Debtor<br/>
          • Reopen Debtor Review<br/>
          • Add/Update Eligibility Documents<br/>
          <br/>
          <strong>When Closed - ENABLED:</strong><br/>
          • Nota Management (if Nota exists)<br/>
          • Reconciliation<br/>
          • DN/CN Creation<br/>
          • Claim Operations (if Nota Paid)<br/>
          <br/>
          <strong>Reopen:</strong> SLA exception only - requires Supervisor/Admin approval
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <ModernKPI title="Eligible for Close" value={batches.filter(b => b.debtor_review_completed && !b.operational_locked && b.status !== 'Closed').length} subtitle="Review completed" icon={Lock} color="blue" />
        <ModernKPI title="Closed Batches" value={batches.filter(b => b.status === 'Closed').length} subtitle="Operationally locked" icon={Lock} color="green" />
        <ModernKPI title="Reopen Requests" value={batches.filter(b => b.status === 'Reopen Requested').length} subtitle="Awaiting approval" icon={Clock} color="orange" />
        <ModernKPI title="Reopened" value={batches.filter(b => b.status === 'Reopened').length} subtitle="Limited mode" icon={Unlock} color="purple" />
        <ModernKPI title="Active Batches" value={batches.filter(b => !b.operational_locked && b.status !== 'Closed' && b.status !== 'Rejected').length} subtitle="Open for changes" icon={FileText} color="teal" />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select value={filters.contract} onValueChange={(val) => setFilters({...filters, contract: val})}>
              <SelectTrigger><SelectValue placeholder="Contract" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Contracts</SelectItem>
                {contracts.map(c => (<SelectItem key={c.id} value={c.id}>{c.contract_number}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={filters.status} onValueChange={(val) => setFilters({...filters, status: val})}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Approved">Approved (Open)</SelectItem>
                <SelectItem value="Closed">Closed</SelectItem>
                <SelectItem value="Reopen Requested">Reopen Requested</SelectItem>
                <SelectItem value="Reopened">Reopened</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setFilters({contract: 'all', status: 'all'})}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={[
          {
            header: 'Batch ID',
            cell: (row) => (
              <div>
                <p className="font-medium font-mono">{row.batch_id}</p>
                <p className="text-xs text-gray-500">{row.batch_month}/{row.batch_year}</p>
              </div>
            )
          },
          {
            header: 'Review Status',
            cell: (row) => (
              <div className="space-y-1">
                {row.debtor_review_completed ? (
                  <Badge className="bg-green-100 text-green-700">✓ Review Complete</Badge>
                ) : (
                  <Badge className="bg-orange-100 text-orange-700">⏳ Pending Review</Badge>
                )}
                {row.batch_ready_for_nota && (
                  <Badge className="bg-blue-100 text-blue-700">✓ Ready for Nota</Badge>
                )}
              </div>
            )
          },
          {
            header: 'Lock Status',
            cell: (row) => (
              <div>
                {row.operational_locked ? (
                  <Badge className="bg-red-100 text-red-700">
                    <Lock className="w-3 h-3 mr-1" />
                    Locked
                  </Badge>
                ) : (
                  <Badge className="bg-green-100 text-green-700">
                    <Unlock className="w-3 h-3 mr-1" />
                    Open
                  </Badge>
                )}
              </div>
            )
          },
          { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
          {
            header: 'Final Premium',
            cell: (row) => (
              <div>
                <div className="font-bold text-green-600">Rp {((row.final_premium_amount || 0) / 1000000).toFixed(1)}M</div>
                {row.debtor_review_completed && (
                  <div className="text-xs text-gray-500">✓ Finalized</div>
                )}
              </div>
            )
          },
          {
            header: 'Actions',
            cell: (row) => (
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => { setSelectedBatch(row); setShowDetailDialog(true); }}>
                  <Eye className="w-4 h-4 mr-1" />
                  View
                </Button>
                
                {isTugure && row.debtor_review_completed && !row.operational_locked && row.status !== 'Closed' && row.status !== 'Rejected' && (
                  <Button size="sm" className="bg-red-600" onClick={() => { setSelectedBatch(row); setShowCloseDialog(true); }}>
                    <Lock className="w-4 h-4 mr-1" />
                    Close
                  </Button>
                )}

                {row.status === 'Closed' && (
                  <Button size="sm" variant="outline" className="text-orange-600 border-orange-300" onClick={() => { 
                    setSelectedBatch(row); 
                    setShowReopenRequestDialog(true); 
                  }}>
                    <Unlock className="w-4 h-4 mr-1" />
                    Request Reopen
                  </Button>
                )}

                {isSupervisor && row.status === 'Reopen Requested' && (
                  <Button size="sm" className="bg-purple-600" onClick={() => { setSelectedBatch(row); setShowReopenApprovalDialog(true); }}>
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Review Request
                  </Button>
                )}
              </div>
            )
          }
        ]}
        data={filteredBatches}
        isLoading={loading}
        emptyMessage="No batches found"
      />

      {/* Close Batch Dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Batch - Enable Operational Lock</DialogTitle>
            <DialogDescription>{selectedBatch?.batch_id}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Alert className="bg-red-50 border-red-200">
              <Lock className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">
                <strong>This action will:</strong>
                <br/>• Lock batch for debtor revisions and document updates
                <br/>• Keep financial operations (Nota, Reconciliation) active
                <br/>• Require SLA exception to reopen
              </AlertDescription>
            </Alert>

            {selectedBatch && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Batch ID:</span><span className="ml-2 font-medium">{selectedBatch.batch_id}</span></div>
                  <div><span className="text-gray-500">Records:</span><span className="ml-2 font-medium">{selectedBatch.total_records}</span></div>
                  <div><span className="text-gray-500">Final Premium:</span><span className="ml-2 font-bold text-green-600">Rp {((selectedBatch.final_premium_amount || 0) / 1000000).toFixed(1)}M</span></div>
                  <div><span className="text-gray-500">Review Complete:</span><span className="ml-2 font-bold">{selectedBatch.debtor_review_completed ? '✓ YES' : '❌ NO'}</span></div>
                </div>
              </div>
            )}

            <div>
              <Label>Remarks</Label>
              <Textarea
                value={closeRemarks}
                onChange={(e) => setCloseRemarks(e.target.value)}
                placeholder="Enter reason for closing batch..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCloseDialog(false); setCloseRemarks(''); }}>Cancel</Button>
            <Button onClick={handleCloseBatch} disabled={processing} className="bg-red-600">
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
              Close Batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Reopen Dialog */}
      <Dialog open={showReopenRequestDialog} onOpenChange={setShowReopenRequestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Batch Reopen - SLA Exception</DialogTitle>
            <DialogDescription>{selectedBatch?.batch_id}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Alert className="bg-orange-50 border-orange-200">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-700">
                <strong>SLA Exception Process:</strong>
                <br/>1. Submit reopen request with reason and impact
                <br/>2. Supervisor/Admin reviews and approves
                <br/>3. If approved: Limited reopen for specific revisions only
                <br/>4. After revision: Batch must be closed again
              </AlertDescription>
            </Alert>

            <div>
              <Label>Reason for Reopen *</Label>
              <Textarea
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Explain why batch needs to be reopened..."
                rows={4}
              />
            </div>

            <div>
              <Label>Impact Type *</Label>
              <Select value={reopenImpact} onValueChange={setReopenImpact}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Data">Data Correction Only</SelectItem>
                  <SelectItem value="Financial">Financial Impact</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowReopenRequestDialog(false); setReopenReason(''); }}>Cancel</Button>
            <Button onClick={handleRequestReopen} disabled={processing || !reopenReason} className="bg-orange-600">
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Unlock className="w-4 h-4 mr-2" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Reopen Dialog */}
      <Dialog open={showReopenApprovalDialog} onOpenChange={setShowReopenApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Reopen Request</DialogTitle>
            <DialogDescription>{selectedBatch?.batch_id}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {selectedBatch && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Requested By:</span><span className="ml-2 font-medium">{selectedBatch.reopen_requested_by}</span></div>
                  <div><span className="text-gray-500">Request Date:</span><span className="ml-2 font-medium">{new Date(selectedBatch.reopen_requested_date).toLocaleDateString('id-ID')}</span></div>
                  <div><span className="text-gray-500">Impact Type:</span><Badge className={selectedBatch.reopen_impact === 'Financial' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}>{selectedBatch.reopen_impact}</Badge></div>
                  <div className="col-span-2"><span className="text-gray-500">Reason:</span><p className="mt-1 font-medium">{selectedBatch.reopen_reason}</p></div>
                </div>
              </div>
            )}

            <Alert className="bg-purple-50 border-purple-200">
              <AlertCircle className="h-4 w-4 text-purple-600" />
              <AlertDescription className="text-purple-700">
                <strong>If Approved:</strong>
                <br/>• Batch will reopen in LIMITED mode
                <br/>• ONLY rejected debtor revisions allowed
                <br/>• Financial operations remain active
                <br/>• Must be closed again after revisions
              </AlertDescription>
            </Alert>

            <div>
              <Label>Approval Remarks</Label>
              <Textarea
                value={approvalRemarks}
                onChange={(e) => setApprovalRemarks(e.target.value)}
                placeholder="Enter approval/rejection remarks..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowReopenApprovalDialog(false); setApprovalRemarks(''); }}>Cancel</Button>
            <Button variant="destructive" onClick={() => handleApproveReopen(false)} disabled={processing}>
              <X className="w-4 h-4 mr-2" />
              Reject Request
            </Button>
            <Button onClick={() => handleApproveReopen(true)} disabled={processing} className="bg-green-600">
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Approve Reopen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batch Details</DialogTitle>
            <DialogDescription>{selectedBatch?.batch_id}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedBatch && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Status:</span><StatusBadge status={selectedBatch.status} /></div>
                  <div><span className="text-gray-500">Lock Status:</span>{selectedBatch.operational_locked ? <Badge className="bg-red-100 text-red-700"><Lock className="w-3 h-3 mr-1" />Locked</Badge> : <Badge className="bg-green-100 text-green-700"><Unlock className="w-3 h-3 mr-1" />Open</Badge>}</div>
                  <div><span className="text-gray-500">Records:</span><span className="ml-2 font-medium">{selectedBatch.total_records}</span></div>
                  <div><span className="text-gray-500">Final Premium:</span><span className="ml-2 font-bold text-green-600">Rp {((selectedBatch.final_premium_amount || 0) / 1000000).toFixed(1)}M</span></div>
                  <div><span className="text-gray-500">Review Complete:</span><span className="ml-2 font-bold">{selectedBatch.debtor_review_completed ? '✓ YES' : '❌ NO'}</span></div>
                  <div><span className="text-gray-500">Ready for Nota:</span><span className="ml-2 font-bold">{selectedBatch.batch_ready_for_nota ? '✓ YES' : '❌ NO'}</span></div>
                  {selectedBatch.closed_by && (
                    <>
                      <div><span className="text-gray-500">Closed By:</span><span className="ml-2 font-medium">{selectedBatch.closed_by}</span></div>
                      <div><span className="text-gray-500">Closed Date:</span><span className="ml-2 font-medium">{selectedBatch.closed_date}</span></div>
                    </>
                  )}
                  {selectedBatch.reopen_requested_by && (
                    <>
                      <div className="col-span-2"><span className="text-gray-500">Reopen Requested By:</span><span className="ml-2 font-medium">{selectedBatch.reopen_requested_by}</span></div>
                      <div className="col-span-2"><span className="text-gray-500">Reopen Reason:</span><p className="mt-1 font-medium">{selectedBatch.reopen_reason}</p></div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}