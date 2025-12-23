import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  FileText, CheckCircle2, XCircle, Clock, Eye, Download, 
  RefreshCw, Check, X, Loader2, Search, AlertCircle, DollarSign
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import StatCard from "@/components/dashboard/StatCard";
import { sendTemplatedEmail, createNotification, createAuditLog } from "@/components/utils/emailTemplateHelper";

const DOCUMENT_TYPES = [
  'Perjanjian Kredit',
  'Jadwal Angsuran',
  'Bukti Pencairan',
  'Identitas Debitur'
];

export default function DebtorReview() {
  const [user, setUser] = useState(null);
  const [debtors, setDebtors] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDebtor, setSelectedDebtor] = useState(null);
  const [selectedDebtors, setSelectedDebtors] = useState([]);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState('');
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [filters, setFilters] = useState({
    contract: 'all',
    batch: '',
    submitStatus: 'all',
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
        const demoUser = JSON.parse(demoUserStr);
        setUser(demoUser);
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [debtorData, docData, contractData] = await Promise.all([
        base44.entities.Debtor.list(),
        base44.entities.Document.list(),
        base44.entities.Contract.list()
      ]);
      setDebtors(debtorData || []);
      setDocuments(docData || []);
      setContracts(contractData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  const getDebtorDocuments = (debtorId) => {
    return documents.filter(d => d.debtor_id === debtorId);
  };

  const calculateDocProgress = (debtorId) => {
    const debtorDocs = getDebtorDocuments(debtorId);
    const verifiedDocs = debtorDocs.filter(d => d.status === 'VERIFIED');
    return {
      completed: verifiedDocs.length,
      total: DOCUMENT_TYPES.length,
      percentage: Math.round((verifiedDocs.length / DOCUMENT_TYPES.length) * 100)
    };
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
        
        // 1. Update Debtor status
        await base44.entities.Debtor.update(debtor.id, {
          underwriting_status: newStatus,
          batch_status: newStatus === 'APPROVED' ? 'COMPLETED' : 'REJECTED'
        });

        // 2. Auto-create Record entity if approved
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

        // 3. Create audit log
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

      // 3. Send templated email based on user preferences
      // Note: No specific email template for debtor approval, using direct notification
      const notifSettings = await base44.entities.NotificationSetting.list();
      const brinsSettings = notifSettings.filter(s => 
        s.user_role === 'BRINS' && 
        s.email_enabled && 
        s.notify_approval_required
      );
      
      for (const setting of brinsSettings) {
        await base44.integrations.Core.SendEmail({
          to: setting.notification_email,
          subject: `Debtor ${newStatus} - ${selectedDebtor.debtor_name}`,
          body: `Dear BRINS Team,\n\nDebtor ${selectedDebtor.debtor_name} (${selectedDebtor.participant_no}) has been ${newStatus}.\n\nDebtor Details:\n- Plafond: Rp ${(selectedDebtor.credit_plafond || 0).toLocaleString('id-ID')}\n- Premium: Rp ${(selectedDebtor.gross_premium || 0).toLocaleString('id-ID')}\n- Branch: ${selectedDebtor.branch_desc}\n- Batch: ${selectedDebtor.batch_id}\n\nRemarks: ${approvalRemarks}\n\nProcessed by: ${user?.email}\nDate: ${new Date().toLocaleDateString('id-ID')}\n\nBest regards,\nTUGURE Reinsurance System`
        });
      }

      // 4. Create notification
      const notificationMessage = isBulk ? 
        `${debtorsToProcess.length} debtors ${newStatus.toLowerCase()} in bulk by ${user?.email}` :
        `${selectedDebtor?.debtor_name} has been ${newStatus.toLowerCase()} by ${user?.email}`;
      
      await createNotification(
        `Debtor ${newStatus}`,
        notificationMessage,
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

  const handleExport = () => {
    console.log('Export data');
    // Export functionality
  };

  const clearFilters = () => {
    setFilters({
      contract: 'all',
      batch: '',
      submitStatus: 'all',
      startDate: '',
      endDate: ''
    });
  };

  const filteredDebtors = debtors.filter(d => {
    if (filters.contract !== 'all' && d.contract_id !== filters.contract) return false;
    if (filters.batch && !d.batch_id?.includes(filters.batch)) return false;
    if (filters.submitStatus !== 'all' && d.underwriting_status !== filters.submitStatus) return false;
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
    {
      header: 'Document Progress',
      cell: (row) => {
        const progress = calculateDocProgress(row.id);
        return (
          <div className="w-32">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600">{progress.completed}/{progress.total}</span>
              <span className="text-xs font-medium">{progress.percentage}%</span>
            </div>
            <Progress value={progress.percentage} className="h-2" />
          </div>
        );
      }
    },
    { header: 'Underwriting', cell: (row) => <StatusBadge status={row.underwriting_status} /> },
    { header: 'Batch Status', cell: (row) => <StatusBadge status={row.batch_status} /> },
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
                className="bg-green-600 hover:bg-green-700"
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
                  className="bg-green-600 hover:bg-green-700"
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
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export
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

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Debtors"
          value={debtors.length}
          subtitle={`${debtors.filter(d => d.credit_type === 'Individual').length} individual / ${debtors.filter(d => d.credit_type === 'Corporate').length} corporate`}
          icon={FileText}
          gradient
          className="from-blue-500 to-blue-600"
        />
        <StatCard
          title="Pending Review"
          value={debtors.filter(d => d.underwriting_status === 'SUBMITTED').length}
          subtitle="Awaiting approval"
          icon={Clock}
          gradient
          className="from-orange-500 to-orange-600"
        />
        <StatCard
          title="Total Exposure"
          value={`Rp ${(debtors.reduce((sum, d) => sum + (d.outstanding_amount || 0), 0) / 1000000).toFixed(1)}M`}
          subtitle="Outstanding amount"
          icon={DollarSign}
          gradient
          className="from-green-500 to-green-600"
        />
        <StatCard
          title="Approved Debtors"
          value={debtors.filter(d => d.underwriting_status === 'APPROVED').length}
          subtitle={`${((debtors.filter(d => d.underwriting_status === 'APPROVED').length / (debtors.length || 1)) * 100).toFixed(0)}% approval rate`}
          icon={CheckCircle2}
          gradient
          className="from-purple-500 to-purple-600"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Select value={filters.contract} onValueChange={(val) => setFilters({...filters, contract: val})}>
              <SelectTrigger>
                <SelectValue placeholder="Contract" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Contracts</SelectItem>
                {contracts.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.contract_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Batch ID..."
              value={filters.batch}
              onChange={(e) => setFilters({...filters, batch: e.target.value})}
            />
            <Select value={filters.submitStatus} onValueChange={(val) => setFilters({...filters, submitStatus: val})}>
              <SelectTrigger>
                <SelectValue placeholder="Submit Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SUBMITTED">Submitted</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              placeholder="Start Date"
              value={filters.startDate}
              onChange={(e) => setFilters({...filters, startDate: e.target.value})}
            />
            <Input
              type="date"
              placeholder="End Date"
              value={filters.endDate}
              onChange={(e) => setFilters({...filters, endDate: e.target.value})}
            />
          </div>
          <div className="mt-3 flex justify-end">
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredDebtors}
        isLoading={loading}
        emptyMessage="No debtors to review"
      />

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Debtor Details</DialogTitle>
            <DialogDescription>{selectedDebtor?.debtor_name}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Participant No:</span>
                <p className="font-medium">{selectedDebtor?.participant_no}</p>
              </div>
              <div>
                <span className="text-gray-500">Batch ID:</span>
                <p className="font-medium">{selectedDebtor?.batch_id}</p>
              </div>
              <div>
                <span className="text-gray-500">Plafond:</span>
                <p className="font-medium">Rp {(selectedDebtor?.credit_plafond || 0).toLocaleString('id-ID')}</p>
              </div>
              <div>
                <span className="text-gray-500">Premium:</span>
                <p className="font-medium">Rp {(selectedDebtor?.gross_premium || 0).toLocaleString('id-ID')}</p>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Documents ({calculateDocProgress(selectedDebtor?.id || '').completed}/{DOCUMENT_TYPES.length})</h4>
              <div className="space-y-2">
                {DOCUMENT_TYPES.map((docType, idx) => {
                  const doc = getDebtorDocuments(selectedDebtor?.id || '').find(d => d.document_type === docType);
                  return (
                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        {doc?.status === 'VERIFIED' ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : doc ? (
                          <Clock className="w-4 h-4 text-yellow-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-300" />
                        )}
                        <span className="text-sm">{docType}</span>
                      </div>
                      {doc && <StatusBadge status={doc.status} />}
                    </div>
                  );
                })}
              </div>
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
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Plafond:</span>
                  <span className="ml-2 font-medium">Rp {(selectedDebtor?.credit_plafond || 0).toLocaleString('id-ID')}</span>
                </div>
                <div>
                  <span className="text-gray-500">Premium:</span>
                  <span className="ml-2 font-medium">Rp {(selectedDebtor?.gross_premium || 0).toLocaleString('id-ID')}</span>
                </div>
                <div>
                  <span className="text-gray-500">Doc Progress:</span>
                  <span className="ml-2 font-medium">{calculateDocProgress(selectedDebtor?.id || '').percentage}%</span>
                </div>
                <div>
                  <span className="text-gray-500">Batch Status:</span>
                  <span className="ml-2"><StatusBadge status={selectedDebtor?.batch_status} /></span>
                </div>
              </div>
            </div>
            
            {(approvalAction === 'reject' || approvalAction === 'bulk_reject') && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {approvalAction === 'bulk_reject' ? 
                    `Rejecting ${selectedDebtors.length} debtors will terminate their coverage applications.` :
                    'Rejecting this debtor will terminate their coverage application.'
                  }
                </AlertDescription>
              </Alert>
            )}

            <div>
              <label className="text-sm font-medium">Remarks *</label>
              <Textarea
                value={approvalRemarks}
                onChange={(e) => setApprovalRemarks(e.target.value)}
                placeholder={approvalAction === 'approve' ? "Enter approval notes..." : "Enter rejection reason..."}
                className="mt-1"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApprovalAction}
              disabled={processing || !approvalRemarks}
              className={(approvalAction === 'approve' || approvalAction === 'bulk_approve') ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {(approvalAction === 'approve' || approvalAction === 'bulk_approve') ? <Check className="w-4 h-4 mr-2" /> : <X className="w-4 h-4 mr-2" />}
                  {(approvalAction === 'approve' || approvalAction === 'bulk_approve') ? 'Approve' : 'Reject'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}