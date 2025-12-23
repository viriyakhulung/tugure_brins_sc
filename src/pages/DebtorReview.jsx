import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  FileText, CheckCircle2, Eye, Download, 
  RefreshCw, Check, X, Loader2, AlertCircle, DollarSign, Filter
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import StatCard from "@/components/dashboard/StatCard";
import { sendTemplatedEmail, createNotification, createAuditLog } from "@/components/utils/emailTemplateHelper";

export default function DebtorReview() {
  const [user, setUser] = useState(null);
  const [debtors, setDebtors] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDebtor, setSelectedDebtor] = useState(null);
  const [selectedDebtors, setSelectedDebtors] = useState([]);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState('');
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [filters, setFilters] = useState({
    contract: 'all',
    batch: '',
    submitStatus: 'all',
    status: 'all',
    startDate: '',
    endDate: ''
  });

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
      const [debtorData, contractData, oldContractData] = await Promise.all([
        base44.entities.Debtor.list(),
        base44.entities.MasterContract.list(),
        base44.entities.Contract.list()
      ]);
      setDebtors(debtorData || []);
      setContracts([...contractData, ...oldContractData] || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  const handleApprovalAction = async () => {
    if ((!selectedDebtor && selectedDebtors.length === 0) || !approvalAction) return;

    setProcessing(true);
    try {
      const isBulk = approvalAction.startsWith('bulk_');
      const action = isBulk ? approvalAction.replace('bulk_', '') : approvalAction;
      const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
      const debtorsToProcess = isBulk ? debtors.filter(d => selectedDebtors.includes(d.id)) : [selectedDebtor];
      
      for (const debtor of debtorsToProcess) {
        if (!debtor || !debtor.id) continue;
        
        await base44.entities.Debtor.update(debtor.id, {
          underwriting_status: newStatus,
          rejection_reason: action === 'reject' ? approvalRemarks : null
        });

        if (action === 'approve') {
          await base44.entities.Record.create({
            batch_id: debtor.batch_id,
            debtor_id: debtor.id,
            record_status: 'Accepted',
            exposure_amount: debtor.outstanding_amount || 0,
            premium_amount: debtor.gross_premium || 0,
            revision_count: 0,
            accepted_by: user?.email,
            accepted_date: new Date().toISOString().split('T')[0]
          });
        }

        await createAuditLog(
          `DEBTOR_${newStatus}`,
          'DEBTOR',
          'Debtor',
          debtor.id,
          { status: debtor.underwriting_status },
          { status: newStatus, remarks: approvalRemarks },
          user?.email,
          user?.role,
          approvalRemarks
        );
      }

      await createNotification(
        `Debtor ${newStatus}`,
        isBulk ? 
          `${debtorsToProcess.length} debtors ${newStatus.toLowerCase()}` :
          `${selectedDebtor?.debtor_name} ${newStatus.toLowerCase()}`,
        newStatus === 'APPROVED' ? 'INFO' : 'WARNING',
        'DEBTOR',
        isBulk ? debtorsToProcess[0]?.batch_id : selectedDebtor?.id,
        'BRINS'
      );

      setSuccessMessage(isBulk ? 
        `${debtorsToProcess.length} debtors ${action}d successfully` : 
        `Debtor ${action}d successfully`);
      setShowApprovalDialog(false);
      setSelectedDebtor(null);
      setSelectedDebtors([]);
      setApprovalRemarks('');
      loadData();
    } catch (error) {
      console.error('Approval error:', error);
    }
    setProcessing(false);
  };

  const clearFilters = () => {
    setFilters({
      contract: 'all',
      batch: '',
      submitStatus: 'all',
      status: 'all',
      startDate: '',
      endDate: ''
    });
  };

  const filteredDebtors = debtors.filter(d => {
    if (filters.contract !== 'all' && d.contract_id !== filters.contract) return false;
    if (filters.batch && !d.batch_id?.includes(filters.batch)) return false;
    if (filters.submitStatus !== 'all' && d.underwriting_status !== filters.submitStatus) return false;
    if (filters.status !== 'all' && d.batch_status !== filters.status) return false;
    if (filters.startDate && d.created_date < filters.startDate) return false;
    if (filters.endDate && d.created_date > filters.endDate) return false;
    return true;
  });

  const toggleDebtorSelection = (debtorId) => {
    if (selectedDebtors.includes(debtorId)) {
      setSelectedDebtors(selectedDebtors.filter(id => id !== debtorId));
    } else {
      setSelectedDebtors([...selectedDebtors, debtorId]);
    }
  };

  const columns = [
    {
      header: (
        <Checkbox
          checked={selectedDebtors.length === filteredDebtors.length && filteredDebtors.length > 0}
          onCheckedChange={(checked) => {
            if (checked) {
              setSelectedDebtors(filteredDebtors.map(d => d.id));
            } else {
              setSelectedDebtors([]);
            }
          }}
        />
      ),
      cell: (row) => (
        <Checkbox
          checked={selectedDebtors.includes(row.id)}
          onCheckedChange={() => toggleDebtorSelection(row.id)}
        />
      ),
      width: '40px'
    },
    {
      header: 'Debtor',
      cell: (row) => (
        <div>
          <p className="font-medium">{row.debtor_name}</p>
          <p className="text-sm text-gray-500">{row.participant_no}</p>
        </div>
      )
    },
    { header: 'Batch', accessorKey: 'batch_id', cell: (row) => <span className="font-mono text-sm">{row.batch_id?.slice(0, 15)}</span> },
    { header: 'Plafond', cell: (row) => `Rp ${(row.credit_plafond || 0).toLocaleString('id-ID')}` },
    { header: 'Premium', cell: (row) => `Rp ${(row.gross_premium || 0).toLocaleString('id-ID')}` },
    { header: 'Underwriting', cell: (row) => <StatusBadge status={row.underwriting_status} /> },
    { header: 'Batch Status', cell: (row) => <StatusBadge status={row.batch_status} /> },
    { 
      header: 'Remarks', 
      cell: (row) => row.validation_remarks ? (
        <span className="text-xs text-orange-600">⚠️ Issues</span>
      ) : (
        <span className="text-xs text-green-600">✓ OK</span>
      )
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setSelectedDebtor(row);
              setShowDetailDialog(true);
            }}
          >
            <Eye className="w-4 h-4" />
          </Button>
          {row.underwriting_status === 'SUBMITTED' && (
            <>
              <Button 
                size="sm" 
                className="bg-green-600"
                onClick={() => {
                  setSelectedDebtor(row);
                  setApprovalAction('approve');
                  setShowApprovalDialog(true);
                }}
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button 
                size="sm" 
                variant="destructive"
                onClick={() => {
                  setSelectedDebtor(row);
                  setApprovalAction('reject');
                  setShowApprovalDialog(true);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Debtor Review"
        subtitle="Review and approve debtor submissions"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Debtor Review' }
        ]}
        actions={
          <div className="flex gap-2">
            {selectedDebtors.length > 0 && (
              <>
                <Button 
                  className="bg-green-600"
                  onClick={() => {
                    setApprovalAction('bulk_approve');
                    setShowApprovalDialog(true);
                  }}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Approve ({selectedDebtors.length})
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => {
                    setApprovalAction('bulk_reject');
                    setShowApprovalDialog(true);
                  }}
                >
                  <X className="w-4 h-4 mr-2" />
                  Reject ({selectedDebtors.length})
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setShowFilterDialog(true)}>
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        }
      />

      {successMessage && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">{successMessage}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total Debtors" value={debtors.length} icon={FileText} />
        <StatCard title="Pending Review" value={debtors.filter(d => d.underwriting_status === 'SUBMITTED').length} icon={Clock} className="text-orange-600" />
        <StatCard title="Total Exposure" value={`Rp ${(debtors.reduce((sum, d) => sum + (d.outstanding_amount || 0), 0) / 1000000).toFixed(1)}M`} icon={DollarSign} className="text-green-600" />
        <StatCard title="Approved" value={debtors.filter(d => d.underwriting_status === 'APPROVED').length} icon={CheckCircle2} className="text-purple-600" />
      </div>

      <DataTable
        columns={columns}
        data={filteredDebtors}
        isLoading={loading}
        emptyMessage="No debtors to review"
      />

      {/* Filter Dialog */}
      <Dialog open={showFilterDialog} onOpenChange={setShowFilterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Filter Debtors</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Contract</label>
              <Select value={filters.contract} onValueChange={(val) => setFilters({...filters, contract: val})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Contracts</SelectItem>
                  {contracts.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.contract_id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Batch ID</label>
              <Input
                placeholder="Search batch..."
                value={filters.batch}
                onChange={(e) => setFilters({...filters, batch: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Underwriting Status</label>
              <Select value={filters.submitStatus} onValueChange={(val) => setFilters({...filters, submitStatus: val})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="SUBMITTED">Submitted</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Batch Status</label>
              <Select value={filters.status} onValueChange={(val) => setFilters({...filters, status: val})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Uploaded">Uploaded</SelectItem>
                  <SelectItem value="Validated">Validated</SelectItem>
                  <SelectItem value="Matched">Matched</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={clearFilters}>Clear</Button>
            <Button onClick={() => setShowFilterDialog(false)}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Debtor Details</DialogTitle>
            <DialogDescription>{selectedDebtor?.debtor_name}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Participant No:</span><p className="font-medium">{selectedDebtor?.participant_no}</p></div>
              <div><span className="text-gray-500">Batch ID:</span><p className="font-medium">{selectedDebtor?.batch_id}</p></div>
              <div><span className="text-gray-500">Plafond:</span><p className="font-medium">Rp {(selectedDebtor?.credit_plafond || 0).toLocaleString('id-ID')}</p></div>
              <div><span className="text-gray-500">Premium:</span><p className="font-medium">Rp {(selectedDebtor?.gross_premium || 0).toLocaleString('id-ID')}</p></div>
              <div><span className="text-gray-500">Status:</span><StatusBadge status={selectedDebtor?.underwriting_status} /></div>
              {selectedDebtor?.validation_remarks && (
                <div className="col-span-2 p-3 bg-orange-50 border border-orange-200 rounded">
                  <p className="text-sm font-medium text-orange-700">Validation Remarks:</p>
                  <p className="text-sm text-orange-600">{selectedDebtor.validation_remarks}</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowDetailDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalAction?.includes('bulk') ? 
                `Bulk ${approvalAction.includes('approve') ? 'Approve' : 'Reject'} (${selectedDebtors.length} debtors)` :
                (approvalAction === 'approve' ? 'Approve Debtor' : 'Reject Debtor')
              }
            </DialogTitle>
            <DialogDescription>
              {approvalAction?.includes('bulk') ? 
                `Processing ${selectedDebtors.length} selected debtors` :
                selectedDebtor?.debtor_name
              }
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {!approvalAction?.includes('bulk') && selectedDebtor && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Plafond:</span><span className="ml-2 font-medium">Rp {(selectedDebtor?.credit_plafond || 0).toLocaleString('id-ID')}</span></div>
                  <div><span className="text-gray-500">Premium:</span><span className="ml-2 font-medium">Rp {(selectedDebtor?.gross_premium || 0).toLocaleString('id-ID')}</span></div>
                </div>
              </div>
            )}
            
            {(approvalAction === 'reject' || approvalAction === 'bulk_reject') && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {approvalAction === 'bulk_reject' ? 
                    `Rejecting ${selectedDebtors.length} debtors will allow them to be revised and resubmitted.` :
                    'Rejecting will allow revision and resubmission.'
                  }
                </AlertDescription>
              </Alert>
            )}

            <div>
              <label className="text-sm font-medium">Remarks *</label>
              <Textarea
                value={approvalRemarks}
                onChange={(e) => setApprovalRemarks(e.target.value)}
                placeholder={approvalAction === 'approve' || approvalAction === 'bulk_approve' ? "Enter approval notes..." : "Enter rejection reason (for revision)..."}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>Cancel</Button>
            <Button
              onClick={handleApprovalAction}
              disabled={processing || !approvalRemarks}
              className={(approvalAction === 'approve' || approvalAction === 'bulk_approve') ? 'bg-green-600' : 'bg-red-600'}
            >
              {processing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
              ) : (
                <>{(approvalAction === 'approve' || approvalAction === 'bulk_approve') ? <Check className="w-4 h-4 mr-2" /> : <X className="w-4 h-4 mr-2" />}
                {(approvalAction === 'approve' || approvalAction === 'bulk_approve') ? 'Approve' : 'Reject'}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}