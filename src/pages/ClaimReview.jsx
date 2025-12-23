import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  FileText, CheckCircle2, Eye, RefreshCw, Check, X, 
  Loader2, AlertCircle, DollarSign, Download
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import StatCard from "@/components/dashboard/StatCard";
import { sendTemplatedEmail, createNotification, createAuditLog } from "@/components/utils/emailTemplateHelper";

export default function ClaimReview() {
  const [user, setUser] = useState(null);
  const [claims, setClaims] = useState([]);
  const [subrogations, setSubrogations] = useState([]);
  const [notas, setNotas] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('review');
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [selectedClaims, setSelectedClaims] = useState([]);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState('');
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
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
      const [claimData, subrogationData, notaData, contractData] = await Promise.all([
        base44.entities.Claim.list(),
        base44.entities.Subrogation.list(),
        base44.entities.Nota.list(),
        base44.entities.Contract.list()
      ]);
      setClaims(claimData || []);
      setSubrogations(subrogationData || []);
      setNotas(notaData || []);
      setContracts(contractData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  const canProcessClaim = (claim) => {
    // Check if nota for claim is paid
    const claimNotas = notas.filter(n => 
      n.nota_type === 'Claim' && 
      n.reference_id === claim.claim_no
    );
    const hasPaidNota = claimNotas.some(n => n.status === 'Paid');
    return hasPaidNota || claim.claim_status === 'Draft' || claim.claim_status === 'Checked';
  };

  const handleClaimAction = async () => {
    if (!selectedClaim || !actionType) return;

    setProcessing(true);
    setErrorMessage('');
    
    try {
      let newStatus = '';
      let updateData = {
        reviewed_by: user?.email,
        review_date: new Date().toISOString().split('T')[0]
      };

      switch (actionType) {
        case 'check':
          newStatus = 'Checked';
          updateData.claim_status = 'Checked';
          updateData.checked_by = user?.email;
          updateData.checked_date = new Date().toISOString().split('T')[0];
          break;
        case 'verify':
          newStatus = 'Doc Verified';
          updateData.claim_status = 'Doc Verified';
          updateData.doc_verified_by = user?.email;
          updateData.doc_verified_date = new Date().toISOString().split('T')[0];
          break;
        case 'invoice':
          // Check precondition: batch must be paid
          const relatedNotas = notas.filter(n => n.reference_id === selectedClaim.claim_no);
          if (relatedNotas.length === 0 || !relatedNotas.some(n => n.status === 'Paid')) {
            setErrorMessage('Cannot issue invoice: Batch payment not completed yet');
            setProcessing(false);
            return;
          }
          
          newStatus = 'Invoiced';
          updateData.claim_status = 'Invoiced';
          updateData.invoiced_by = user?.email;
          updateData.invoiced_date = new Date().toISOString().split('T')[0];
          
          // Create Claim Nota
          const notaNumber = `NOTA-CLM-${selectedClaim.claim_no}-${Date.now()}`;
          await base44.entities.Nota.create({
            nota_number: notaNumber,
            nota_type: 'Claim',
            reference_id: selectedClaim.claim_no,
            contract_id: selectedClaim.contract_id,
            amount: selectedClaim.share_tugure_amount || 0,
            currency: 'IDR',
            status: 'Draft'
          });
          break;
        case 'reject':
          newStatus = 'Draft';
          updateData.claim_status = 'Draft';
          updateData.rejection_reason = remarks;
          break;
      }

      await base44.entities.Claim.update(selectedClaim.id, updateData);

      await createNotification(
        `Claim ${newStatus}`,
        `Claim ${selectedClaim.claim_no} moved to ${newStatus}`,
        'INFO',
        'CLAIM',
        selectedClaim.id,
        'BRINS'
      );

      await createAuditLog(
        `CLAIM_${actionType.toUpperCase()}`,
        'CLAIM',
        'Claim',
        selectedClaim.id,
        { status: selectedClaim.claim_status },
        { status: newStatus },
        user?.email,
        user?.role,
        remarks
      );

      setSuccessMessage(`Claim ${actionType}ed successfully`);
      setShowActionDialog(false);
      setSelectedClaim(null);
      setRemarks('');
      loadData();
    } catch (error) {
      console.error('Action error:', error);
      setErrorMessage('Failed to process claim');
    }
    setProcessing(false);
  };

  const pendingClaims = claims.filter(c => c.claim_status === 'Draft' || c.claim_status === 'Checked');

  const toggleClaimSelection = (claimId) => {
    setSelectedClaims(prev => 
      prev.includes(claimId) ? prev.filter(id => id !== claimId) : [...prev, claimId]
    );
  };

  const claimColumns = [
    {
      header: (
        <Checkbox
          checked={selectedClaims.length === claims.length && claims.length > 0}
          onCheckedChange={(checked) => {
            setSelectedClaims(checked ? claims.map(c => c.id) : []);
          }}
        />
      ),
      cell: (row) => (
        <Checkbox
          checked={selectedClaims.includes(row.id)}
          onCheckedChange={() => toggleClaimSelection(row.id)}
        />
      ),
      width: '50px'
    },
    { header: 'Claim No', accessorKey: 'claim_no' },
    { header: 'Participant', accessorKey: 'participant_no' },
    { header: 'Debtor', accessorKey: 'nama_tertanggung' },
    { header: 'Claim Amount', cell: (row) => `Rp ${(row.nilai_klaim || 0).toLocaleString('id-ID')}` },
    { header: 'Share Tugure', cell: (row) => `Rp ${(row.share_tugure_amount || 0).toLocaleString('id-ID')}` },
    { header: 'Status', cell: (row) => <StatusBadge status={row.claim_status} /> },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setSelectedClaim(row); setShowViewDialog(true); }}>
            <Eye className="w-4 h-4" />
          </Button>
          {row.claim_status === 'Draft' && (
            <>
              <Button size="sm" className="bg-blue-600" onClick={() => { setSelectedClaim(row); setActionType('check'); setShowActionDialog(true); }}>
                Check
              </Button>
              <Button size="sm" variant="destructive" onClick={() => { setSelectedClaim(row); setActionType('reject'); setShowActionDialog(true); }}>
                <X className="w-4 h-4" />
              </Button>
            </>
          )}
          {row.claim_status === 'Checked' && (
            <Button size="sm" className="bg-green-600" onClick={() => { setSelectedClaim(row); setActionType('verify'); setShowActionDialog(true); }}>
              Verify Docs
            </Button>
          )}
          {row.claim_status === 'Doc Verified' && (
            <Button size="sm" className="bg-purple-600" onClick={() => { setSelectedClaim(row); setActionType('invoice'); setShowActionDialog(true); }}>
              Issue Invoice
            </Button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Claim Review"
        subtitle="Review and process claims"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Claim Review' }
        ]}
        actions={
          <div className="flex gap-2">
            {selectedClaims.length > 0 && (
              <>
                <Button className="bg-green-600" onClick={async () => {
                  setProcessing(true);
                  for (const claimId of selectedClaims) {
                    const claim = claims.find(c => c.id === claimId);
                    if (claim?.claim_status === 'Draft') {
                      await base44.entities.Claim.update(claimId, {
                        claim_status: 'Checked',
                        checked_by: user?.email,
                        checked_date: new Date().toISOString().split('T')[0]
                      });
                    }
                  }
                  setSuccessMessage(`${selectedClaims.length} claims checked`);
                  setSelectedClaims([]);
                  loadData();
                  setProcessing(false);
                }} disabled={processing}>
                  <Check className="w-4 h-4 mr-2" />
                  Check ({selectedClaims.length})
                </Button>
                <Button variant="destructive" onClick={async () => {
                  setProcessing(true);
                  for (const claimId of selectedClaims) {
                    await base44.entities.Claim.update(claimId, {
                      claim_status: 'Draft',
                      rejection_reason: 'Bulk rejection'
                    });
                  }
                  setSuccessMessage(`${selectedClaims.length} claims rejected`);
                  setSelectedClaims([]);
                  loadData();
                  setProcessing(false);
                }} disabled={processing}>
                  <X className="w-4 h-4 mr-2" />
                  Reject ({selectedClaims.length})
                </Button>
              </>
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

      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Pending Review" value={pendingClaims.length} icon={FileText} className="text-orange-600" />
        <StatCard title="Total Claims" value={claims.length} icon={FileText} className="text-blue-600" />
        <StatCard title="Total Value" value={`Rp ${(claims.reduce((s, c) => s + (c.nilai_klaim || 0), 0) / 1000000).toFixed(1)}M`} icon={DollarSign} />
        <StatCard title="Invoiced" value={claims.filter(c => c.claim_status === 'Invoiced').length} icon={CheckCircle2} className="text-green-600" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="review">Pending ({pendingClaims.length})</TabsTrigger>
          <TabsTrigger value="all">All ({claims.length})</TabsTrigger>
          <TabsTrigger value="subrogation">Subrogation ({subrogations.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="review"><DataTable columns={claimColumns} data={pendingClaims} isLoading={loading} /></TabsContent>
        <TabsContent value="all"><DataTable columns={claimColumns} data={claims} isLoading={loading} /></TabsContent>
        <TabsContent value="subrogation">
          <DataTable
            columns={[
              { header: 'Subrogation ID', accessorKey: 'subrogation_id' },
              { header: 'Claim ID', accessorKey: 'claim_id' },
              { header: 'Recovery', cell: (row) => `Rp ${(row.recovery_amount || 0).toLocaleString()}` },
              { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> }
            ]}
            data={subrogations}
            isLoading={loading}
          />
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'check' && 'Check Claim'}
              {actionType === 'verify' && 'Verify Documents'}
              {actionType === 'invoice' && 'Issue Invoice'}
              {actionType === 'reject' && 'Reject Claim'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {actionType === 'invoice' && (
              <Alert className="bg-blue-50 border-blue-200">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-700">
                  This will create Claim Nota. Payment status managed by Nota Management.
                </AlertDescription>
              </Alert>
            )}
            <div>
              <label className="text-sm font-medium">Remarks</label>
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowActionDialog(false); setRemarks(''); }}>Cancel</Button>
            <Button onClick={handleClaimAction} disabled={processing} className="bg-blue-600">
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Claim Details</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Claim No:</span><span className="ml-2 font-medium">{selectedClaim?.claim_no}</span></div>
              <div><span className="text-gray-500">Debtor:</span><span className="ml-2 font-medium">{selectedClaim?.nama_tertanggung}</span></div>
              <div><span className="text-gray-500">Amount:</span><span className="ml-2 font-medium">Rp {(selectedClaim?.nilai_klaim || 0).toLocaleString()}</span></div>
              <div><span className="text-gray-500">Status:</span><StatusBadge status={selectedClaim?.claim_status} /></div>
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