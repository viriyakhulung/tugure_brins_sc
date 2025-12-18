import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  FileText, CheckCircle2, Clock, Eye, Download, 
  Filter, RefreshCw, Check, X, AlertCircle, Loader2
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import { useAuth } from "@/components/auth/AuthContext";
import PageHeader from "@/components/common/PageHeader";
import FilterPanel from "@/components/common/FilterPanel";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";

export default function BorderoManagement() {
  const { user, hasAccess } = useAuth();
  const [activeTab, setActiveTab] = useState('debtors');
  const [debtors, setDebtors] = useState([]);
  const [borderos, setBorderos] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDebtor, setSelectedDebtor] = useState(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState('');
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [filters, setFilters] = useState({
    contract: 'all',
    batch: '',
    submitStatus: 'all',
    reconStatus: 'all',
    startDate: '',
    endDate: ''
  });

  const isTugure = hasAccess(['TUGURE']);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [debtorData, borderoData, contractData] = await Promise.all([
        base44.entities.Debtor.list(),
        base44.entities.Bordero.list(),
        base44.entities.Contract.list()
      ]);
      setDebtors(debtorData || []);
      setBorderos(borderoData || []);
      setContracts(contractData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    setFilters({
      contract: 'all',
      batch: '',
      submitStatus: 'all',
      reconStatus: 'all',
      startDate: '',
      endDate: ''
    });
  };

  const handleApprovalAction = async () => {
    if (!selectedDebtor || !approvalAction) return;

    setProcessing(true);
    try {
      const newStatus = approvalAction === 'approve' ? 'APPROVED' : 'REJECTED';
      
      await base44.entities.Debtor.update(selectedDebtor.id, {
        submit_status: newStatus,
        approval_remarks: approvalRemarks,
        approval_date: new Date().toISOString().split('T')[0],
        approved_by: user?.email,
        exposure_status: newStatus === 'APPROVED' ? 'ACTIVE' : 'TERMINATED',
        exposure_amount: newStatus === 'APPROVED' ? selectedDebtor.plafon * 0.75 : 0
      });

      // Create notification
      await base44.entities.Notification.create({
        title: `Debtor ${newStatus}`,
        message: `${selectedDebtor.nama_peserta} has been ${newStatus.toLowerCase()}`,
        type: newStatus === 'APPROVED' ? 'INFO' : 'WARNING',
        module: 'DEBTOR',
        reference_id: selectedDebtor.id,
        target_role: 'BRINS'
      });

      // Create audit log
      await base44.entities.AuditLog.create({
        action: `DEBTOR_${newStatus}`,
        module: 'DEBTOR',
        entity_type: 'Debtor',
        entity_id: selectedDebtor.id,
        old_value: JSON.stringify({ status: selectedDebtor.submit_status }),
        new_value: JSON.stringify({ status: newStatus }),
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

  const handleExport = (format) => {
    console.log('Export to:', format);
    // Export functionality
  };

  const filteredDebtors = debtors.filter(d => {
    if (filters.contract !== 'all' && d.contract_id !== filters.contract) return false;
    if (filters.batch && !d.batch_id?.includes(filters.batch)) return false;
    if (filters.submitStatus !== 'all' && d.submit_status !== filters.submitStatus) return false;
    return true;
  });

  const debtorColumns = [
    {
      header: 'Debtor',
      cell: (row) => (
        <div>
          <p className="font-medium">{row.nama_peserta}</p>
          <p className="text-sm text-gray-500">{row.nomor_peserta}</p>
        </div>
      )
    },
    { header: 'Batch', accessorKey: 'batch_id', cell: (row) => <span className="font-mono text-sm">{row.batch_id?.slice(0, 15)}</span> },
    { header: 'Plafon', cell: (row) => `IDR ${(row.plafon || 0).toLocaleString()}` },
    { header: 'Net Premi', cell: (row) => `IDR ${(row.net_premi || 0).toLocaleString()}` },
    { header: 'Submit Status', cell: (row) => <StatusBadge status={row.submit_status} /> },
    { header: 'Admin Status', cell: (row) => <StatusBadge status={row.admin_status} /> },
    { header: 'Exposure Status', cell: (row) => <StatusBadge status={row.exposure_status} /> },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setSelectedDebtor(row)}>
            <Eye className="w-4 h-4" />
          </Button>
          {isTugure && row.submit_status === 'SUBMITTED' && (
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

  const borderoColumns = [
    { header: 'Bordero ID', accessorKey: 'bordero_id' },
    { header: 'Period', accessorKey: 'period' },
    { header: 'Total Debtors', accessorKey: 'total_debtors' },
    { header: 'Total Exposure', cell: (row) => `IDR ${(row.total_exposure || 0).toLocaleString()}` },
    { header: 'Total Premium', cell: (row) => `IDR ${(row.total_premium || 0).toLocaleString()}` },
    { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Eye className="w-4 h-4 mr-1" />
            View
          </Button>
          {isTugure && row.status === 'GENERATED' && (
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              Review
            </Button>
          )}
          {isTugure && row.status === 'UNDER_REVIEW' && (
            <Button size="sm" className="bg-green-600 hover:bg-green-700">
              Finalize
            </Button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bordero Management"
        subtitle="Manage debtors, exposure and bordero data"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Bordero Management' }
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

      <FilterPanel
        filters={filters}
        onFilterChange={handleFilterChange}
        onClear={clearFilters}
        onExport={handleExport}
        contracts={contracts}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="debtors">
            <FileText className="w-4 h-4 mr-2" />
            Debtors ({filteredDebtors.length})
          </TabsTrigger>
          <TabsTrigger value="exposure">
            <FileText className="w-4 h-4 mr-2" />
            Exposure Data
          </TabsTrigger>
          <TabsTrigger value="borderos">
            <FileText className="w-4 h-4 mr-2" />
            Borderos ({borderos.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="debtors" className="mt-4">
          <DataTable
            columns={debtorColumns}
            data={filteredDebtors}
            isLoading={loading}
            emptyMessage="No debtors found"
          />
        </TabsContent>

        <TabsContent value="exposure" className="mt-4">
          <DataTable
            columns={[
              { header: 'Debtor', cell: (row) => row.nama_peserta },
              { header: 'Coverage %', cell: () => '75%' },
              { header: 'Approved Limit', cell: (row) => `IDR ${(row.plafon || 0).toLocaleString()}` },
              { header: 'Exposure Amount', cell: (row) => `IDR ${(row.exposure_amount || 0).toLocaleString()}` },
              { header: 'Exposure Status', cell: (row) => <StatusBadge status={row.exposure_status} /> },
              { header: 'Admin Status', cell: (row) => <StatusBadge status={row.admin_status} /> }
            ]}
            data={filteredDebtors.filter(d => d.submit_status === 'APPROVED')}
            isLoading={loading}
            emptyMessage="No exposure data"
          />
        </TabsContent>

        <TabsContent value="borderos" className="mt-4">
          <DataTable
            columns={borderoColumns}
            data={borderos}
            isLoading={loading}
            emptyMessage="No borderos generated yet"
          />
        </TabsContent>
      </Tabs>

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalAction === 'approve' ? 'Approve Debtor' : 'Reject Debtor'}
            </DialogTitle>
            <DialogDescription>
              {selectedDebtor?.nama_peserta}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Plafon:</span>
                  <span className="ml-2 font-medium">IDR {(selectedDebtor?.plafon || 0).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-500">Net Premi:</span>
                  <span className="ml-2 font-medium">IDR {(selectedDebtor?.net_premi || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Remarks *</label>
              <Textarea
                value={approvalRemarks}
                onChange={(e) => setApprovalRemarks(e.target.value)}
                placeholder="Enter approval/rejection reason..."
                className="mt-1"
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