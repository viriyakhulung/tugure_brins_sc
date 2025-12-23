import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, RefreshCw, ArrowRight, Loader2, Eye, Download, FileText, Clock, DollarSign,
  AlertTriangle, Scale, Plus, X
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import StatCard from "@/components/dashboard/StatCard";
import ModernKPI from "@/components/dashboard/ModernKPI";
import { sendTemplatedEmail, createNotification, createAuditLog } from "@/components/utils/emailTemplateHelper";

export default function NotaManagement() {
  const [user, setUser] = useState(null);
  const [notas, setNotas] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [dnCnRecords, setDnCnRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNota, setSelectedNota] = useState(null);
  const [selectedDnCn, setSelectedDnCn] = useState(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [showDnCnDialog, setShowDnCnDialog] = useState(false);
  const [showDnCnActionDialog, setShowDnCnActionDialog] = useState(false);
  const [showReconActionDialog, setShowReconActionDialog] = useState(false);
  const [actionType, setActionType] = useState('');
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [remarks, setRemarks] = useState('');
  const [activeTab, setActiveTab] = useState('notas');
  const [selectedRecon, setSelectedRecon] = useState(null);
  const [actualPaidAmount, setActualPaidAmount] = useState('');
  const [dnCnFormData, setDnCnFormData] = useState({
    note_type: 'Debit Note',
    adjustment_amount: 0,
    reason_code: 'Payment Difference',
    reason_description: ''
  });
  const [filters, setFilters] = useState({
    contract: 'all',
    notaType: 'all',
    status: 'all'
  });
  const [reconFilters, setReconFilters] = useState({
    contract: 'all',
    status: 'all',
    hasException: 'all'
  });
  const [dnCnFilters, setDnCnFilters] = useState({
    contract: 'all',
    noteType: 'all',
    status: 'all'
  });

  const isTugure = user?.role === 'TUGURE' || user?.role === 'admin';
  const isBrins = user?.role === 'BRINS' || user?.role === 'admin';

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
      const [notaData, contractData, paymentData, dnCnData] = await Promise.all([
        base44.entities.Nota.list('-created_date'),
        base44.entities.Contract.list(),
        base44.entities.Payment.list(),
        base44.entities.DebitCreditNote.list('-created_date')
      ]);
      setNotas(notaData || []);
      setContracts(contractData || []);
      setPayments(paymentData || []);
      setDnCnRecords(dnCnData || []);
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

      // 2. When Nota is Confirmed, create Payment Intent
      if (nextStatus === 'Confirmed' && selectedNota.nota_type === 'Batch') {
        const existingIntent = await base44.entities.PaymentIntent.filter({ 
          contract_id: selectedNota.contract_id 
        });
        
        if (existingIntent.length === 0) {
          const intentId = `PI-NOTA-${selectedNota.nota_number}-${Date.now()}`;
          await base44.entities.PaymentIntent.create({
            intent_id: intentId,
            invoice_id: selectedNota.id,
            contract_id: selectedNota.contract_id,
            payment_type: 'FULL',
            planned_amount: selectedNota.amount,
            planned_date: new Date().toISOString().split('T')[0],
            status: 'DRAFT',
            remarks: `Auto-created from Nota ${selectedNota.nota_number}`
          });
          
          await createNotification(
            'Payment Intent Created',
            `Payment Intent ${intentId} auto-created for Nota ${selectedNota.nota_number}`,
            'ACTION_REQUIRED',
            'DEBTOR',
            selectedNota.id,
            'BRINS'
          );
        }
      }

      // 3. CRITICAL: When Nota is Paid, flow to Reconciliation/Payment
      if (selectedNota.nota_type === 'Batch' && selectedNota.reference_id) {
        const batchDebtors = await base44.entities.Debtor.filter({ batch_id: selectedNota.reference_id });
        
        // When Nota is marked as Paid
        if (nextStatus === 'Paid') {
          // Find related Invoice
          const invoices = await base44.entities.Invoice.filter({ contract_id: selectedNota.contract_id });
          const relatedInvoice = invoices.find(inv => 
            batchDebtors.some(d => d.invoice_no === inv.invoice_number)
          );
          
          if (relatedInvoice) {
            // Update Invoice to PAID
            await base44.entities.Invoice.update(relatedInvoice.id, {
              paid_amount: relatedInvoice.total_amount,
              outstanding_amount: 0,
              status: 'PAID'
            });

            // CRITICAL: Check if Payment already exists from Reconciliation
            const existingPayments = await base44.entities.Payment.filter({ invoice_id: relatedInvoice.id });
            if (existingPayments.length === 0) {
              // Only create Payment if not already created by Reconciliation
              await base44.entities.Payment.create({
                payment_ref: `PAY-NOTA-${selectedNota.nota_number}`,
                invoice_id: relatedInvoice.id,
                contract_id: selectedNota.contract_id,
                amount: selectedNota.amount,
                payment_date: new Date().toISOString().split('T')[0],
                currency: 'IDR',
                match_status: 'MATCHED',
                exception_type: 'NONE',
                matched_by: user?.email,
                matched_date: new Date().toISOString().split('T')[0]
              });
            }

            // Update Reconciliation to CLOSED if exists
            const reconciliations = await base44.entities.Reconciliation.filter({
              contract_id: selectedNota.contract_id
            });
            for (const recon of reconciliations) {
              if (recon.status !== 'CLOSED' && Math.abs(recon.difference || 0) <= 100000) {
                await base44.entities.Reconciliation.update(recon.id, {
                  status: 'CLOSED',
                  closed_by: user?.email,
                  closed_date: new Date().toISOString().split('T')[0],
                  remarks: `Auto-closed from Nota ${selectedNota.nota_number} payment`
                });
              }
            }
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
            onClick={() => {
              setSelectedNota(row);
              setShowViewDialog(true);
            }}
          >
            <Eye className="w-4 h-4 mr-1" />
            View
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

  const handleCreateDnCn = async () => {
    if (!selectedNota) return;

    setProcessing(true);
    try {
      const noteNumber = `${dnCnFormData.note_type === 'Debit Note' ? 'DN' : 'CN'}-${selectedNota.nota_number}-${Date.now()}`;
      
      await base44.entities.DebitCreditNote.create({
        note_number: noteNumber,
        note_type: dnCnFormData.note_type,
        original_nota_id: selectedNota.nota_number,
        batch_id: selectedNota.reference_id,
        contract_id: selectedNota.contract_id,
        adjustment_amount: dnCnFormData.note_type === 'Debit Note' ? 
          Math.abs(dnCnFormData.adjustment_amount) : 
          -Math.abs(dnCnFormData.adjustment_amount),
        reason_code: dnCnFormData.reason_code,
        reason_description: dnCnFormData.reason_description,
        status: 'Draft',
        drafted_by: user?.email,
        drafted_date: new Date().toISOString(),
        currency: 'IDR'
      });

      await base44.entities.AuditLog.create({
        action: 'CREATE_DN_CN',
        module: 'RECONCILIATION',
        entity_type: 'DebitCreditNote',
        entity_id: noteNumber,
        user_email: user?.email,
        user_role: user?.role
      });

      setSuccessMessage(`${dnCnFormData.note_type} created successfully`);
      setShowDnCnDialog(false);
      setSelectedNota(null);
      setDnCnFormData({
        note_type: 'Debit Note',
        adjustment_amount: 0,
        reason_code: 'Payment Difference',
        reason_description: ''
      });
      loadData();
    } catch (error) {
      console.error('DN/CN creation error:', error);
    }
    setProcessing(false);
  };

  const handleDnCnAction = async (dnCn, action) => {
    setProcessing(true);
    try {
      const statusMap = {
        'review': 'Under Review',
        'approve': 'Approved',
        'reject': 'Rejected',
        'acknowledge': 'Acknowledged'
      };

      const updates = { status: statusMap[action] };

      if (action === 'review') {
        updates.reviewed_by = user?.email;
        updates.reviewed_date = new Date().toISOString();
      } else if (action === 'approve') {
        updates.approved_by = user?.email;
        updates.approved_date = new Date().toISOString();
      } else if (action === 'acknowledge') {
        updates.acknowledged_by = user?.email;
        updates.acknowledged_date = new Date().toISOString();
      }

      if (action === 'reject') {
        updates.rejection_reason = remarks;
      }

      await base44.entities.DebitCreditNote.update(dnCn.id, updates);

      await createNotification(
        `DN/CN ${statusMap[action]}`,
        `${dnCn.note_type} ${dnCn.note_number} is now ${statusMap[action]}`,
        'ACTION_REQUIRED',
        'RECONCILIATION',
        dnCn.id,
        action === 'approve' ? 'BRINS' : 'TUGURE'
      );

      await base44.entities.AuditLog.create({
        action: `DN_CN_${action.toUpperCase()}`,
        module: 'RECONCILIATION',
        entity_type: 'DebitCreditNote',
        entity_id: dnCn.id,
        user_email: user?.email,
        user_role: user?.role,
        reason: remarks
      });

      setSuccessMessage(`DN/CN ${action}ed successfully`);
      setShowDnCnActionDialog(false);
      setSelectedDnCn(null);
      setRemarks('');
      loadData();
    } catch (error) {
      console.error('DN/CN action error:', error);
    }
    setProcessing(false);
  };

  const handleReconAction = async () => {
    if (!selectedRecon || !actualPaidAmount) return;

    setProcessing(true);
    try {
      const paidAmount = parseFloat(actualPaidAmount);
      const notaAmount = selectedRecon.amount || 0;
      const difference = notaAmount - paidAmount;
      
      let matchStatus = 'MATCHED';
      let exceptionType = 'NONE';
      
      if (Math.abs(difference) > 0) {
        matchStatus = 'PARTIALLY_MATCHED';
        if (difference > 0) {
          exceptionType = 'UNDER'; // Underpayment
        } else {
          exceptionType = 'OVER'; // Overpayment
        }
      }

      // Create Payment record
      const paymentRef = `PAY-${selectedRecon.nota_number}-${Date.now()}`;
      await base44.entities.Payment.create({
        payment_ref: paymentRef,
        invoice_id: selectedRecon.id,
        contract_id: selectedRecon.contract_id,
        amount: paidAmount,
        payment_date: new Date().toISOString().split('T')[0],
        currency: 'IDR',
        match_status: matchStatus,
        exception_type: exceptionType,
        matched_by: user?.email,
        matched_date: new Date().toISOString().split('T')[0]
      });

      // If matched, auto update Nota to Paid
      if (matchStatus === 'MATCHED') {
        await base44.entities.Nota.update(selectedRecon.id, {
          status: 'Paid',
          paid_date: new Date().toISOString().split('T')[0],
          payment_reference: paymentRef
        });

        await createNotification(
          'Payment Matched - Nota Paid',
          `Nota ${selectedRecon.nota_number} fully paid. Amount: Rp ${paidAmount.toLocaleString()}`,
          'INFO',
          'DEBTOR',
          selectedRecon.id,
          'ALL'
        );
      } else {
        // Exception - need DN/CN
        await createNotification(
          'Payment Exception - DN/CN Required',
          `Nota ${selectedRecon.nota_number} has payment difference of Rp ${Math.abs(difference).toLocaleString()}. ${exceptionType === 'UNDER' ? 'Underpayment' : 'Overpayment'} detected.`,
          'WARNING',
          'DEBTOR',
          selectedRecon.id,
          'TUGURE'
        );
      }

      setSuccessMessage(`Payment recorded: ${matchStatus === 'MATCHED' ? 'Matched' : 'Exception detected'}`);
      setShowReconActionDialog(false);
      setSelectedRecon(null);
      setActualPaidAmount('');
      loadData();
    } catch (error) {
      console.error('Recon action error:', error);
    }
    setProcessing(false);
  };

  const reconciliationItems = notas.filter(n => n.nota_type === 'Batch').map(nota => {
    const relatedPayments = payments.filter(p => 
      p.invoice_id === nota.id || 
      (p.contract_id === nota.contract_id && p.match_status === 'MATCHED')
    );
    const paymentReceived = relatedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const difference = (nota.amount || 0) - paymentReceived;

    let reconStatus = 'PENDING';
    if (Math.abs(difference) <= 1000) {
      reconStatus = 'MATCHED';
    } else if (Math.abs(difference) > 0 && nota.status !== 'Paid') {
      reconStatus = 'UNMATCHED';
    }

    return {
      ...nota,
      payment_received: paymentReceived,
      difference: difference,
      recon_status: reconStatus,
      has_exception: reconStatus === 'UNMATCHED',
      payment_count: relatedPayments.length
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nota Management"
        subtitle="Manage notas, payments, reconciliation, and debit/credit notes"
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="notas">Notas</TabsTrigger>
          <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
          <TabsTrigger value="dncn">DN / CN</TabsTrigger>
        </TabsList>

        <TabsContent value="notas" className="space-y-6">
          {/* KPI Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <ModernKPI
              title="Total Notas"
              value={notas.length}
              subtitle={`${notas.filter(n => n.nota_type === 'Batch').length} batch / ${notas.filter(n => n.nota_type === 'Claim').length} claim`}
              icon={FileText}
              color="blue"
            />
            <ModernKPI
              title="Pending Confirmation"
              value={notas.filter(n => n.status === 'Issued').length}
              subtitle="Awaiting branch"
              icon={Clock}
              color="orange"
            />
            <ModernKPI
              title="Total Amount"
              value={`Rp ${(notas.reduce((sum, n) => sum + (n.amount || 0), 0) / 1000000).toFixed(1)}M`}
              subtitle="All notas"
              icon={DollarSign}
              color="green"
            />
            <ModernKPI
              title="Paid Notas"
              value={notas.filter(n => n.status === 'Paid').length}
              subtitle={`Rp ${(notas.filter(n => n.status === 'Paid').reduce((sum, n) => sum + (n.amount || 0), 0) / 1000000).toFixed(1)}M`}
              icon={CheckCircle2}
              color="purple"
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
            columns={[
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
              { header: 'Paid Amount', cell: (row) => row.status === 'Paid' ? `Rp ${(row.amount || 0).toLocaleString('id-ID')}` : '-' },
              { header: 'Outstanding', cell: (row) => row.status === 'Paid' ? 'Rp 0' : `Rp ${(row.amount || 0).toLocaleString('id-ID')}` },
              { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
              {
                header: 'Actions',
                cell: (row) => (
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSelectedNota(row);
                        setShowViewDialog(true);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
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
            ]}
            data={filteredNotas}
            isLoading={loading}
            emptyMessage="No notas found"
          />
        </TabsContent>

        <TabsContent value="reconciliation" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <ModernKPI title="Total Invoiced" value={`Rp ${(reconciliationItems.reduce((sum, r) => sum + (r.amount || 0), 0) / 1000000).toFixed(1)}M`} subtitle="Nota amounts" icon={FileText} color="blue" />
            <ModernKPI title="Total Paid" value={`Rp ${(reconciliationItems.reduce((sum, r) => sum + (r.payment_received || 0), 0) / 1000000).toFixed(1)}M`} subtitle="Payments received" icon={CheckCircle2} color="green" />
            <ModernKPI title="Difference" value={`Rp ${(reconciliationItems.reduce((sum, r) => sum + (r.difference || 0), 0) / 1000000).toFixed(1)}M`} subtitle="To be reconciled" icon={AlertTriangle} color="orange" />
            <ModernKPI title="Exceptions" value={reconciliationItems.filter(r => r.has_exception).length} subtitle="Requires DN/CN" icon={AlertTriangle} color="red" />
          </div>

          {/* Recon Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Select value={reconFilters.contract} onValueChange={(val) => setReconFilters({...reconFilters, contract: val})}>
                  <SelectTrigger><SelectValue placeholder="Contract" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Contracts</SelectItem>
                    {contracts.map(c => (<SelectItem key={c.id} value={c.id}>{c.contract_number}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Select value={reconFilters.status} onValueChange={(val) => setReconFilters({...reconFilters, status: val})}>
                  <SelectTrigger><SelectValue placeholder="Nota Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Issued">Issued</SelectItem>
                    <SelectItem value="Confirmed">Confirmed</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={reconFilters.hasException} onValueChange={(val) => setReconFilters({...reconFilters, hasException: val})}>
                  <SelectTrigger><SelectValue placeholder="Exception" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="yes">Has Exception</SelectItem>
                    <SelectItem value="no">No Exception</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => setReconFilters({contract: 'all', status: 'all', hasException: 'all'})}>
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Reconciliation</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={[
                  { header: 'Nota', cell: (row) => <div><div className="font-medium">{row.nota_number}</div><div className="text-xs text-gray-500">{row.reference_id}</div></div> },
                  { header: 'Nota Amount', cell: (row) => `Rp ${((row.amount || 0) / 1000000).toFixed(2)}M` },
                  { header: 'Payment Received', cell: (row) => <div><div className="text-green-600 font-medium">Rp {((row.payment_received || 0) / 1000000).toFixed(2)}M</div><div className="text-xs text-gray-500">{row.payment_count} payments</div></div> },
                  { header: 'Difference', cell: (row) => {
                    const diff = row.difference || 0;
                    return <div className="flex items-center gap-2"><span className={Math.abs(diff) > 1000 ? 'text-red-600 font-bold' : 'text-green-600'}>Rp {(diff / 1000000).toFixed(2)}M</span>{Math.abs(diff) > 1000 && <AlertTriangle className="w-4 h-4 text-orange-500" />}</div>;
                  }},
                  { header: 'Recon Status', cell: (row) => <StatusBadge status={row.recon_status} /> },
                  { header: 'Nota Status', cell: (row) => <StatusBadge status={row.status} /> },
                  { header: 'Actions', cell: (row) => (
                    <div className="flex gap-1">
                      {isTugure && row.status !== 'Paid' && (
                        <Button size="sm" className="bg-blue-600" onClick={() => { 
                          setSelectedRecon(row); 
                          setActualPaidAmount(row.amount?.toString() || '');
                          setShowReconActionDialog(true); 
                        }}>
                          Record Payment
                        </Button>
                      )}
                      {isTugure && row.has_exception && row.status !== 'Paid' && (
                        <Button size="sm" variant="outline" className="text-orange-600" onClick={() => { setSelectedNota(row); setShowDnCnDialog(true); }}>
                          <Plus className="w-4 h-4 mr-1" />
                          DN/CN
                        </Button>
                      )}
                    </div>
                  )}
                ]}
                data={reconciliationItems.filter(r => {
                  if (reconFilters.contract !== 'all' && r.contract_id !== reconFilters.contract) return false;
                  if (reconFilters.status !== 'all' && r.status !== reconFilters.status) return false;
                  if (reconFilters.hasException === 'yes' && !r.has_exception) return false;
                  if (reconFilters.hasException === 'no' && r.has_exception) return false;
                  return true;
                })}
                isLoading={loading}
                emptyMessage="No reconciliation items"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dncn" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <ModernKPI title="Total DN/CN" value={dnCnRecords.length} subtitle={`${dnCnRecords.filter(d => d.note_type === 'Debit Note').length} DN / ${dnCnRecords.filter(d => d.note_type === 'Credit Note').length} CN`} icon={FileText} color="blue" />
            <ModernKPI title="Pending Review" value={dnCnRecords.filter(d => d.status === 'Draft' || d.status === 'Under Review').length} subtitle="Awaiting action" icon={Clock} color="orange" />
            <ModernKPI title="Approved" value={dnCnRecords.filter(d => d.status === 'Approved').length} subtitle="Ready for acknowledgment" icon={CheckCircle2} color="green" />
            <ModernKPI title="Total Adjustment" value={`Rp ${(dnCnRecords.reduce((sum, d) => sum + Math.abs(d.adjustment_amount || 0), 0) / 1000000).toFixed(1)}M`} icon={DollarSign} color="purple" />
          </div>

          {/* DN/CN Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Select value={dnCnFilters.contract} onValueChange={(val) => setDnCnFilters({...dnCnFilters, contract: val})}>
                  <SelectTrigger><SelectValue placeholder="Contract" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Contracts</SelectItem>
                    {contracts.map(c => (<SelectItem key={c.id} value={c.id}>{c.contract_number}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Select value={dnCnFilters.noteType} onValueChange={(val) => setDnCnFilters({...dnCnFilters, noteType: val})}>
                  <SelectTrigger><SelectValue placeholder="Note Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Debit Note">Debit Note</SelectItem>
                    <SelectItem value="Credit Note">Credit Note</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={dnCnFilters.status} onValueChange={(val) => setDnCnFilters({...dnCnFilters, status: val})}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Under Review">Under Review</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Acknowledged">Acknowledged</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => setDnCnFilters({contract: 'all', noteType: 'all', status: 'all'})}>
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Debit & Credit Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={[
                  { header: 'Note Number', cell: (row) => <div><div className="font-medium font-mono">{row.note_number}</div><Badge className={row.note_type === 'Debit Note' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}>{row.note_type}</Badge></div> },
                  { header: 'Original Nota', accessorKey: 'original_nota_id' },
                  { header: 'Batch ID', accessorKey: 'batch_id' },
                  { header: 'Adjustment', cell: (row) => <div className={row.note_type === 'Debit Note' ? 'text-red-600 font-bold' : 'text-blue-600 font-bold'}>Rp {(Math.abs(row.adjustment_amount || 0)).toLocaleString('id-ID')}</div> },
                  { header: 'Reason', accessorKey: 'reason_code' },
                  { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
                  { header: 'Actions', cell: (row) => (
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => { setSelectedDnCn(row); setShowViewDialog(true); }}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      {isTugure && row.status === 'Draft' && (
                        <Button size="sm" onClick={() => { setSelectedDnCn(row); setActionType('review'); setShowDnCnActionDialog(true); }}>Review</Button>
                      )}
                      {isTugure && row.status === 'Under Review' && (
                        <Button size="sm" className="bg-green-600" onClick={() => { setSelectedDnCn(row); setActionType('approve'); setShowDnCnActionDialog(true); }}>Approve</Button>
                      )}
                      {isBrins && row.status === 'Approved' && (
                        <Button size="sm" className="bg-blue-600" onClick={() => { setSelectedDnCn(row); setActionType('acknowledge'); setShowDnCnActionDialog(true); }}>Acknowledge</Button>
                      )}
                    </div>
                  )}
                ]}
                data={dnCnRecords.filter(d => {
                  if (dnCnFilters.contract !== 'all' && d.contract_id !== dnCnFilters.contract) return false;
                  if (dnCnFilters.noteType !== 'all' && d.note_type !== dnCnFilters.noteType) return false;
                  if (dnCnFilters.status !== 'all' && d.status !== dnCnFilters.status) return false;
                  return true;
                })}
                isLoading={loading}
                emptyMessage="No DN/CN records"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog (View only) */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nota Detail</DialogTitle>
            <DialogDescription>
              Nota Number: {selectedNota?.nota_number}
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
                <div>
                  <span className="text-gray-500">Currency:</span>
                  <span className="ml-2 font-medium">{selectedNota?.currency}</span>
                </div>
                <div>
                  <span className="text-gray-500">Status:</span>
                  <span className="ml-2"><StatusBadge status={selectedNota?.status} /></span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Reference:</span>
                  <span className="ml-2 font-medium">{selectedNota?.reference_id}</span>
                </div>
                {selectedNota?.issued_by && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Issued By:</span>
                    <span className="ml-2 font-medium">{selectedNota?.issued_by} on {selectedNota?.issued_date}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DN/CN Creation Dialog */}
      <Dialog open={showDnCnDialog} onOpenChange={setShowDnCnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Debit / Credit Note</DialogTitle>
            <DialogDescription>For Nota: {selectedNota?.nota_number}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-medium">Note Type *</label>
              <Select value={dnCnFormData.note_type} onValueChange={(val) => setDnCnFormData({...dnCnFormData, note_type: val})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Debit Note">Debit Note (Increase)</SelectItem>
                  <SelectItem value="Credit Note">Credit Note (Decrease)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Adjustment Amount (IDR) *</label>
              <Input
                type="number"
                value={dnCnFormData.adjustment_amount}
                onChange={(e) => setDnCnFormData({...dnCnFormData, adjustment_amount: parseFloat(e.target.value) || 0})}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Reason Code *</label>
              <Select value={dnCnFormData.reason_code} onValueChange={(val) => setDnCnFormData({...dnCnFormData, reason_code: val})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Payment Difference">Payment Difference</SelectItem>
                  <SelectItem value="FX Adjustment">FX Adjustment</SelectItem>
                  <SelectItem value="Premium Correction">Premium Correction</SelectItem>
                  <SelectItem value="Coverage Adjustment">Coverage Adjustment</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Description *</label>
              <Textarea
                value={dnCnFormData.reason_description}
                onChange={(e) => setDnCnFormData({...dnCnFormData, reason_description: e.target.value})}
                placeholder="Explain the reason for this adjustment..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDnCnDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateDnCn} disabled={processing || !dnCnFormData.reason_description}>
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DN/CN Action Dialog */}
      <Dialog open={showDnCnActionDialog} onOpenChange={setShowDnCnActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionType} DN/CN</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">Remarks</label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter remarks..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDnCnActionDialog(false)}>Cancel</Button>
            <Button onClick={() => handleDnCnAction(selectedDnCn, actionType)} disabled={processing}>
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reconciliation Action Dialog */}
      <Dialog open={showReconActionDialog} onOpenChange={setShowReconActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment - Reconciliation</DialogTitle>
            <DialogDescription>Nota: {selectedRecon?.nota_number}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Nota Amount:</span>
                  <span className="ml-2 font-bold text-blue-600">Rp {(selectedRecon?.amount || 0).toLocaleString('id-ID')}</span>
                </div>
                <div>
                  <span className="text-gray-500">Currently Received:</span>
                  <span className="ml-2 font-medium text-green-600">Rp {(selectedRecon?.payment_received || 0).toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>
            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                Enter actual payment received. System will auto-detect: MATCHED (exact), UNDER (less), or OVER (more). 
                Exceptions trigger DN/CN workflow.
              </AlertDescription>
            </Alert>
            <div>
              <label className="text-sm font-medium">Actual Paid Amount (Rp) *</label>
              <Input
                type="number"
                value={actualPaidAmount}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setActualPaidAmount(e.target.value);
                  const diff = (selectedRecon?.amount || 0) - val;
                  if (Math.abs(diff) > 1000) {
                    setRemarks(`Payment difference detected: ${diff > 0 ? 'Underpayment' : 'Overpayment'} of Rp ${Math.abs(diff).toLocaleString()}`);
                  } else {
                    setRemarks('Payment matched - exact amount');
                  }
                }}
                placeholder="Enter amount received from bank"
              />
              {actualPaidAmount && (
                <p className={`text-xs mt-1 ${Math.abs((selectedRecon?.amount || 0) - parseFloat(actualPaidAmount)) > 1000 ? 'text-orange-600' : 'text-green-600'}`}>
                  {Math.abs((selectedRecon?.amount || 0) - parseFloat(actualPaidAmount)) <= 1000 
                    ? '✓ MATCHED - Payment complete' 
                    : `⚠️ EXCEPTION - Difference: Rp ${Math.abs((selectedRecon?.amount || 0) - parseFloat(actualPaidAmount)).toLocaleString()}`
                  }
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Payment Reference / Remarks</label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Bank reference or notes..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowReconActionDialog(false); setActualPaidAmount(''); setRemarks(''); }}>Cancel</Button>
            <Button onClick={handleReconAction} disabled={processing || !actualPaidAmount} className="bg-blue-600">
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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