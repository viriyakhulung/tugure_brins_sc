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
  RefreshCw, Check, X, Loader2, FileText, Link, Split, Download
} from "lucide-react";
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
  const [activeTab, setActiveTab] = useState('payments');
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [selectedPayments, setSelectedPayments] = useState([]);
  const [selectedReconciliations, setSelectedReconciliations] = useState([]);
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [showReconActionDialog, setShowReconActionDialog] = useState(false);
  const [showReconDetailDialog, setShowReconDetailDialog] = useState(false);
  const [selectedRecon, setSelectedRecon] = useState(null);
  const [reconAction, setReconAction] = useState('');
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [matchRemarks, setMatchRemarks] = useState('');
  const [reconRemarks, setReconRemarks] = useState('');
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
      const [paymentData, reconData, intentData, contractData] = await Promise.all([
        base44.entities.Payment.list(),
        base44.entities.Reconciliation.list(),
        base44.entities.PaymentIntent.list(),
        base44.entities.Contract.list()
      ]);
      setPayments(paymentData || []);
      setReconciliations(reconData || []);
      setPaymentIntents(intentData || []);
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
      paymentStatus: 'all',
      reconStatus: 'all'
    });
  };

  const handleAutoMatch = async () => {
    setProcessing(true);
    try {
      // Simulate auto-matching logic
      const unmatchedPayments = payments.filter(p => p.match_status === 'RECEIVED');
      
      for (const payment of unmatchedPayments) {
        // Try to find matching intent
        const matchingIntent = paymentIntents.find(i => 
          i.planned_amount === payment.amount && i.status === 'APPROVED'
        );

        if (matchingIntent) {
          await base44.entities.Payment.update(payment.id, {
            match_status: 'MATCHED',
            intent_id: matchingIntent.id,
            matched_by: user?.email,
            matched_date: new Date().toISOString().split('T')[0]
          });
        }
      }

      setSuccessMessage('Auto-matching completed');
      loadData();
    } catch (error) {
      console.error('Auto-match error:', error);
    }
    setProcessing(false);
  };

  const handleManualMatch = async () => {
    if (!selectedPayment) return;

    setProcessing(true);
    try {
      // 1. Update payment
      await base44.entities.Payment.update(selectedPayment.id, {
        match_status: 'MATCHED',
        matched_by: user?.email,
        matched_date: new Date().toISOString().split('T')[0]
      });

      // 2. CRITICAL: Get associated PaymentIntent and update Invoice
      const matchedIntent = paymentIntents.find(pi => pi.id === selectedPayment.intent_id);
      if (matchedIntent && matchedIntent.invoice_id) {
        // Update Invoice paid amount
        const invoices = await base44.entities.Invoice.filter({ invoice_number: matchedIntent.invoice_id });
        if (invoices.length > 0) {
          const invoice = invoices[0];
          const newPaidAmount = (invoice.paid_amount || 0) + selectedPayment.amount;
          const newOutstanding = invoice.total_amount - newPaidAmount;
          await base44.entities.Invoice.update(invoice.id, {
            paid_amount: newPaidAmount,
            outstanding_amount: newOutstanding,
            status: newOutstanding <= 0 ? 'PAID' : 'PARTIALLY_PAID'
          });

          // Update all Debtors with this invoice
          const relatedDebtors = await base44.entities.Debtor.filter({ invoice_no: matchedIntent.invoice_id });
          for (const debtor of relatedDebtors) {
            const debtorPayment = selectedPayment.amount / relatedDebtors.length; // distribute evenly
            await base44.entities.Debtor.update(debtor.id, {
              payment_received_amount: (debtor.payment_received_amount || 0) + debtorPayment,
              invoice_status: newOutstanding <= 0 ? 'PAID' : 'PARTIALLY_PAID',
              recon_status: newOutstanding <= 0 ? 'CLOSED' : 'IN_PROGRESS'
            });
          }
        }
      }

      // 3. Create audit log
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
        updates.status = 'CLOSED';
        updates.closed_by = user?.email;
        updates.closed_date = new Date().toISOString().split('T')[0];
      } else if (reconAction === 'RESOLVE_EXCEPTION') {
        updates.status = 'IN_PROGRESS';
      }

      await base44.entities.Reconciliation.update(selectedRecon.id, updates);

      // Update related debtors if closing
      if (reconAction === 'CLOSE') {
        const relatedDebtors = await base44.entities.Debtor.filter({ 
          contract_id: selectedRecon.contract_id,
          recon_status: 'IN_PROGRESS'
        });
        for (const debtor of relatedDebtors.slice(0, 50)) {
          await base44.entities.Debtor.update(debtor.id, {
            recon_status: 'CLOSED'
          });
        }
      }

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

      setSuccessMessage(`Reconciliation ${reconAction.toLowerCase().replace('_', ' ')} successfully`);
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

  // Stats
  const totalReceived = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const matchedAmount = payments.filter(p => p.match_status === 'MATCHED').reduce((sum, p) => sum + (p.amount || 0), 0);
  const unmatchedPayments = payments.filter(p => p.match_status === 'UNMATCHED' || p.match_status === 'RECEIVED');

  const togglePaymentSelection = (paymentId) => {
    if (selectedPayments.includes(paymentId)) {
      setSelectedPayments(selectedPayments.filter(id => id !== paymentId));
    } else {
      setSelectedPayments([...selectedPayments, paymentId]);
    }
  };

  const toggleReconciliationSelection = (reconId) => {
    if (selectedReconciliations.includes(reconId)) {
      setSelectedReconciliations(selectedReconciliations.filter(id => id !== reconId));
    } else {
      setSelectedReconciliations([...selectedReconciliations, reconId]);
    }
  };

  const paymentColumns = [
    {
      header: (
        <Checkbox
          checked={selectedPayments.length === payments.length && payments.length > 0}
          onCheckedChange={(checked) => {
            if (checked) {
              setSelectedPayments(payments.map(p => p.id));
            } else {
              setSelectedPayments([]);
            }
          }}
        />
      ),
      cell: (row) => (
        <Checkbox
          checked={selectedPayments.includes(row.id)}
          onCheckedChange={() => togglePaymentSelection(row.id)}
        />
      ),
      width: '50px'
    },
    { header: 'Payment Ref', accessorKey: 'payment_ref' },
    { header: 'Payment Date', accessorKey: 'payment_date' },
    { header: 'Amount', cell: (row) => `IDR ${(row.amount || 0).toLocaleString()}` },
    { header: 'Match Status', cell: (row) => <StatusBadge status={row.match_status} /> },
    { 
      header: 'Exception', 
      cell: (row) => row.exception_type !== 'NONE' ? (
        <StatusBadge status={row.exception_type} />
      ) : '-'
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setSelectedPayment(row);
              setShowMatchDialog(true);
            }}
          >
            <Eye className="w-4 h-4 mr-1" />
            View
          </Button>
          {isTugure && row.match_status !== 'MATCHED' && (
            <Button 
              size="sm" 
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                setSelectedPayment(row);
                setShowMatchDialog(true);
              }}
            >
              <Link className="w-4 h-4 mr-1" />
              Match
            </Button>
          )}
        </div>
      )
    }
  ];

  const reconColumns = [
    {
      header: (
        <Checkbox
          checked={selectedReconciliations.length === reconciliations.length && reconciliations.length > 0}
          onCheckedChange={(checked) => {
            if (checked) {
              setSelectedReconciliations(reconciliations.map(r => r.id));
            } else {
              setSelectedReconciliations([]);
            }
          }}
        />
      ),
      cell: (row) => (
        <Checkbox
          checked={selectedReconciliations.includes(row.id)}
          onCheckedChange={() => toggleReconciliationSelection(row.id)}
        />
      ),
      width: '50px'
    },
    { header: 'Recon ID', accessorKey: 'recon_id' },
    { header: 'Period', accessorKey: 'period' },
    { header: 'Total Invoiced', cell: (row) => `IDR ${(row.total_invoiced || 0).toLocaleString()}` },
    { header: 'Total Paid', cell: (row) => `IDR ${(row.total_paid || 0).toLocaleString()}` },
    { header: 'Difference', cell: (row) => `IDR ${(row.difference || 0).toLocaleString()}` },
    { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
    {
      header: 'Actions',
      cell: (row) => {
        const getActionButton = () => {
          if (!isTugure) return null;
          
          switch (row.status) {
            case 'IN_PROGRESS':
              return (
                <>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="border-orange-500 text-orange-600 hover:bg-orange-50"
                    onClick={() => {
                      setSelectedRecon(row);
                      setReconAction('MARK_EXCEPTION');
                      setShowReconActionDialog(true);
                    }}
                  >
                    <AlertTriangle className="w-4 h-4 mr-1" />
                    Mark Exception
                  </Button>
                  <Button 
                    size="sm" 
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      setSelectedRecon(row);
                      setReconAction('READY_TO_CLOSE');
                      setShowReconActionDialog(true);
                    }}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Ready to Close
                  </Button>
                </>
              );
            case 'EXCEPTION':
              return (
                <Button 
                  size="sm" 
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    setSelectedRecon(row);
                    setReconAction('RESOLVE_EXCEPTION');
                    setShowReconActionDialog(true);
                  }}
                >
                  <Check className="w-4 h-4 mr-1" />
                  Resolve Exception
                </Button>
              );
            case 'READY_TO_CLOSE':
              return (
                <Button 
                  size="sm" 
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    setSelectedRecon(row);
                    setReconAction('CLOSE');
                    setShowReconActionDialog(true);
                  }}
                >
                  <Check className="w-4 h-4 mr-1" />
                  Close Recon
                </Button>
              );
            default:
              return null;
          }
        };

        return (
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setSelectedRecon(row);
                setShowReconDetailDialog(true);
              }}
            >
              <Eye className="w-4 h-4 mr-1" />
              Details
            </Button>
            {getActionButton()}
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
                let data = activeTab === 'payments' ? payments : activeTab === 'reconciliations' ? reconciliations : unmatchedPayments;
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
          title="Total Received"
          value={`IDR ${(totalReceived / 1000000).toFixed(1)}M`}
          icon={Scale}
          gradient
          className="from-blue-500 to-blue-600"
        />
        <StatCard
          title="Matched"
          value={`IDR ${(matchedAmount / 1000000).toFixed(1)}M`}
          icon={CheckCircle2}
          gradient
          className="from-green-500 to-green-600"
        />
        <StatCard
          title="Unmatched"
          value={unmatchedPayments.length}
          subtitle="Payments pending"
          icon={AlertTriangle}
          gradient
          className="from-orange-500 to-orange-600"
        />
        <StatCard
          title="Open Recons"
          value={reconciliations.filter(r => r.status !== 'CLOSED').length}
          icon={Clock}
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="payments">
            <FileText className="w-4 h-4 mr-2" />
            Payments ({payments.length})
          </TabsTrigger>
          <TabsTrigger value="reconciliations">
            <Scale className="w-4 h-4 mr-2" />
            Reconciliations ({reconciliations.length})
          </TabsTrigger>
          <TabsTrigger value="exceptions">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Exceptions ({unmatchedPayments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="mt-4">
          <DataTable
            columns={paymentColumns}
            data={payments}
            isLoading={loading}
            emptyMessage="No payments recorded"
          />
        </TabsContent>

        <TabsContent value="reconciliations" className="mt-4">
          <DataTable
            columns={reconColumns}
            data={reconciliations}
            isLoading={loading}
            emptyMessage="No reconciliations"
          />
        </TabsContent>

        <TabsContent value="exceptions" className="mt-4">
          <DataTable
            columns={paymentColumns}
            data={unmatchedPayments}
            isLoading={loading}
            emptyMessage="No exceptions"
          />
        </TabsContent>
      </Tabs>

      {/* Recon Action Dialog */}
      <Dialog open={showReconActionDialog} onOpenChange={setShowReconActionDialog}>
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
              {selectedRecon?.recon_id} - {selectedRecon?.period}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-500">Total Invoiced</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">IDR {((selectedRecon?.total_invoiced || 0) / 1000000).toFixed(1)}M</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-500">Total Paid</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600">IDR {((selectedRecon?.total_paid || 0) / 1000000).toFixed(1)}M</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-500">Difference</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-bold ${Math.abs(selectedRecon?.difference || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    IDR {((selectedRecon?.difference || 0) / 1000000).toFixed(1)}M
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Contract ID</p>
                <p className="font-medium">{selectedRecon?.contract_id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <StatusBadge status={selectedRecon?.status} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Currency</p>
                <p className="font-medium">{selectedRecon?.currency || 'IDR'}</p>
              </div>
              {selectedRecon?.closed_by && (
                <>
                  <div>
                    <p className="text-sm text-gray-500">Closed By</p>
                    <p className="font-medium">{selectedRecon?.closed_by}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Closed Date</p>
                    <p className="font-medium">{selectedRecon?.closed_date}</p>
                  </div>
                </>
              )}
            </div>

            {selectedRecon?.remarks && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Remarks</p>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm">{selectedRecon?.remarks}</p>
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
              <label className="text-sm font-medium">Match To Payment Intent</label>
              <Select>
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
            <Button variant="outline" onClick={() => setShowMatchDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleManualMatch}
              disabled={processing || !matchRemarks}
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