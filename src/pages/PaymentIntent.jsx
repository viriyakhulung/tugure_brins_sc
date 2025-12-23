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
  RefreshCw, Loader2, Eye, FileText, AlertCircle, Check, X
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import FilterPanel from "@/components/common/FilterPanel";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import ExportButton from "@/components/common/ExportButton";
import { format } from 'date-fns';

export default function PaymentIntent() {
  const [user, setUser] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [paymentIntents, setPaymentIntents] = useState([]);
  const [debtors, setDebtors] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [selectedIntent, setSelectedIntent] = useState(null);
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
    if (selectedDebtors.length === 0 || !plannedAmount || !plannedDate) return;

    setProcessing(true);
    try {
      const intentId = `PI-${Date.now()}`;
      const selectedDebtorsList = approvedDebtors.filter(d => d && selectedDebtors.includes(d.id));
      
      if (selectedDebtorsList.length === 0) {
        setProcessing(false);
        return;
      }
      
      // Get proper Invoice entity (not just invoice_no string)
      const firstDebtor = selectedDebtorsList[0];
      const invoicesList = await base44.entities.Invoice.filter({ 
        contract_id: firstDebtor.contract_id 
      });
      const relatedInvoice = invoicesList.find(inv => 
        selectedDebtorsList.some(d => d.invoice_no === inv.invoice_number)
      );

      // 1. Create Payment Intent with proper Invoice entity ID
      const paymentIntent = await base44.entities.PaymentIntent.create({
        intent_id: intentId,
        invoice_id: relatedInvoice?.id || null,
        contract_id: firstDebtor.contract_id,
        payment_type: paymentType,
        planned_amount: parseFloat(plannedAmount),
        planned_date: plannedDate,
        remarks: remarks,
        status: 'DRAFT'
      });

      // 2. Update selected Debtors - DO NOT create Payment yet
      for (const debtor of selectedDebtorsList) {
        await base44.entities.Debtor.update(debtor.id, {
          recon_status: 'IN_PROGRESS'
        });
      }

      // Send email notifications
      const notifSettings = await base44.entities.NotificationSetting.list();
      const tugureSettings = notifSettings.filter(s => s.user_role === 'TUGURE' && s.email_enabled && s.notify_on_payment);
      
      for (const setting of tugureSettings) {
        await base44.integrations.Core.SendEmail({
          to: setting.notification_email,
          subject: `Payment Intent Submitted - ${intentId}`,
          body: `Payment intent has been submitted.\n\nIntent ID: ${intentId}\nPayment Type: ${paymentType}\nPlanned Amount: Rp ${parseFloat(plannedAmount).toLocaleString('id-ID')}\nPlanned Date: ${plannedDate}\nSelected Debtors: ${selectedDebtors.length}\nRemarks: ${remarks}\n\nPlease review.`
        });
      }

      await base44.entities.Notification.create({
        title: 'Payment Intent Submitted',
        message: `Payment intent of Rp ${parseFloat(plannedAmount).toLocaleString('id-ID')} submitted for ${selectedDebtors.length} debtors`,
        type: 'INFO',
        module: 'PAYMENT',
        reference_id: intentId,
        target_role: 'TUGURE'
      });

      setSuccessMessage('Payment intent created successfully');
      setShowCreateDialog(false);
      setSelectedDebtors([]);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Create error:', error);
    }
    setProcessing(false);
  };

  const resetForm = () => {
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

  const approvedDebtors = debtors.filter(d => d.underwriting_status === 'APPROVED');
  const selectedTotal = approvedDebtors
    .filter(d => selectedDebtors.includes(d.id))
    .reduce((sum, d) => sum + (d.net_premium || 0), 0);

  const debtorColumns = [
    {
      header: (
        <Checkbox
          checked={selectedDebtors.length === approvedDebtors.filter(d => d.recon_status !== 'CLOSED').length && approvedDebtors.filter(d => d.recon_status !== 'CLOSED').length > 0}
          onCheckedChange={(checked) => {
            if (checked) {
              setSelectedDebtors(approvedDebtors.filter(d => d.recon_status !== 'CLOSED').map(d => d.id));
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
          disabled={row.recon_status === 'CLOSED'}
        />
      ),
      width: '40px'
    },
    {
      header: 'Debtor',
      cell: (row) => (
        <div>
          <p className="font-medium">{row.debtor_name}</p>
          <p className="text-sm text-gray-500">{row.batch_id?.slice(0, 15)}</p>
        </div>
      )
    },
    { header: 'Plafond', cell: (row) => `Rp ${(row.credit_plafond || 0).toLocaleString('id-ID')}` },
    { header: 'Net Premium', cell: (row) => `Rp ${(row.net_premium || 0).toLocaleString('id-ID')}` },
    { header: 'Invoice No', cell: (row) => row.invoice_no || '-' },
    { header: 'Invoice Status', cell: (row) => <StatusBadge status={row.invoice_status} /> },
    { header: 'Recon Status', cell: (row) => <StatusBadge status={row.recon_status} /> }
  ];

  const handleSubmitIntent = async (intent) => {
    setProcessing(true);
    try {
      await base44.entities.PaymentIntent.update(intent.id, {
        status: 'SUBMITTED'
      });
      await base44.entities.Notification.create({
        title: 'Payment Intent Submitted for Approval',
        message: `Payment intent ${intent.intent_id} submitted - IDR ${(intent.planned_amount || 0).toLocaleString()}`,
        type: 'ACTION_REQUIRED',
        module: 'PAYMENT',
        reference_id: intent.intent_id,
        target_role: 'TUGURE'
      });
      setSuccessMessage('Payment intent submitted for approval');
      setShowSubmitDialog(false);
      loadData();
    } catch (error) {
      console.error('Submit error:', error);
    }
    setProcessing(false);
  };

  const handleApproveIntent = async (intent) => {
    setProcessing(true);
    try {
      await base44.entities.PaymentIntent.update(intent.id, {
        status: 'APPROVED'
      });
      await base44.entities.Notification.create({
        title: 'Payment Intent Approved',
        message: `Payment intent ${intent.intent_id} approved - IDR ${(intent.planned_amount || 0).toLocaleString()}`,
        type: 'INFO',
        module: 'PAYMENT',
        reference_id: intent.intent_id,
        target_role: 'BRINS'
      });
      setSuccessMessage('Payment intent approved - now available for matching in Reconciliation');
      loadData();
    } catch (error) {
      console.error('Approve error:', error);
    }
    setProcessing(false);
  };

  const handleRejectIntent = async (intent) => {
    setProcessing(true);
    try {
      await base44.entities.PaymentIntent.update(intent.id, {
        status: 'REJECTED'
      });
      await base44.entities.Notification.create({
        title: 'Payment Intent Rejected',
        message: `Payment intent ${intent.intent_id} rejected`,
        type: 'WARNING',
        module: 'PAYMENT',
        reference_id: intent.intent_id,
        target_role: 'BRINS'
      });
      setSuccessMessage('Payment intent rejected');
      loadData();
    } catch (error) {
      console.error('Reject error:', error);
    }
    setProcessing(false);
  };

  const isBrins = user?.role === 'BRINS' || user?.role === 'admin';
  const isTugure = user?.role === 'TUGURE' || user?.role === 'admin';

  const [selectedIntents, setSelectedIntents] = useState([]);

  const toggleIntentSelection = (intentId) => {
    if (selectedIntents.includes(intentId)) {
      setSelectedIntents(selectedIntents.filter(id => id !== intentId));
    } else {
      setSelectedIntents([...selectedIntents, intentId]);
    }
  };

  const handleBulkApprove = async () => {
    setProcessing(true);
    try {
      for (const intentId of selectedIntents) {
        await base44.entities.PaymentIntent.update(intentId, {
          status: 'APPROVED'
        });
      }
      setSuccessMessage(`${selectedIntents.length} payment intents approved`);
      setSelectedIntents([]);
      loadData();
    } catch (error) {
      console.error('Bulk approve error:', error);
    }
    setProcessing(false);
  };

  const intentColumns = [
    {
      header: (
        <Checkbox
          checked={selectedIntents.length === paymentIntents.filter(p => p.status === 'SUBMITTED').length && paymentIntents.filter(p => p.status === 'SUBMITTED').length > 0}
          onCheckedChange={(checked) => {
            if (checked) {
              setSelectedIntents(paymentIntents.filter(p => p.status === 'SUBMITTED').map(p => p.id));
            } else {
              setSelectedIntents([]);
            }
          }}
        />
      ),
      cell: (row) => (
        <Checkbox
          checked={selectedIntents.includes(row.id)}
          onCheckedChange={() => toggleIntentSelection(row.id)}
          disabled={row.status !== 'SUBMITTED'}
        />
      ),
      width: '50px'
    },
    { header: 'Intent ID', accessorKey: 'intent_id' },
    { 
      header: 'Batch', 
      cell: (row) => {
        const debtor = debtors.find(d => d.invoice_no && invoices.find(inv => inv.id === row.invoice_id)?.invoice_number === d.invoice_no);
        return debtor?.batch_id || '-';
      }
    },
    { header: 'Payment Type', cell: (row) => <StatusBadge status={row.payment_type} /> },
    { header: 'Planned Amount', cell: (row) => `IDR ${(row.planned_amount || 0).toLocaleString()}` },
    { header: 'Planned Date', accessorKey: 'planned_date' },
    { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Eye className="w-4 h-4" />
          </Button>
          {row.status === 'DRAFT' && isBrins && (
            <Button 
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                setSelectedIntent(row);
                setShowSubmitDialog(true);
              }}
            >
              Submit
            </Button>
          )}
          {row.status === 'SUBMITTED' && isTugure && (
            <>
              <Button 
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => handleApproveIntent(row)}
              >
                Approve
              </Button>
              <Button 
                size="sm"
                variant="outline"
                className="border-red-500 text-red-600 hover:bg-red-50"
                onClick={() => handleRejectIntent(row)}
              >
                Reject
              </Button>
            </>
          )}
          {row.status === 'APPROVED' && (
            <span className="text-xs text-green-600">Ready for Matching</span>
          )}
          {row.status === 'COMPLETED' && (
            <span className="text-xs text-gray-500">Matched</span>
          )}
        </div>
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
            {selectedIntents.length > 0 && isTugure && (
              <Button 
                className="bg-green-600 hover:bg-green-700"
                onClick={handleBulkApprove}
                disabled={processing}
              >
                <Check className="w-4 h-4 mr-2" />
                Bulk Approve ({selectedIntents.length})
              </Button>
            )}
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button 
              variant="outline"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => {
                const data = selectedDebtors.length > 0 ? approvedDebtors.filter(d => selectedDebtors.includes(d.id)) : approvedDebtors;
                const csv = [
                  ['Debtor', 'Batch', 'Plafond', 'Net Premium', 'Invoice Status'].join(','),
                  ...data.map(d => [d.debtor_name, d.batch_id, d.credit_plafond, d.net_premium, d.invoice_status].join(','))
                ].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'payment-intent.csv';
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

      {/* Submit Confirmation Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Payment Intent</DialogTitle>
            <DialogDescription>
              Submit {selectedIntent?.intent_id} for approval
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">
              Once submitted, this payment intent will be sent to TUGURE for approval. 
              After approval, it will be available for matching in the Reconciliation module.
            </p>
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm"><span className="text-gray-500">Amount:</span> <span className="font-medium">IDR {(selectedIntent?.planned_amount || 0).toLocaleString()}</span></p>
              <p className="text-sm mt-1"><span className="text-gray-500">Planned Date:</span> <span className="font-medium">{selectedIntent?.planned_date}</span></p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => handleSubmitIntent(selectedIntent)}
              disabled={processing}
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
                  Submit for Approval
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              disabled={processing || !plannedAmount || !plannedDate || selectedDebtors.length === 0}
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