import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  FileText, ArrowRight, Loader2, Eye, RefreshCw, 
  Download, CheckCircle2, AlertCircle, Check, X
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import StatCard from "@/components/dashboard/StatCard";
import { sendTemplatedEmail, createNotification, createAuditLog } from "@/components/utils/emailTemplateHelper";

export default function BatchProcessing() {
  const [user, setUser] = useState(null);
  const [batches, setBatches] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [debtors, setDebtors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [selectedBatches, setSelectedBatches] = useState([]);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [actionType, setActionType] = useState('');
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [remarks, setRemarks] = useState('');
  const [filters, setFilters] = useState({
    contract: 'all',
    batch: '',
    status: 'all'
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
      const [batchData, contractData, debtorData] = await Promise.all([
        base44.entities.Batch.list(),
        base44.entities.Contract.list(),
        base44.entities.Debtor.list()
      ]);
      setBatches(batchData || []);
      setContracts(contractData || []);
      setDebtors(debtorData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  const getNextStatus = (current) => {
    const workflow = {
      'Uploaded': 'Validated',
      'Validated': 'Matched',
      'Matched': 'Approved',
      'Approved': 'Nota Issued',
      'Nota Issued': 'Branch Confirmed',
      'Branch Confirmed': 'Paid',
      'Paid': 'Closed'
    };
    return workflow[current];
  };

  const getActionLabel = (status) => {
    const labels = {
      'Uploaded': 'Validate',
      'Validated': 'Match',
      'Matched': 'Approve',
      'Approved': 'Generate Nota',
      'Nota Issued': 'Confirm',
      'Branch Confirmed': 'Mark Paid',
      'Paid': 'Close'
    };
    return labels[status] || 'Process';
  };

  const getStatusField = (status) => {
    const fields = {
      'Validated': { by: 'validated_by', date: 'validated_date' },
      'Matched': { by: 'matched_by', date: 'matched_date' },
      'Approved': { by: 'approved_by', date: 'approved_date' },
      'Nota Issued': { by: 'nota_issued_by', date: 'nota_issued_date' },
      'Branch Confirmed': { by: 'branch_confirmed_by', date: 'branch_confirmed_date' },
      'Paid': { by: 'paid_by', date: 'paid_date' },
      'Closed': { by: 'closed_by', date: 'closed_date' }
    };
    return fields[status] || { by: 'processed_by', date: 'processed_date' };
  };

  const handleBatchAction = async () => {
    if (!selectedBatch) return;

    setProcessing(true);
    try {
      const nextStatus = getNextStatus(selectedBatch.status);
      if (!nextStatus) {
        setProcessing(false);
        return;
      }

      // Validate batch has approved debtors
      const batchDebtors = debtors.filter(d => d.batch_id === selectedBatch.batch_id);
      const approvedDebtors = batchDebtors.filter(d => d.underwriting_status === 'APPROVED');
      
      if (approvedDebtors.length === 0 && selectedBatch.status === 'Matched') {
        setSuccessMessage('');
        alert('Cannot approve batch: No approved debtors found. Batch rejected.');
        
        // Update batch to Rejected status
        await base44.entities.Batch.update(selectedBatch.id, {
          status: 'Rejected',
          rejection_reason: 'No approved debtors'
        });

        await createNotification(
          'Batch Rejected - No Approved Debtors',
          `Batch ${selectedBatch.batch_id} rejected: no approved debtors`,
          'WARNING',
          'DEBTOR',
          selectedBatch.id,
          'BRINS'
        );

        await createAuditLog(
          'BATCH_REJECTED',
          'DEBTOR',
          'Batch',
          selectedBatch.id,
          { status: selectedBatch.status },
          { status: 'Rejected', reason: 'No approved debtors' },
          user?.email,
          user?.role,
          'No approved debtors found'
        );

        setShowActionDialog(false);
        loadData();
        setProcessing(false);
        return;
      }

      const statusField = getStatusField(nextStatus);
      const updateData = {
        status: nextStatus,
        [statusField.by]: user?.email,
        [statusField.date]: new Date().toISOString().split('T')[0]
      };

      await base44.entities.Batch.update(selectedBatch.id, updateData);

      // Generate Bordero when moving to Approved
      if (nextStatus === 'Approved') {
        const borderoId = `BDR-${selectedBatch.batch_id}-${Date.now()}`;
        await base44.entities.Bordero.create({
          bordero_id: borderoId,
          contract_id: selectedBatch.contract_id,
          batch_id: selectedBatch.batch_id,
          period: `${selectedBatch.batch_year}-${String(selectedBatch.batch_month).padStart(2, '0')}`,
          total_debtors: approvedDebtors.length,
          total_exposure: approvedDebtors.reduce((sum, d) => sum + (d.outstanding_amount || 0), 0),
          total_premium: approvedDebtors.reduce((sum, d) => sum + (d.gross_premium || 0), 0),
          currency: 'IDR',
          status: 'GENERATED'
        });
      }

      // Generate Nota when moving to Nota Issued
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

        // Create Invoice
        const invoiceNumber = `INV-${selectedBatch.batch_id}-${Date.now()}`;
        await base44.entities.Invoice.create({
          invoice_number: invoiceNumber,
          contract_id: selectedBatch.contract_id,
          period: `${selectedBatch.batch_year}-${String(selectedBatch.batch_month).padStart(2, '0')}`,
          total_amount: selectedBatch.total_premium || 0,
          outstanding_amount: selectedBatch.total_premium || 0,
          currency: 'IDR',
          status: 'ISSUED'
        });

        // Update debtors with invoice reference
        for (const debtor of approvedDebtors) {
          await base44.entities.Debtor.update(debtor.id, {
            invoice_no: invoiceNumber,
            invoice_amount: debtor.gross_premium || 0,
            invoice_status: 'ISSUED'
          });
        }
      }

      // Create Reconciliation when moving to Paid
      if (nextStatus === 'Paid') {
        const reconId = `RECON-${selectedBatch.contract_id}-${selectedBatch.batch_year}-${String(selectedBatch.batch_month).padStart(2, '0')}`;
        const existingRecon = await base44.entities.Reconciliation.filter({ 
          contract_id: selectedBatch.contract_id,
          period: `${selectedBatch.batch_year}-${String(selectedBatch.batch_month).padStart(2, '0')}`
        });

        if (existingRecon.length === 0) {
          await base44.entities.Reconciliation.create({
            recon_id: reconId,
            contract_id: selectedBatch.contract_id,
            period: `${selectedBatch.batch_year}-${String(selectedBatch.batch_month).padStart(2, '0')}`,
            total_invoiced: selectedBatch.total_premium || 0,
            total_paid: selectedBatch.total_premium || 0,
            difference: 0,
            currency: 'IDR',
            status: 'READY_TO_CLOSE'
          });
        }

        for (const debtor of approvedDebtors) {
          await base44.entities.Debtor.update(debtor.id, {
            recon_status: 'READY_TO_CLOSE'
          });
        }
      }

      const targetRole = nextStatus === 'Nota Issued' ? 'BRINS' :
                        nextStatus === 'Branch Confirmed' ? 'TUGURE' : 'ALL';

      await sendTemplatedEmail(
        'Batch',
        selectedBatch.status,
        nextStatus,
        targetRole,
        'notify_batch_status',
        {
          batch_id: selectedBatch.batch_id,
          total_records: selectedBatch.total_records,
          total_exposure: `Rp ${(selectedBatch.total_exposure || 0).toLocaleString('id-ID')}`,
          total_premium: `Rp ${(selectedBatch.total_premium || 0).toLocaleString('id-ID')}`,
          user_name: user?.email,
          date: new Date().toLocaleDateString('id-ID')
        }
      );

      await createNotification(
        `Batch ${nextStatus}`,
        `Batch ${selectedBatch.batch_id} moved to ${nextStatus}`,
        'INFO',
        'DEBTOR',
        selectedBatch.id,
        targetRole
      );

      await createAuditLog(
        `BATCH_${nextStatus.toUpperCase().replace(' ', '_')}`,
        'DEBTOR',
        'Batch',
        selectedBatch.id,
        { status: selectedBatch.status },
        { status: nextStatus },
        user?.email,
        user?.role,
        remarks
      );

      setSuccessMessage(`Batch processed to ${nextStatus} successfully`);
      setShowActionDialog(false);
      setSelectedBatch(null);
      setRemarks('');
      loadData();
    } catch (error) {
      console.error('Action error:', error);
    }
    setProcessing(false);
  };

  const handleBulkAction = async () => {
    if (selectedBatches.length === 0) return;

    setProcessing(true);
    try {
      const batchesToProcess = batches.filter(b => selectedBatches.includes(b.id));
      
      for (const batch of batchesToProcess) {
        const nextStatus = getNextStatus(batch.status);
        if (!nextStatus) continue;

        const statusField = getStatusField(nextStatus);
        await base44.entities.Batch.update(batch.id, {
          status: nextStatus,
          [statusField.by]: user?.email,
          [statusField.date]: new Date().toISOString().split('T')[0]
        });

        await createAuditLog(
          `BATCH_BULK_${nextStatus.toUpperCase().replace(' ', '_')}`,
          'DEBTOR',
          'Batch',
          batch.id,
          { status: batch.status },
          { status: nextStatus },
          user?.email,
          user?.role,
          'Bulk operation'
        );
      }

      setSuccessMessage(`${batchesToProcess.length} batches processed successfully`);
      setShowBulkDialog(false);
      setSelectedBatches([]);
      loadData();
    } catch (error) {
      console.error('Bulk action error:', error);
    }
    setProcessing(false);
  };

  const handleRejectBatch = async () => {
    if (!selectedBatch || !remarks) return;

    setProcessing(true);
    try {
      await base44.entities.Batch.update(selectedBatch.id, {
        status: 'Rejected',
        rejection_reason: remarks
      });

      await createNotification(
        'Batch Rejected',
        `Batch ${selectedBatch.batch_id} rejected: ${remarks}`,
        'WARNING',
        'DEBTOR',
        selectedBatch.id,
        'BRINS'
      );

      await createAuditLog(
        'BATCH_REJECTED',
        'DEBTOR',
        'Batch',
        selectedBatch.id,
        { status: selectedBatch.status },
        { status: 'Rejected', reason: remarks },
        user?.email,
        user?.role,
        remarks
      );

      setSuccessMessage('Batch rejected - BRINS can revise and resubmit');
      setShowRejectDialog(false);
      setRemarks('');
      loadData();
    } catch (error) {
      console.error('Reject error:', error);
    }
    setProcessing(false);
  };

  const toggleBatchSelection = (batchId) => {
    if (selectedBatches.includes(batchId)) {
      setSelectedBatches(selectedBatches.filter(id => id !== batchId));
    } else {
      setSelectedBatches([...selectedBatches, batchId]);
    }
  };

  const filteredBatches = batches.filter(b => {
    if (filters.contract !== 'all' && b.contract_id !== filters.contract) return false;
    if (filters.batch && !b.batch_id.includes(filters.batch)) return false;
    if (filters.status !== 'all' && b.status !== filters.status) return false;
    return true;
  });

  const columns = [
    {
      header: (
        <Checkbox
          checked={selectedBatches.length === filteredBatches.length && filteredBatches.length > 0}
          onCheckedChange={(checked) => {
            if (checked) {
              setSelectedBatches(filteredBatches.map(b => b.id));
            } else {
              setSelectedBatches([]);
            }
          }}
        />
      ),
      cell: (row) => (
        <Checkbox
          checked={selectedBatches.includes(row.id)}
          onCheckedChange={() => toggleBatchSelection(row.id)}
        />
      ),
      width: '40px'
    },
    {
      header: 'Batch ID',
      cell: (row) => (
        <div>
          <p className="font-medium font-mono">{row.batch_id}</p>
          <p className="text-xs text-gray-500">{row.batch_month}/{row.batch_year} • v{row.version || 1}</p>
        </div>
      )
    },
    { header: 'Records', accessorKey: 'total_records' },
    { header: 'Exposure', cell: (row) => `Rp ${((row.total_exposure || 0) / 1000000).toFixed(1)}M` },
    { header: 'Premium', cell: (row) => `Rp ${((row.total_premium || 0) / 1000000).toFixed(1)}M` },
    { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
    {
      header: 'Processed By',
      cell: (row) => {
        const field = getStatusField(row.status);
        return row[field.by] ? (
          <div className="text-xs">
            <p>{row[field.by]}</p>
            <p className="text-gray-500">{row[field.date]}</p>
          </div>
        ) : '-';
      }
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setSelectedBatch(row);
              setShowViewDialog(true);
            }}
          >
            <Eye className="w-4 h-4" />
          </Button>
          {row.status !== 'Closed' && row.status !== 'Rejected' && getNextStatus(row.status) && (
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
          {row.status === 'Matched' && (
            <Button 
              size="sm" 
              variant="destructive"
              onClick={() => {
                setSelectedBatch(row);
                setShowRejectDialog(true);
              }}
            >
              <X className="w-4 h-4 mr-1" />
              Reject
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
        subtitle="Process batch submissions through workflow"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Batch Processing' }
        ]}
        actions={
          <div className="flex gap-2">
            {selectedBatches.length > 0 && (
              <Button 
                className="bg-blue-600"
                onClick={() => setShowBulkDialog(true)}
              >
                <Check className="w-4 h-4 mr-2" />
                Process ({selectedBatches.length})
              </Button>
            )}
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
        <StatCard title="Total Batches" value={batches.length} icon={FileText} />
        <StatCard title="Validated" value={batches.filter(b => b.status === 'Validated').length} icon={CheckCircle2} className="text-green-600" />
        <StatCard title="Approved" value={batches.filter(b => b.status === 'Approved').length} icon={CheckCircle2} className="text-blue-600" />
        <StatCard title="Rejected" value={batches.filter(b => b.status === 'Rejected').length} icon={AlertCircle} className="text-red-600" />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4">
            <Select value={filters.contract} onValueChange={(val) => setFilters({...filters, contract: val})}>
              <SelectTrigger><SelectValue placeholder="Contract" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {contracts.map(c => (<SelectItem key={c.id} value={c.id}>{c.contract_number}</SelectItem>))}
              </SelectContent>
            </Select>
            <Input placeholder="Batch..." value={filters.batch} onChange={(e) => setFilters({...filters, batch: e.target.value})} />
            <Select value={filters.status} onValueChange={(val) => setFilters({...filters, status: val})}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Uploaded">Uploaded</SelectItem>
                <SelectItem value="Validated">Validated</SelectItem>
                <SelectItem value="Matched">Matched</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <DataTable columns={columns} data={filteredBatches} isLoading={loading} />

      {/* Action Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionType} Batch</DialogTitle>
            <DialogDescription>{selectedBatch?.batch_id}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">Remarks</label>
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActionDialog(false)}>Cancel</Button>
            <Button onClick={handleBatchAction} disabled={processing} className="bg-blue-600">
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Batch</DialogTitle>
            <DialogDescription>{selectedBatch?.batch_id}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Rejecting batch allows BRINS to revise and resubmit. All debtors will be marked inactive.
              </AlertDescription>
            </Alert>
            <label className="text-sm font-medium">Rejection Reason *</label>
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Enter reason..." rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRejectDialog(false); setRemarks(''); }}>Cancel</Button>
            <Button onClick={handleRejectBatch} disabled={processing || !remarks} variant="destructive">
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Reject Batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process {selectedBatches.length} Batches</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                All selected batches will be moved to their next workflow status
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDialog(false)}>Cancel</Button>
            <Button onClick={handleBulkAction} disabled={processing} className="bg-blue-600">
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Process
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batch Details</DialogTitle>
            <DialogDescription>{selectedBatch?.batch_id}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Records:</span><span className="ml-2 font-medium">{selectedBatch?.total_records}</span></div>
              <div><span className="text-gray-500">Exposure:</span><span className="ml-2 font-medium">Rp {(selectedBatch?.total_exposure || 0).toLocaleString()}</span></div>
              <div><span className="text-gray-500">Premium:</span><span className="ml-2 font-medium">Rp {(selectedBatch?.total_premium || 0).toLocaleString()}</span></div>
              <div><span className="text-gray-500">Status:</span><StatusBadge status={selectedBatch?.status} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowViewDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}