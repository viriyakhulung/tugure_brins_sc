import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CheckCircle2, RefreshCw, ArrowRight, Loader2, Eye, Download, FileText, Clock, DollarSign
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import StatCard from "@/components/dashboard/StatCard";
import { sendTemplatedEmail, createNotification, createAuditLog } from "@/components/utils/emailTemplateHelper";

export default function NotaManagement() {
  const [user, setUser] = useState(null);
  const [notas, setNotas] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNota, setSelectedNota] = useState(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState('');
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [remarks, setRemarks] = useState('');
  const [filters, setFilters] = useState({
    contract: 'all',
    notaType: 'all',
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
      const [notaData, contractData] = await Promise.all([
        base44.entities.Nota.list('-created_date'),
        base44.entities.Contract.list()
      ]);
      setNotas(notaData || []);
      setContracts(contractData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  const getNextStatus = (currentStatus) => {
    const workflow = ['Draft', 'Issued', 'Confirmed', 'Paid'];
    const currentIndex = workflow.indexOf(currentStatus);
    return currentIndex >= 0 && currentIndex < workflow.length - 1 ? workflow[currentIndex + 1] : null;
  };

  const getActionLabel = (status) => {
    const labels = {
      'Draft': 'Issue',
      'Issued': 'Confirm',
      'Confirmed': 'Mark Paid'
    };
    return labels[status] || 'Process';
  };

  const handleNotaAction = async () => {
    if (!selectedNota || !actionType) return;

    setProcessing(true);
    try {
      const nextStatus = getNextStatus(selectedNota.status);
      if (!nextStatus) {
        setProcessing(false);
        return;
      }

      const updateData = { status: nextStatus };
      
      if (nextStatus === 'Issued') {
        updateData.issued_by = user?.email;
        updateData.issued_date = new Date().toISOString().split('T')[0];
      } else if (nextStatus === 'Confirmed') {
        updateData.confirmed_by = user?.email;
        updateData.confirmed_date = new Date().toISOString().split('T')[0];
      } else if (nextStatus === 'Paid') {
        updateData.paid_date = new Date().toISOString().split('T')[0];
        updateData.payment_reference = remarks;
      }

      // 1. Update Nota
      await base44.entities.Nota.update(selectedNota.id, updateData);

      // 2. CRITICAL: Sync Debtor invoice_status if Nota is for Batch
      if (selectedNota.nota_type === 'Batch' && selectedNota.reference_id) {
        const batchDebtors = await base44.entities.Debtor.filter({ batch_id: selectedNota.reference_id });
        
        // When Nota is marked as Paid - this triggers reconciliation completion
        if (nextStatus === 'Paid') {
          // Update Invoice to PAID
          const invoices = await base44.entities.Invoice.filter({ contract_id: selectedNota.contract_id });
          const relatedInvoice = invoices.find(inv => 
            batchDebtors.some(d => d.invoice_no === inv.invoice_number)
          );
          
          if (relatedInvoice) {
            await base44.entities.Invoice.update(relatedInvoice.id, {
              paid_amount: relatedInvoice.total_amount,
              outstanding_amount: 0,
              status: 'PAID'
            });

            // Create Payment record
            await base44.entities.Payment.create({
              payment_ref: `PAY-${selectedNota.nota_number}-${Date.now()}`,
              invoice_id: relatedInvoice.id,
              contract_id: selectedNota.contract_id,
              amount: selectedNota.amount,
              payment_date: new Date().toISOString().split('T')[0],
              currency: 'IDR',
              match_status: 'MATCHED',
              exception_type: 'NONE'
            });
          }

          // Update all debtors to PAID and CLOSED recon
          for (const debtor of batchDebtors) {
            await base44.entities.Debtor.update(debtor.id, {
              invoice_status: 'PAID',
              payment_received_amount: debtor.invoice_amount || debtor.net_premium || 0,
              recon_status: 'CLOSED'
            });
          }
        } else {
          // For other status changes, just update invoice_status
          const invoiceStatus = nextStatus === 'Issued' ? 'ISSUED' : 'NOT_ISSUED';
          for (const debtor of batchDebtors) {
            await base44.entities.Debtor.update(debtor.id, {
              invoice_status: invoiceStatus
            });
          }
        }
      }

      // 3. Determine target role based on nota type and status
      const targetRole = nextStatus === 'Issued' ? 'BRINS' :
                        nextStatus === 'Confirmed' ? 'TUGURE' :
                        'ALL';

      // 4. Send templated emails based on user preferences
      await sendTemplatedEmail(
        'Nota',
        selectedNota.status,
        nextStatus,
        targetRole,
        'notify_nota_status',
        {
          nota_number: selectedNota.nota_number,
          nota_type: selectedNota.nota_type,
          reference_id: selectedNota.reference_id,
          amount: `Rp ${(selectedNota.amount || 0).toLocaleString('id-ID')}`,
          date: new Date().toLocaleDateString('id-ID'),
          user_name: user?.email || 'System',
          payment_reference: remarks || ''
        }
      );

      // 5. Create system notification
      await createNotification(
        `Nota ${nextStatus}`,
        `Nota ${selectedNota.nota_number} (${selectedNota.nota_type}) moved to ${nextStatus}`,
        nextStatus === 'Issued' ? 'ACTION_REQUIRED' : 'INFO',
        'DEBTOR',
        selectedNota.id,
        targetRole
      );

      // 6. Create audit log
      await createAuditLog(
        `NOTA_${nextStatus.toUpperCase()}`,
        'DEBTOR',
        'Nota',
        selectedNota.id,
        { status: selectedNota.status },
        { status: nextStatus },
        user?.email,
        user?.role,
        remarks
      );

      setSuccessMessage(`Nota moved to ${nextStatus} successfully`);
      setShowActionDialog(false);
      setSelectedNota(null);
      setRemarks('');
      loadData();
    } catch (error) {
      console.error('Action error:', error);
    }
    setProcessing(false);
  };

  const filteredNotas = notas.filter(n => {
    if (filters.contract !== 'all' && n.contract_id !== filters.contract) return false;
    if (filters.notaType !== 'all' && n.nota_type !== filters.notaType) return false;
    if (filters.status !== 'all' && n.status !== filters.status) return false;
    return true;
  });

  const columns = [
    {
      header: 'Nota Number',
      cell: (row) => (
        <div>
          <p className="font-medium font-mono">{row.nota_number}</p>
          <p className="text-xs text-gray-500">{row.nota_type}</p>
        </div>
      )
    },
    { 
      header: 'Reference',
      cell: (row) => <span className="text-sm">{row.reference_id}</span>
    },
    { header: 'Amount', cell: (row) => `Rp ${(row.amount || 0).toLocaleString('id-ID')}` },
    { header: 'Currency', accessorKey: 'currency' },
    { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
    {
      header: 'Issued Info',
      cell: (row) => {
        if (!row.issued_by) return '-';
        return (
          <div className="text-xs">
            <p>{row.issued_by}</p>
            <p className="text-gray-500">{row.issued_date}</p>
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
            onClick={() => setSelectedNota(row)}
          >
            <Eye className="w-4 h-4" />
          </Button>
          {row.status !== 'Paid' && getNextStatus(row.status) && (
            <Button 
              size="sm" 
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                setSelectedNota(row);
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
        title="Nota Management"
        subtitle="Process notas through workflow stages"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Nota Management' }
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button 
              variant="outline" 
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => {
                const csv = [
                  ['Nota Number', 'Type', 'Reference', 'Amount', 'Currency', 'Status'].join(','),
                  ...filteredNotas.map(n => [n.nota_number, n.nota_type, n.reference_id, n.amount, n.currency, n.status].join(','))
                ].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `notas-${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
              }}
            >
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
          title="Total Notas"
          value={notas.length}
          subtitle={`${notas.filter(n => n.nota_type === 'Batch').length} batch / ${notas.filter(n => n.nota_type === 'Claim').length} claim`}
          icon={FileText}
          gradient
          className="from-blue-500 to-blue-600"
        />
        <StatCard
          title="Pending Confirmation"
          value={notas.filter(n => n.status === 'Issued').length}
          subtitle="Awaiting branch"
          icon={Clock}
          gradient
          className="from-orange-500 to-orange-600"
        />
        <StatCard
          title="Total Amount"
          value={`Rp ${(notas.reduce((sum, n) => sum + (n.amount || 0), 0) / 1000000).toFixed(1)}M`}
          subtitle="All notas"
          icon={DollarSign}
          gradient
          className="from-green-500 to-green-600"
        />
        <StatCard
          title="Paid Notas"
          value={notas.filter(n => n.status === 'Paid').length}
          subtitle={`Rp ${(notas.filter(n => n.status === 'Paid').reduce((sum, n) => sum + (n.amount || 0), 0) / 1000000).toFixed(1)}M`}
          icon={CheckCircle2}
          gradient
          className="from-purple-500 to-purple-600"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <Select value={filters.notaType} onValueChange={(val) => setFilters({...filters, notaType: val})}>
              <SelectTrigger>
                <SelectValue placeholder="Nota Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Batch">Batch</SelectItem>
                <SelectItem value="Claim">Claim</SelectItem>
                <SelectItem value="Subrogation">Subrogation</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.status} onValueChange={(val) => setFilters({...filters, status: val})}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Issued">Issued</SelectItem>
                <SelectItem value="Confirmed">Confirmed</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setFilters({ contract: 'all', notaType: 'all', status: 'all' })}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={filteredNotas}
        isLoading={loading}
        emptyMessage="No notas found"
      />

      {/* Action Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionType} Nota</DialogTitle>
            <DialogDescription>
              Move nota {selectedNota?.nota_number} from {selectedNota?.status} to {getNextStatus(selectedNota?.status)}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Type:</span>
                  <span className="ml-2 font-medium">{selectedNota?.nota_type}</span>
                </div>
                <div>
                  <span className="text-gray-500">Amount:</span>
                  <span className="ml-2 font-medium">Rp {(selectedNota?.amount || 0).toLocaleString('id-ID')}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Reference:</span>
                  <span className="ml-2 font-medium">{selectedNota?.reference_id}</span>
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">
                {getNextStatus(selectedNota?.status) === 'Paid' ? 'Payment Reference' : 'Remarks'}
              </label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder={getNextStatus(selectedNota?.status) === 'Paid' ? 'Enter payment reference...' : 'Enter remarks...'}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActionDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleNotaAction}
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