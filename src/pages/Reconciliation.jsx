import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Scale, CheckCircle2, AlertTriangle, Clock, Eye, 
  RefreshCw, Check, X, Loader2, FileText, Link, Split, Download, Badge
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import FilterPanel from "@/components/common/FilterPanel";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import StatCard from "@/components/dashboard/StatCard";
import ExportButton from "@/components/common/ExportButton";

export default function Reconciliation() {
  const [user, setUser] = useState(null);
  const [payments, setPayments] = useState([]);
  const [reconciliations, setReconciliations] = useState([]);
  const [paymentIntents, setPaymentIntents] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDnDialog, setShowDnDialog] = useState(false);
  const [showCnDialog, setShowCnDialog] = useState(false);
  const [dnAmount, setDnAmount] = useState(0);
  const [cnAmount, setCnAmount] = useState(0);
  const [selectedNota, setSelectedNota] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [selectedPayments, setSelectedPayments] = useState([]);
  const [selectedReconciliations, setSelectedReconciliations] = useState([]);
  const [showViewPaymentDialog, setShowViewPaymentDialog] = useState(false);
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [showExceptionDialog, setShowExceptionDialog] = useState(false);
  const [showReconActionDialog, setShowReconActionDialog] = useState(false);
  const [showReconDetailDialog, setShowReconDetailDialog] = useState(false);
  const [showApproveCloseDialog, setShowApproveCloseDialog] = useState(false);
  const [selectedRecon, setSelectedRecon] = useState(null);
  const [reconAction, setReconAction] = useState('');
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [matchRemarks, setMatchRemarks] = useState('');
  const [exceptionRemarks, setExceptionRemarks] = useState('');
  const [reconRemarks, setReconRemarks] = useState('');
  const [approveCloseRemarks, setApproveCloseRemarks] = useState('');
  const [selectedIntentId, setSelectedIntentId] = useState('');
  const [filters, setFilters] = useState({
    contract: 'all',
    batch: '',
    submitStatus: 'all',
    paymentStatus: 'all',
    reconStatus: 'all'
  });

  const isTugure = user?.role === 'TUGURE' || user?.role === 'admin';

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
      const [paymentData, reconData, intentData, contractData, notaData, invoiceData] = await Promise.all([
        base44.entities.Payment.list(),
        base44.entities.Reconciliation.list(),
        base44.entities.PaymentIntent.list(),
        base44.entities.Contract.list(),
        base44.entities.Nota.list(),
        base44.entities.Invoice.list()
      ]);
      setPayments(paymentData || []);
      setReconciliations(reconData || []);
      setPaymentIntents(intentData || []);
      setContracts(contractData || []);
      
      // Build reconciliation items from Notas
      const items = [];
      for (const nota of notaData || []) {
        if (nota.nota_type !== 'Batch') continue;
        
        // Get related invoice
        const invoice = (invoiceData || []).find(inv => inv.invoice_number === nota.reference_id);
        
        // Get related payments
        const relatedPayments = (paymentData || []).filter(p => 
          p.invoice_id === nota.reference_id || p.contract_id === nota.contract_id
        );
        
        const invoiceAmount = nota.amount || 0;
        const paymentReceived = relatedPayments
          .filter(p => p.match_status === 'MATCHED')
          .reduce((sum, p) => sum + (p.amount || 0), 0);
        const difference = invoiceAmount - paymentReceived;
        
        items.push({
          id: nota.id,
          nota_id: nota.nota_number,
          batch_id: nota.reference_id,
          period: nota.reference_id?.split('-')[1] || '-',
          invoice_amount: invoiceAmount,
          payment_received: paymentReceived,
          difference: difference,
          status: nota.status,
          contract_id: nota.contract_id,
          issued_date: nota.issued_date,
          nota: nota,
          invoice: invoice,
          payments: relatedPayments,
          has_exception: Math.abs(difference) > 0 && nota.status !== 'Paid',
          is_overdue: nota.status === 'Issued' && new Date() > new Date(nota.issued_date).setDate(new Date(nota.issued_date).getDate() + 30)
        });
      }
      
      setReconciliations(items);
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
      paymentStatus: 'all',
      reconStatus: 'all'
    });
  };

  const handleAutoMatch = async () => {
    setProcessing(true);
    try {
      const unmatchedPayments = payments.filter(p => p.match_status === 'RECEIVED' || p.match_status === 'UNMATCHED');
      let matchCount = 0;
      
      for (const payment of unmatchedPayments) {
        // Find matching intent with tolerance of 1% or IDR 100K
        const matchingIntent = paymentIntents.find(i => {
          if (i.status !== 'APPROVED') return false;
          if (i.contract_id !== payment.contract_id) return false;
          
          const amountDiff = Math.abs(i.planned_amount - payment.amount);
          const tolerance = Math.max(i.planned_amount * 0.01, 100000); // 1% or 100K
          
          return amountDiff <= tolerance;
        });

        if (matchingIntent) {
          await base44.entities.Payment.update(payment.id, {
            match_status: 'MATCHED',
            intent_id: matchingIntent.intent_id,
            matched_by: user?.email,
            matched_date: new Date().toISOString().split('T')[0]
          });

          // Update Payment Intent to COMPLETED
          await base44.entities.PaymentIntent.update(matchingIntent.id, {
            status: 'COMPLETED'
          });

          matchCount++;
        }
      }

      setSuccessMessage(`Auto-matching completed: ${matchCount} payments matched`);
      loadData();
    } catch (error) {
      console.error('Auto-match error:', error);
    }
    setProcessing(false);
  };

  const handleManualMatch = async () => {
    if (!selectedPayment || !selectedIntentId) return;

    setProcessing(true);
    try {
      // 1. Get PaymentIntent (use entity ID, not intent_id string)
      const matchedIntent = paymentIntents.find(pi => pi.id === selectedIntentId);
      if (!matchedIntent) {
        alert('Payment intent not found');
        setProcessing(false);
        return;
      }

      // 2. Update payment with selected intent
      await base44.entities.Payment.update(selectedPayment.id, {
        match_status: 'MATCHED',
        intent_id: matchedIntent.intent_id,
        invoice_id: matchedIntent.invoice_id,
        matched_by: user?.email,
        matched_date: new Date().toISOString().split('T')[0]
      });

      // 3. Update Payment Intent to COMPLETED
      await base44.entities.PaymentIntent.update(matchedIntent.id, {
        status: 'COMPLETED'
      });

      // 4. Update Invoice if exists (use Invoice entity ID)
      if (matchedIntent.invoice_id) {
        const invoice = await base44.entities.Invoice.filter({ id: matchedIntent.invoice_id });
        if (invoice.length > 0) {
          const inv = invoice[0];
          const newPaidAmount = (inv.paid_amount || 0) + selectedPayment.amount;
          const newOutstanding = inv.total_amount - newPaidAmount;
          
          await base44.entities.Invoice.update(inv.id, {
            paid_amount: newPaidAmount,
            outstanding_amount: newOutstanding,
            status: newOutstanding <= 0 ? 'PAID' : 'PARTIALLY_PAID'
          });

          // 5. Update Debtors - PROPORTIONAL distribution
          const relatedDebtors = await base44.entities.Debtor.filter({ invoice_no: inv.invoice_number });
          const totalInvoiceAmount = relatedDebtors.reduce((sum, d) => sum + (d.invoice_amount || d.net_premium || 0), 0);
          
          for (const debtor of relatedDebtors) {
            const debtorInvoice = debtor.invoice_amount || debtor.net_premium || 0;
            const debtorPayment = totalInvoiceAmount > 0 ? (debtorInvoice / totalInvoiceAmount) * selectedPayment.amount : 0;
            
            await base44.entities.Debtor.update(debtor.id, {
              payment_received_amount: (debtor.payment_received_amount || 0) + debtorPayment,
              invoice_status: newOutstanding <= 0 ? 'PAID' : 'PARTIALLY_PAID',
              recon_status: newOutstanding <= 0 ? 'CLOSED' : 'IN_PROGRESS'
            });
          }

          // 6. CRITICAL: Update related Nota to Paid if Invoice fully paid
          if (newOutstanding <= 0) {
            const batchIds = [...new Set(relatedDebtors.map(d => d.batch_id))];
            for (const batchId of batchIds) {
              if (batchId) {
                const notas = await base44.entities.Nota.filter({ 
                  reference_id: batchId,
                  nota_type: 'Batch'
                });
                for (const nota of notas) {
                  if (nota.status !== 'Paid') {
                    await base44.entities.Nota.update(nota.id, {
                      status: 'Paid',
                      paid_date: new Date().toISOString().split('T')[0],
                      payment_reference: `Reconciliation Match - ${selectedPayment.payment_ref}`
                    });
                  }
                }
              }
            }
          }
        }
      }

      // 7. Create audit log
      await base44.entities.AuditLog.create({
        action: 'MANUAL_MATCH',
        module: 'RECONCILIATION',
        entity_type: 'Payment',
        entity_id: selectedPayment.id,
        user_email: user?.email,
        user_role: user?.role,
        reason: matchRemarks
      });

      setSuccessMessage('Payment matched successfully');
      setShowMatchDialog(false);
      setSelectedPayment(null);
      setSelectedIntentId('');
      setMatchRemarks('');
      loadData();
    } catch (error) {
      console.error('Match error:', error);
    }
    setProcessing(false);
  };

  const handleReconAction = async () => {
    if (!selectedRecon || !reconAction) return;

    setProcessing(true);
    try {
      const updates = { remarks: reconRemarks };
      
      if (reconAction === 'MARK_EXCEPTION') {
        updates.status = 'EXCEPTION';
      } else if (reconAction === 'READY_TO_CLOSE') {
        // Validate: difference should be 0 or acceptable
        if (Math.abs(selectedRecon.difference) > 100000) {
          alert('Cannot mark ready to close: Difference exceeds acceptable threshold (IDR 100K)');
          setProcessing(false);
          return;
        }
        updates.status = 'READY_TO_CLOSE';
      } else if (reconAction === 'CLOSE') {
        // CRITICAL: Sync with Invoice, Debtor, and Nota
        const relatedInvoices = await base44.entities.Invoice.filter({ 
          contract_id: selectedRecon.contract_id 
        });

        for (const invoice of relatedInvoices) {
          if (invoice.status !== 'PAID') {
            // Update Invoice to PAID
            await base44.entities.Invoice.update(invoice.id, {
              paid_amount: invoice.total_amount,
              outstanding_amount: 0,
              status: 'PAID'
            });

            // Update Debtors to PAID and CLOSED
            const relatedDebtors = await base44.entities.Debtor.filter({ 
              invoice_no: invoice.invoice_number 
            });
            
            for (const debtor of relatedDebtors) {
              await base44.entities.Debtor.update(debtor.id, {
                invoice_status: 'PAID',
                payment_received_amount: debtor.invoice_amount || debtor.net_premium || 0,
                recon_status: 'CLOSED'
              });
            }

            // Update related Nota to Paid
            const batchIds = [...new Set(relatedDebtors.map(d => d.batch_id).filter(Boolean))];
            for (const batchId of batchIds) {
              const notas = await base44.entities.Nota.filter({ 
                reference_id: batchId,
                nota_type: 'Batch'
              });
              
              for (const nota of notas) {
                if (nota.status !== 'Paid') {
                  await base44.entities.Nota.update(nota.id, {
                    status: 'Paid',
                    paid_date: new Date().toISOString().split('T')[0],
                    payment_reference: `Reconciliation Closed - ${selectedRecon.recon_id}`
                  });
                }
              }
            }
          }
        }

        updates.status = 'CLOSED';
        updates.closed_by = user?.email;
        updates.closed_date = new Date().toISOString().split('T')[0];
      } else if (reconAction === 'RESOLVE_EXCEPTION') {
        updates.status = 'IN_PROGRESS';
      }

      await base44.entities.Reconciliation.update(selectedRecon.id, updates);

      // Notification
      await base44.entities.Notification.create({
        title: `Reconciliation ${reconAction.replace('_', ' ')}`,
        message: `Recon ${selectedRecon.recon_id} moved to ${updates.status}`,
        type: reconAction === 'CLOSE' ? 'INFO' : 'ACTION_REQUIRED',
        module: 'RECONCILIATION',
        reference_id: selectedRecon.recon_id,
        target_role: 'ALL'
      });

      // Audit log
      await base44.entities.AuditLog.create({
        action: `RECON_${reconAction}`,
        module: 'RECONCILIATION',
        entity_type: 'Reconciliation',
        entity_id: selectedRecon.id,
        user_email: user?.email,
        user_role: user?.role,
        reason: reconRemarks
      });

      setSuccessMessage(`Reconciliation ${reconAction.toLowerCase().replace(/_/g, ' ')} successfully`);
      setShowReconActionDialog(false);
      setSelectedRecon(null);
      setReconAction('');
      setReconRemarks('');
      loadData();
    } catch (error) {
      console.error('Recon action error:', error);
    }
    setProcessing(false);
  };

  const handleMarkException = async (payment, exceptionType) => {
    setProcessing(true);
    try {
      await base44.entities.Payment.update(payment.id, {
        match_status: 'UNMATCHED',
        exception_type: exceptionType || 'PARTIAL'
      });
      
      await base44.entities.Notification.create({
        title: 'Payment Marked as Exception',
        message: `Payment ${payment.payment_ref} marked as ${exceptionType}`,
        type: 'WARNING',
        module: 'RECONCILIATION',
        reference_id: payment.payment_ref,
        target_role: 'TUGURE'
      });

      await base44.entities.AuditLog.create({
        action: 'MARK_EXCEPTION',
        module: 'RECONCILIATION',
        entity_type: 'Payment',
        entity_id: payment.id,
        user_email: user?.email,
        user_role: user?.role,
        reason: exceptionRemarks
      });
      
      setSuccessMessage('Payment marked as exception - moved to Exceptions tab');
      setShowExceptionDialog(false);
      setSelectedPayment(null);
      setExceptionRemarks('');
      setActiveTab('exceptions'); // AUTO SWITCH TO EXCEPTIONS TAB
      await loadData();
    } catch (error) {
      console.error('Exception error:', error);
    }
    setProcessing(false);
  };

  const handleClearException = async (payment) => {
    setProcessing(true);
    try {
      await base44.entities.Payment.update(payment.id, {
        match_status: 'RECEIVED',
        exception_type: 'NONE'
      });
      
      await base44.entities.Notification.create({
        title: 'Exception Cleared',
        message: `Payment ${payment.payment_ref} exception cleared`,
        type: 'INFO',
        module: 'RECONCILIATION',
        reference_id: payment.payment_ref,
        target_role: 'TUGURE'
      });

      await base44.entities.AuditLog.create({
        action: 'CLEAR_EXCEPTION',
        module: 'RECONCILIATION',
        entity_type: 'Payment',
        entity_id: payment.id,
        user_email: user?.email,
        user_role: user?.role
      });
      
      setSuccessMessage('Exception cleared - moved to Payments tab');
      setActiveTab('payments'); // AUTO SWITCH TO PAYMENTS TAB
      await loadData();
    } catch (error) {
      console.error('Clear exception error:', error);
    }
    setProcessing(false);
  };

  // Stats
  const totalInvoiced = reconciliations.reduce((sum, r) => sum + (r.invoice_amount || 0), 0);
  const totalPaid = reconciliations.reduce((sum, r) => sum + (r.payment_received || 0), 0);
  const totalDifference = totalInvoiced - totalPaid;
  const itemsWithException = reconciliations.filter(r => r.has_exception).length;
  const closedItems = reconciliations.filter(r => r.status === 'Paid').length;

  const handleCloseReconciliation = async (item) => {
    setProcessing(true);
    try {
      // Update Nota to Paid
      await base44.entities.Nota.update(item.nota.id, {
        status: 'Paid',
        paid_date: new Date().toISOString().split('T')[0],
        payment_reference: `Reconciliation Closed`
      });

      // Update Batch to Paid
      const batch = await base44.entities.Batch.filter({ batch_id: item.batch_id });
      if (batch.length > 0) {
        await base44.entities.Batch.update(batch[0].id, {
          status: 'Paid',
          paid_by: user?.email,
          paid_date: new Date().toISOString().split('T')[0]
        });
      }

      // Update related Debtors
      const debtors = await base44.entities.Debtor.filter({ batch_id: item.batch_id });
      for (const debtor of debtors) {
        await base44.entities.Debtor.update(debtor.id, {
          invoice_status: 'PAID',
          recon_status: 'CLOSED'
        });
      }

      await base44.entities.AuditLog.create({
        action: 'CLOSE_RECONCILIATION',
        module: 'RECONCILIATION',
        entity_type: 'Nota',
        entity_id: item.nota.id,
        user_email: user?.email,
        user_role: user?.role
      });

      setSuccessMessage('Reconciliation closed successfully');
      loadData();
    } catch (error) {
      console.error('Close recon error:', error);
    }
    setProcessing(false);
  };

  const handleCreateDN = async () => {
    setProcessing(true);
    try {
      // Create Debit Note as new Nota
      await base44.entities.Nota.create({
        nota_number: `DN-${selectedNota?.nota_id}-${Date.now()}`,
        nota_type: 'Batch',
        reference_id: selectedNota?.batch_id,
        contract_id: selectedNota?.contract_id,
        amount: dnAmount,
        currency: 'IDR',
        status: 'Draft'
      });

      await base44.entities.AuditLog.create({
        action: 'CREATE_DEBIT_NOTE',
        module: 'RECONCILIATION',
        entity_type: 'Nota',
        entity_id: selectedNota?.id,
        user_email: user?.email,
        user_role: user?.role,
        reason: `Debit Note created: IDR ${dnAmount}`
      });

      setSuccessMessage('Debit Note created');
      setShowDnDialog(false);
      setDnAmount(0);
      loadData();
    } catch (error) {
      console.error('DN error:', error);
    }
    setProcessing(false);
  };

  const handleCreateCN = async () => {
    setProcessing(true);
    try {
      // Create Credit Note as new Nota
      await base44.entities.Nota.create({
        nota_number: `CN-${selectedNota?.nota_id}-${Date.now()}`,
        nota_type: 'Batch',
        reference_id: selectedNota?.batch_id,
        contract_id: selectedNota?.contract_id,
        amount: -cnAmount,
        currency: 'IDR',
        status: 'Draft'
      });

      await base44.entities.AuditLog.create({
        action: 'CREATE_CREDIT_NOTE',
        module: 'RECONCILIATION',
        entity_type: 'Nota',
        entity_id: selectedNota?.id,
        user_email: user?.email,
        user_role: user?.role,
        reason: `Credit Note created: IDR ${cnAmount}`
      });

      setSuccessMessage('Credit Note created');
      setShowCnDialog(false);
      setCnAmount(0);
      loadData();
    } catch (error) {
      console.error('CN error:', error);
    }
    setProcessing(false);
  };

  const reconColumns = [
    { 
      header: 'Nota ID', 
      accessorKey: 'nota_id',
      cell: (row) => (
        <div>
          <div className="font-medium">{row.nota_id}</div>
          <div className="text-xs text-gray-500">{row.batch_id}</div>
        </div>
      )
    },
    { header: 'Period', accessorKey: 'period' },
    { 
      header: 'Invoice Amount', 
      cell: (row) => `IDR ${((row.invoice_amount || 0) / 1000000).toFixed(2)}M` 
    },
    { 
      header: 'Payment Received', 
      cell: (row) => (
        <div>
          <div className="font-medium text-green-600">IDR {((row.payment_received || 0) / 1000000).toFixed(2)}M</div>
          <div className="text-xs text-gray-500">{row.payments?.filter(p => p.match_status === 'MATCHED').length || 0} payments</div>
        </div>
      )
    },
    { 
      header: 'Difference', 
      cell: (row) => {
        const diff = row.difference || 0;
        const hasDiff = Math.abs(diff) > 0;
        return (
          <div className="flex items-center gap-2">
            <span className={hasDiff ? 'text-red-600 font-bold' : 'text-green-600 font-medium'}>
              IDR {(diff / 1000000).toFixed(2)}M
            </span>
            {hasDiff && <AlertTriangle className="w-4 h-4 text-orange-500" />}
          </div>
        );
      }
    },
    { 
      header: 'Status', 
      cell: (row) => (
        <div className="flex items-center gap-2">
          <StatusBadge status={row.status} />
          {row.is_overdue && (
            <Badge className="bg-red-500 text-white text-xs">Overdue</Badge>
          )}
        </div>
      )
    },
    {
      header: 'Actions',
      cell: (row) => {
        if (!isTugure) {
          return (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setSelectedRecon(row);
                setShowReconDetailDialog(true);
              }}
            >
              <Eye className="w-4 h-4 mr-1" />
              View
            </Button>
          );
        }

        const hasDifference = Math.abs(row.difference || 0) > 0;
        const canClose = row.status !== 'Paid' && !hasDifference;

        return (
          <div className="flex gap-1">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setSelectedRecon(row);
                setShowReconDetailDialog(true);
              }}
            >
              <Eye className="w-4 h-4" />
            </Button>
            
            {row.status === 'Issued' && hasDifference && (
              <>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="border-red-500 text-red-600"
                  onClick={() => {
                    setSelectedNota(row);
                    setDnAmount(Math.abs(row.difference));
                    setShowDnDialog(true);
                  }}
                  title="Create Debit Note"
                >
                  DN
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="border-blue-500 text-blue-600"
                  onClick={() => {
                    setSelectedNota(row);
                    setCnAmount(Math.abs(row.difference));
                    setShowCnDialog(true);
                  }}
                  title="Create Credit Note"
                >
                  CN
                </Button>
              </>
            )}

            {canClose && (
              <Button 
                size="sm" 
                className="bg-green-600 hover:bg-green-700"
                onClick={() => handleCloseReconciliation(row)}
                disabled={processing}
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Close
              </Button>
            )}

            {row.status === 'Paid' && (
              <span className="text-xs text-green-600 font-medium">✓ Closed</span>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reconciliation"
        subtitle="Payment matching and reconciliation management"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Reconciliation' }
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
                let data = activeTab === 'payments' ? regularPayments : activeTab === 'reconciliations' ? reconciliations : exceptionPayments;
                let headers = [];
                let rows = [];
                if (activeTab === 'payments' || activeTab === 'exceptions') {
                  headers = ['Payment Ref', 'Date', 'Amount', 'Match Status', 'Exception'];
                  rows = data.map(p => [p.payment_ref, p.payment_date, p.amount, p.match_status, p.exception_type]);
                } else {
                  headers = ['Recon ID', 'Period', 'Total Invoiced', 'Total Paid', 'Difference', 'Status'];
                  rows = data.map(r => [r.recon_id, r.period, r.total_invoiced, r.total_paid, r.difference, r.status]);
                }
                const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `reconciliation-${activeTab}.csv`;
                a.click();
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            {isTugure && (
              <Button 
                className="bg-blue-600 hover:bg-blue-700"
                onClick={handleAutoMatch}
                disabled={processing}
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Scale className="w-4 h-4 mr-2" />
                )}
                Auto Match
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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Invoiced"
          value={`IDR ${(totalInvoiced / 1000000).toFixed(1)}M`}
          icon={FileText}
          gradient
          className="from-blue-500 to-blue-600"
        />
        <StatCard
          title="Total Paid"
          value={`IDR ${(totalPaid / 1000000).toFixed(1)}M`}
          icon={CheckCircle2}
          gradient
          className="from-green-500 to-green-600"
        />
        <StatCard
          title="Difference"
          value={`IDR ${(totalDifference / 1000000).toFixed(1)}M`}
          subtitle={itemsWithException > 0 ? `${itemsWithException} items need review` : 'All balanced'}
          icon={AlertTriangle}
          gradient
          className="from-orange-500 to-orange-600"
        />
        <StatCard
          title="Closed"
          value={`${closedItems}/${reconciliations.length}`}
          subtitle="Reconciliations"
          icon={Scale}
          gradient
          className="from-purple-500 to-purple-600"
        />
      </div>

      <FilterPanel
        filters={filters}
        onFilterChange={handleFilterChange}
        onClear={clearFilters}
        contracts={contracts}
      />

      {/* Single Reconciliation Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5" />
              Reconciliation Management
            </div>
            <div className="text-sm text-gray-500 font-normal">
              All reconciliation tasks in one view
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={reconColumns}
            data={reconciliations}
            isLoading={loading}
            emptyMessage="No reconciliation items"
          />
        </CardContent>
      </Card>

      {/* DN Dialog */}
      <Dialog open={showDnDialog} onOpenChange={setShowDnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Debit Note</DialogTitle>
            <DialogDescription>
              Add additional charges for {selectedNota?.nota_id}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Original Amount:</span>
                  <span className="ml-2 font-medium">IDR {(selectedNota?.invoice_amount || 0).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-500">Current Difference:</span>
                  <span className="ml-2 font-bold text-red-600">IDR {(selectedNota?.difference || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Debit Note Amount *</label>
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-2 mt-1"
                value={dnAmount}
                onChange={(e) => setDnAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDnDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateDN}
              disabled={processing || dnAmount <= 0}
              className="bg-red-600 hover:bg-red-700"
            >
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Create DN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CN Dialog */}
      <Dialog open={showCnDialog} onOpenChange={setShowCnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Credit Note</DialogTitle>
            <DialogDescription>
              Reduce charges for {selectedNota?.nota_id}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Original Amount:</span>
                  <span className="ml-2 font-medium">IDR {(selectedNota?.invoice_amount || 0).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-500">Current Difference:</span>
                  <span className="ml-2 font-bold text-red-600">IDR {(selectedNota?.difference || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Credit Note Amount *</label>
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-2 mt-1"
                value={cnAmount}
                onChange={(e) => setCnAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCnDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateCN}
              disabled={processing || cnAmount <= 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Create CN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Detail Dialog (View only) */}
      <Dialog open={showViewPaymentDialog} onOpenChange={setShowViewPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reconAction === 'MARK_EXCEPTION' && 'Mark as Exception'}
              {reconAction === 'READY_TO_CLOSE' && 'Ready to Close'}
              {reconAction === 'CLOSE' && 'Close Reconciliation'}
              {reconAction === 'RESOLVE_EXCEPTION' && 'Resolve Exception'}
            </DialogTitle>
            <DialogDescription>
              Recon ID: {selectedRecon?.recon_id} | Period: {selectedRecon?.period}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Total Invoiced:</span>
                  <span className="ml-2 font-medium">IDR {(selectedRecon?.total_invoiced || 0).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-500">Total Paid:</span>
                  <span className="ml-2 font-medium">IDR {(selectedRecon?.total_paid || 0).toLocaleString()}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Difference:</span>
                  <span className={`ml-2 font-bold ${Math.abs(selectedRecon?.difference || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    IDR {(selectedRecon?.difference || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {reconAction === 'READY_TO_CLOSE' && Math.abs(selectedRecon?.difference || 0) > 100000 && (
              <Alert className="bg-red-50 border-red-200">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-700">
                  Warning: Difference exceeds acceptable threshold (IDR 100K). Please resolve exceptions first.
                </AlertDescription>
              </Alert>
            )}

            <div>
              <label className="text-sm font-medium">Remarks *</label>
              <Textarea
                value={reconRemarks}
                onChange={(e) => setReconRemarks(e.target.value)}
                placeholder="Enter reason for this action..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowReconActionDialog(false);
              setReconRemarks('');
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleReconAction}
              disabled={processing || !reconRemarks || (reconAction === 'READY_TO_CLOSE' && Math.abs(selectedRecon?.difference || 0) > 100000)}
              className={
                reconAction === 'MARK_EXCEPTION' ? 'bg-orange-600 hover:bg-orange-700' :
                reconAction === 'RESOLVE_EXCEPTION' ? 'bg-blue-600 hover:bg-blue-700' :
                'bg-green-600 hover:bg-green-700'
              }
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Confirm
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recon Detail Dialog */}
      <Dialog open={showReconDetailDialog} onOpenChange={setShowReconDetailDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Reconciliation Details</DialogTitle>
            <DialogDescription>
              {selectedRecon?.nota_id} - {selectedRecon?.batch_id}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-500">Invoice Amount</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">IDR {((selectedRecon?.invoice_amount || 0) / 1000000).toFixed(2)}M</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-500">Payment Received</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600">IDR {((selectedRecon?.payment_received || 0) / 1000000).toFixed(2)}M</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-500">Difference</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-bold ${Math.abs(selectedRecon?.difference || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    IDR {((selectedRecon?.difference || 0) / 1000000).toFixed(2)}M
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Nota Number</p>
                <p className="font-medium">{selectedRecon?.nota_id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Batch ID</p>
                <p className="font-medium">{selectedRecon?.batch_id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <StatusBadge status={selectedRecon?.status} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Issued Date</p>
                <p className="font-medium">{selectedRecon?.issued_date}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Matched Payments</p>
                <p className="font-medium">{selectedRecon?.payments?.filter(p => p.match_status === 'MATCHED').length || 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Exception Status</p>
                <Badge className={selectedRecon?.has_exception ? 'bg-orange-500' : 'bg-green-500'}>
                  {selectedRecon?.has_exception ? 'Has Exception' : 'Clear'}
                </Badge>
              </div>
            </div>

            {selectedRecon?.payments && selectedRecon.payments.length > 0 && (
              <div>
                <p className="text-sm text-gray-500 mb-2">Related Payments</p>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Payment Ref</th>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRecon.payments.map((payment, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-3 py-2">{payment.payment_ref}</td>
                          <td className="px-3 py-2">{payment.payment_date}</td>
                          <td className="px-3 py-2 text-right">IDR {(payment.amount || 0).toLocaleString()}</td>
                          <td className="px-3 py-2"><StatusBadge status={payment.match_status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReconDetailDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment Detail</DialogTitle>
            <DialogDescription>
              Payment Reference: {selectedPayment?.payment_ref}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Payment Reference:</span>
                  <span className="ml-2 font-medium">{selectedPayment?.payment_ref}</span>
                </div>
                <div>
                  <span className="text-gray-500">Amount:</span>
                  <span className="ml-2 font-medium">IDR {(selectedPayment?.amount || 0).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-500">Payment Date:</span>
                  <span className="ml-2 font-medium">{selectedPayment?.payment_date}</span>
                </div>
                <div>
                  <span className="text-gray-500">Currency:</span>
                  <span className="ml-2 font-medium">{selectedPayment?.currency}</span>
                </div>
                <div>
                  <span className="text-gray-500">Match Status:</span>
                  <span className="ml-2"><StatusBadge status={selectedPayment?.match_status} /></span>
                </div>
                <div>
                  <span className="text-gray-500">Exception Type:</span>
                  <span className="ml-2"><StatusBadge status={selectedPayment?.exception_type} /></span>
                </div>
                {selectedPayment?.matched_by && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Matched By:</span>
                    <span className="ml-2 font-medium">{selectedPayment?.matched_by} on {selectedPayment?.matched_date}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewPaymentDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Payment as Exception</DialogTitle>
            <DialogDescription>
              Payment {selectedPayment?.payment_ref}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Amount:</span>
                  <span className="ml-2 font-medium">IDR {(selectedPayment?.amount || 0).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-500">Date:</span>
                  <span className="ml-2 font-medium">{selectedPayment?.payment_date}</span>
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Exception Type *</label>
              <Select value={selectedPayment?.exception_type || 'PARTIAL'} onValueChange={(val) => setSelectedPayment({...selectedPayment, exception_type: val})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PARTIAL">Partial Payment</SelectItem>
                  <SelectItem value="OVER">Over Payment</SelectItem>
                  <SelectItem value="UNDER">Under Payment</SelectItem>
                  <SelectItem value="LATE">Late Payment</SelectItem>
                  <SelectItem value="FX">FX Difference</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Remarks *</label>
              <Textarea
                value={exceptionRemarks}
                onChange={(e) => setExceptionRemarks(e.target.value)}
                placeholder="Explain why this is an exception..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowExceptionDialog(false);
              setExceptionRemarks('');
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => handleMarkException(selectedPayment, selectedPayment?.exception_type)}
              disabled={processing || !exceptionRemarks}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Mark as Exception
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Match Dialog */}
      <Dialog open={showMatchDialog} onOpenChange={setShowMatchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Payment Match</DialogTitle>
            <DialogDescription>
              Match payment {selectedPayment?.payment_ref}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 bg-gray-50 rounded-lg mb-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Amount:</span>
                  <span className="ml-2 font-medium">IDR {(selectedPayment?.amount || 0).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-500">Date:</span>
                  <span className="ml-2 font-medium">{selectedPayment?.payment_date}</span>
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Match To Payment Intent *</label>
              <Select value={selectedIntentId} onValueChange={setSelectedIntentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment intent" />
                </SelectTrigger>
                <SelectContent>
                  {paymentIntents.filter(i => i.status === 'APPROVED').map(intent => (
                    <SelectItem key={intent.id} value={intent.id}>
                      {intent.intent_id} - IDR {(intent.planned_amount || 0).toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">Select the approved payment intent to match this payment with</p>
            </div>
            <div className="mt-4">
              <label className="text-sm font-medium">Remarks *</label>
              <Textarea
                value={matchRemarks}
                onChange={(e) => setMatchRemarks(e.target.value)}
                placeholder="Enter matching reason..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowMatchDialog(false);
              setSelectedIntentId('');
              setMatchRemarks('');
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleManualMatch}
              disabled={processing || !matchRemarks || !selectedIntentId}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Confirm Match
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}