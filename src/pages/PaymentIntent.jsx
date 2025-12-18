import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  DollarSign, Plus, Send, CheckCircle2, Download, 
  RefreshCw, Loader2, Eye, FileText
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import FilterPanel from "@/components/common/FilterPanel";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import { format } from 'date-fns';

export default function PaymentIntent() {
  const [invoices, setInvoices] = useState([]);
  const [paymentIntents, setPaymentIntents] = useState([]);
  const [debtors, setDebtors] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedDebtors, setSelectedDebtors] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [filters, setFilters] = useState({
    contract: 'all',
    batch: '',
    submitStatus: 'all',
    reconStatus: 'all',
    paymentStatus: 'all'
  });

  // Form state
  const [paymentType, setPaymentType] = useState('FULL');
  const [plannedAmount, setPlannedAmount] = useState('');
  const [plannedDate, setPlannedDate] = useState('');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invoiceData, intentData, debtorData, contractData] = await Promise.all([
        base44.entities.Invoice.list(),
        base44.entities.PaymentIntent.list(),
        base44.entities.Debtor.list(),
        base44.entities.Contract.list()
      ]);
      setInvoices(invoiceData || []);
      setPaymentIntents(intentData || []);
      setDebtors(debtorData || []);
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
      paymentStatus: 'all'
    });
  };

  const handleCreateIntent = async () => {
    if (!selectedInvoice || !plannedAmount || !plannedDate) return;

    setProcessing(true);
    try {
      await base44.entities.PaymentIntent.create({
        intent_id: `PI-${Date.now()}`,
        invoice_id: selectedInvoice.id,
        contract_id: selectedInvoice.contract_id,
        payment_type: paymentType,
        planned_amount: parseFloat(plannedAmount),
        planned_date: plannedDate,
        remarks: remarks,
        status: 'SUBMITTED'
      });

      await base44.entities.Notification.create({
        title: 'Payment Intent Submitted',
        message: `Payment intent of IDR ${parseFloat(plannedAmount).toLocaleString()} submitted for invoice ${selectedInvoice.invoice_number}`,
        type: 'INFO',
        module: 'PAYMENT',
        reference_id: selectedInvoice.id,
        target_role: 'TUGURE'
      });

      setSuccessMessage('Payment intent created successfully');
      setShowCreateDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Create error:', error);
    }
    setProcessing(false);
  };

  const resetForm = () => {
    setSelectedInvoice(null);
    setPaymentType('FULL');
    setPlannedAmount('');
    setPlannedDate('');
    setRemarks('');
  };

  const toggleDebtorSelection = (debtorId) => {
    if (selectedDebtors.includes(debtorId)) {
      setSelectedDebtors(selectedDebtors.filter(id => id !== debtorId));
    } else {
      setSelectedDebtors([...selectedDebtors, debtorId]);
    }
  };

  const handleExportSelected = () => {
    console.log('Exporting selected debtors:', selectedDebtors);
    // Export functionality
  };

  const approvedDebtors = debtors.filter(d => d.submit_status === 'APPROVED');
  const selectedTotal = approvedDebtors
    .filter(d => selectedDebtors.includes(d.id))
    .reduce((sum, d) => sum + (d.net_premi || 0), 0);

  const debtorColumns = [
    {
      header: '',
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
          <p className="font-medium">{row.nama_peserta}</p>
          <p className="text-sm text-gray-500">{row.batch_id?.slice(0, 15)}</p>
        </div>
      )
    },
    { header: 'Plafon', cell: (row) => `IDR ${(row.plafon || 0).toLocaleString()}` },
    { header: 'Net Premi', cell: (row) => `IDR ${(row.net_premi || 0).toLocaleString()}` },
    { header: 'Submit Status', cell: (row) => <StatusBadge status={row.submit_status} /> },
    { header: 'Exposure Status', cell: (row) => <StatusBadge status={row.exposure_status} /> }
  ];

  const intentColumns = [
    { header: 'Intent ID', accessorKey: 'intent_id' },
    { header: 'Invoice', accessorKey: 'invoice_id', cell: (row) => row.invoice_id?.slice(0, 10) },
    { header: 'Payment Type', cell: (row) => <StatusBadge status={row.payment_type} /> },
    { header: 'Planned Amount', cell: (row) => `IDR ${(row.planned_amount || 0).toLocaleString()}` },
    { header: 'Planned Date', accessorKey: 'planned_date' },
    { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
    {
      header: 'Actions',
      cell: (row) => (
        <Button variant="outline" size="sm">
          <Eye className="w-4 h-4" />
        </Button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Intent"
        subtitle="Manage payment plans for bordero invoices"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Payment Intent' }
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            {selectedDebtors.length > 0 && (
              <Button variant="outline" onClick={handleExportSelected}>
                <Download className="w-4 h-4 mr-2" />
                Export Selected ({selectedDebtors.length})
              </Button>
            )}
          </div>
        }
      />

      {successMessage && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Selection Summary */}
      {selectedDebtors.length > 0 && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <DollarSign className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-sm text-blue-600">Selected for Payment</p>
                  <p className="text-2xl font-bold text-blue-900">
                    IDR {selectedTotal.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-blue-600">{selectedDebtors.length} debtors selected</span>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    setShowCreateDialog(true);
                    setPlannedAmount(selectedTotal.toString());
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Payment Intent
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <FilterPanel
        filters={filters}
        onFilterChange={handleFilterChange}
        onClear={clearFilters}
        contracts={contracts}
        showExport={false}
      />

      {/* Debtors List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Approved Debtors - Recon Status
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={debtorColumns}
            data={approvedDebtors}
            isLoading={loading}
            emptyMessage="No approved debtors"
          />
        </CardContent>
      </Card>

      {/* Payment Intents List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Payment Intents
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={intentColumns}
            data={paymentIntents}
            isLoading={loading}
            emptyMessage="No payment intents created yet"
          />
        </CardContent>
      </Card>

      {/* Create Payment Intent Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Payment Intent</DialogTitle>
            <DialogDescription>
              Plan payment for selected debtors
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Invoice Reference</Label>
              <Select 
                value={selectedInvoice?.id || ''} 
                onValueChange={(v) => setSelectedInvoice(invoices.find(i => i.id === v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select invoice" />
                </SelectTrigger>
                <SelectContent>
                  {invoices.map(inv => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.invoice_number} - IDR {(inv.total_amount || 0).toLocaleString()}
                    </SelectItem>
                  ))}
                  {invoices.length === 0 && (
                    <SelectItem value="new" disabled>No invoices available</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment Type</Label>
              <Select value={paymentType} onValueChange={setPaymentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL">Full Payment</SelectItem>
                  <SelectItem value="PARTIAL">Partial Payment</SelectItem>
                  <SelectItem value="INSTALMENT">Instalment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Planned Amount (IDR)</Label>
              <Input
                type="number"
                value={plannedAmount}
                onChange={(e) => setPlannedAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
            <div>
              <Label>Planned Payment Date</Label>
              <Input
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Remarks</Label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter payment remarks..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateIntent}
              disabled={processing || !plannedAmount || !plannedDate}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Intent
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}