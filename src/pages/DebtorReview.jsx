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
  RefreshCw, Check, X, Loader2, Search, AlertCircle
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";

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
      const currentUser = await base44.auth.me();
      setUser(currentUser);
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
    if (!selectedDebtor || !approvalAction) return;

    setProcessing(true);
    try {
      const newStatus = approvalAction === 'approve' ? 'APPROVED' : 'REJECTED';
      
      if (!selectedDebtor || !selectedDebtor.id) {
        setProcessing(false);
        return;
      }
      
      await base44.entities.Debtor.update(selectedDebtor.id, {
        underwriting_status: newStatus,
        batch_status: newStatus === 'APPROVED' ? 'COMPLETED' : 'REJECTED'
      });

      // Send email notification
      const notifSettings = await base44.entities.NotificationSetting.list();
      const brinsSettings = notifSettings.filter(s => s.user_role === 'BRINS' && s.email_enabled);
      
      for (const setting of brinsSettings) {
        if (setting.notify_on_approval && newStatus === 'APPROVED') {
          await base44.integrations.Core.SendEmail({
            to: setting.notification_email,
            subject: `Debtor Approved - ${selectedDebtor.debtor_name}`,
            body: `Debtor ${selectedDebtor.debtor_name} (${selectedDebtor.participant_no}) has been APPROVED.\n\nPlafond: Rp ${(selectedDebtor.credit_plafond || 0).toLocaleString('id-ID')}\nBranch: ${selectedDebtor.branch_desc}\n\nApproved by: ${user?.email}\nDate: ${new Date().toLocaleDateString('id-ID')}`
          });
        } else if (setting.notify_on_rejection && newStatus === 'REJECTED') {
          await base44.integrations.Core.SendEmail({
            to: setting.notification_email,
            subject: `Debtor Rejected - ${selectedDebtor.debtor_name}`,
            body: `Debtor ${selectedDebtor.debtor_name} (${selectedDebtor.participant_no}) has been REJECTED.\n\nReason: ${approvalRemarks}\n\nRejected by: ${user?.email}\nDate: ${new Date().toLocaleDateString('id-ID')}`
          });
        }
      }

      await base44.entities.Notification.create({
        title: `Debtor ${newStatus}`,
        message: `${selectedDebtor.debtor_name} has been ${newStatus.toLowerCase()} by ${user?.email}`,
        type: newStatus === 'APPROVED' ? 'INFO' : 'WARNING',
        module: 'DEBTOR',
        reference_id: selectedDebtor.id,
        target_role: 'BRINS'
      });

      await base44.entities.AuditLog.create({
        action: `DEBTOR_${newStatus}`,
        module: 'DEBTOR',
        entity_type: 'Debtor',
        entity_id: selectedDebtor.id,
        old_value: JSON.stringify({ status: selectedDebtor.underwriting_status }),
        new_value: JSON.stringify({ status: newStatus, remarks: approvalRemarks }),
        user_email: user?.email,
        user_role: user?.role,
        reason: approvalRemarks
      });

      setSuccessMessage(`Debtor ${approvalAction === 'approve' ? 'approved' : 'rejected'} successfully`);
      setShowApprovalDialog(false);
      setSelectedDebtor(null);
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

  const columns = [
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
              {approvalAction === 'approve' ? 'Approve Debtor' : 'Reject Debtor'}
            </DialogTitle>
            <DialogDescription>
              {selectedDebtor?.debtor_name}
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
            
            {approvalAction === 'reject' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Rejecting this debtor will terminate their coverage application.
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
              className={approvalAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {approvalAction === 'approve' ? <Check className="w-4 h-4 mr-2" /> : <X className="w-4 h-4 mr-2" />}
                  {approvalAction === 'approve' ? 'Approve' : 'Reject'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}