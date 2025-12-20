import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CheckCircle2, RefreshCw, ArrowRight, Loader2, Eye
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import { sendTemplatedEmail, createNotification, createAuditLog } from "@/components/utils/emailTemplateHelper";

export default function BatchProcessing() {
  const [user, setUser] = useState(null);
  const [batches, setBatches] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState('');
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [remarks, setRemarks] = useState('');
  const [filters, setFilters] = useState({
    contract: 'all',
    status: 'all'
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
      const [batchData, contractData] = await Promise.all([
        base44.entities.Batch.list('-created_date'),
        base44.entities.Contract.list()
      ]);
      setBatches(batchData || []);
      setContracts(contractData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  const getNextStatus = (currentStatus) => {
    const workflow = ['Uploaded', 'Validated', 'Matched', 'Approved', 'Nota Issued', 'Branch Confirmed', 'Paid', 'Closed'];
    const currentIndex = workflow.indexOf(currentStatus);
    return currentIndex >= 0 && currentIndex < workflow.length - 1 ? workflow[currentIndex + 1] : null;
  };

  const getActionLabel = (status) => {
    const labels = {
      'Uploaded': 'Validate',
      'Validated': 'Match',
      'Matched': 'Approve',
      'Approved': 'Issue Nota',
      'Nota Issued': 'Confirm Branch',
      'Branch Confirmed': 'Mark Paid',
      'Paid': 'Close'
    };
    return labels[status] || 'Process';
  };

  const getFieldName = (status) => {
    const fields = {
      'Validated': { by: 'validated_by', date: 'validated_date' },
      'Matched': { by: 'matched_by', date: 'matched_date' },
      'Approved': { by: 'approved_by', date: 'approved_date' },
      'Nota Issued': { by: 'nota_issued_by', date: 'nota_issued_date' },
      'Branch Confirmed': { by: 'branch_confirmed_by', date: 'branch_confirmed_date' },
      'Paid': { by: 'paid_by', date: 'paid_date' },
      'Closed': { by: 'closed_by', date: 'closed_date' }
    };
    return fields[status];
  };

  const handleBatchAction = async () => {
    if (!selectedBatch || !actionType) return;

    setProcessing(true);
    try {
      const nextStatus = getNextStatus(selectedBatch.status);
      if (!nextStatus) {
        setProcessing(false);
        return;
      }

      const fields = getFieldName(nextStatus);
      const updateData = {
        status: nextStatus,
        [fields.by]: user?.email,
        [fields.date]: new Date().toISOString().split('T')[0]
      };

      await base44.entities.Batch.update(selectedBatch.id, updateData);

      // Create Nota when status changes to Nota Issued
      if (nextStatus === 'Nota Issued') {
        const notaNumber = `NOTA-${selectedBatch.batch_id}-${Date.now()}`;
        await base44.entities.Nota.create({
          nota_number: notaNumber,
          nota_type: 'Batch',
          reference_id: selectedBatch.batch_id,
          contract_id: selectedBatch.contract_id,
          amount: selectedBatch.total_premium || 0,
          currency: 'IDR',
          status: 'Draft'
        });
      }

      // Send templated emails based on user preferences
      const targetRole = nextStatus === 'Nota Issued' || nextStatus === 'Paid' || nextStatus === 'Closed' ? 'BRINS' : 
                        nextStatus === 'Branch Confirmed' ? 'TUGURE' : 'ALL';
      
      await sendTemplatedEmail(
        'Batch',
        nextStatus,
        targetRole,
        'notify_batch_status',
        {
          batch_id: selectedBatch.batch_id,
          user_name: user?.email || 'System',
          date: new Date().toLocaleDateString('id-ID'),
          total_records: selectedBatch.total_records || 0,
          total_exposure: `Rp ${(selectedBatch.total_exposure || 0).toLocaleString('id-ID')}`,
          total_premium: `Rp ${(selectedBatch.total_premium || 0).toLocaleString('id-ID')}`,
          nota_number: nextStatus === 'Nota Issued' ? `NOTA-${selectedBatch.batch_id}` : '',
          payment_reference: remarks || ''
        }
      );

      // Create system notification
      await createNotification(
        `Batch ${nextStatus}`,
        `Batch ${selectedBatch.batch_id} moved to ${nextStatus} by ${user?.email}`,
        nextStatus === 'Nota Issued' ? 'ACTION_REQUIRED' : 'INFO',
        'DEBTOR',
        selectedBatch.id,
        targetRole
      );

      // Create audit log
      await createAuditLog(
        `BATCH_${nextStatus.toUpperCase().replace(/ /g, '_')}`,
        'DEBTOR',
        'Batch',
        selectedBatch.id,
        { status: selectedBatch.status },
        { status: nextStatus },
        user?.email,
        user?.role,
        remarks
      );

      setSuccessMessage(`Batch moved to ${nextStatus} successfully`);
      setShowActionDialog(false);
      setSelectedBatch(null);
      setRemarks('');
      loadData();
    } catch (error) {
      console.error('Action error:', error);
    }
    setProcessing(false);
  };

  const filteredBatches = batches.filter(b => {
    if (filters.contract !== 'all' && b.contract_id !== filters.contract) return false;
    if (filters.status !== 'all' && b.status !== filters.status) return false;
    return true;
  });

  const columns = [
    {
      header: 'Batch ID',
      cell: (row) => (
        <div>
          <p className="font-medium font-mono">{row.batch_id}</p>
          <p className="text-xs text-gray-500">{row.batch_month}/{row.batch_year}</p>
        </div>
      )
    },
    { header: 'Total Records', accessorKey: 'total_records' },
    { header: 'Total Exposure', cell: (row) => `Rp ${(row.total_exposure || 0).toLocaleString('id-ID')}` },
    { header: 'Total Premium', cell: (row) => `Rp ${(row.total_premium || 0).toLocaleString('id-ID')}` },
    { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
    {
      header: 'Processed By',
      cell: (row) => {
        const status = row.status;
        const fields = getFieldName(status);
        if (!fields) return '-';
        return (
          <div className="text-xs">
            <p>{row[fields.by] || '-'}</p>
            <p className="text-gray-500">{row[fields.date] || '-'}</p>
          </div>
        );
      }
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setSelectedBatch(row)}
          >
            <Eye className="w-4 h-4" />
          </Button>
          {row.status !== 'Closed' && getNextStatus(row.status) && (
            <Button 
              size="sm" 
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                setSelectedBatch(row);
                setActionType(getActionLabel(row.status));
                setShowActionDialog(true);
              }}
            >
              <ArrowRight className="w-4 h-4 mr-1" />
              {getActionLabel(row.status)}
            </Button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batch Processing"
        subtitle="Process batches through workflow stages"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Batch Processing' }
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

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <Select value={filters.status} onValueChange={(val) => setFilters({...filters, status: val})}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Uploaded">Uploaded</SelectItem>
                <SelectItem value="Validated">Validated</SelectItem>
                <SelectItem value="Matched">Matched</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Nota Issued">Nota Issued</SelectItem>
                <SelectItem value="Branch Confirmed">Branch Confirmed</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setFilters({ contract: 'all', status: 'all' })}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={filteredBatches}
        isLoading={loading}
        emptyMessage="No batches found"
      />

      {/* Action Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionType} Batch</DialogTitle>
            <DialogDescription>
              Move batch {selectedBatch?.batch_id} from {selectedBatch?.status} to {getNextStatus(selectedBatch?.status)}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Total Records:</span>
                  <span className="ml-2 font-medium">{selectedBatch?.total_records}</span>
                </div>
                <div>
                  <span className="text-gray-500">Total Premium:</span>
                  <span className="ml-2 font-medium">Rp {(selectedBatch?.total_premium || 0).toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Remarks</label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter remarks..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActionDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBatchAction}
              disabled={processing}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4 mr-2" />
                  {actionType}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}