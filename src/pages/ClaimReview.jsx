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
  Loader2, AlertTriangle, MessageSquare, DollarSign, Download
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import FilterPanel from "@/components/common/FilterPanel";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import StatCard from "@/components/dashboard/StatCard";

export default function ClaimReview() {
  const [user, setUser] = useState(null);
  const [claims, setClaims] = useState([]);
  const [subrogations, setSubrogations] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('review');
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState('');
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [filters, setFilters] = useState({
    contract: 'all',
    batch: '',
    startDate: '',
    endDate: '',
    submitStatus: 'all',
    reconStatus: 'all',
    claimStatus: 'all',
    subrogationStatus: 'all'
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
      const [claimData, subrogationData, contractData] = await Promise.all([
        base44.entities.Claim.list(),
        base44.entities.Subrogation.list(),
        base44.entities.Contract.list()
      ]);
      setClaims(claimData || []);
      setSubrogations(subrogationData || []);
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
      startDate: '',
      endDate: '',
      submitStatus: 'all',
      reconStatus: 'all',
      claimStatus: 'all',
      subrogationStatus: 'all'
    });
  };

  const handleClaimAction = async () => {
    if (!selectedClaim || !actionType) return;

    setProcessing(true);
    try {
      let newStatus = '';
      let updateData = {
        reviewed_by: user?.email,
        review_date: new Date().toISOString().split('T')[0]
      };

      switch (actionType) {
        case 'approve':
          newStatus = 'APPROVED';
          updateData.claim_status = 'APPROVED';
          updateData.approved_amount = parseFloat(approvedAmount) || selectedClaim.nilai_klaim;
          break;
        case 'partial':
          newStatus = 'PARTIALLY_APPROVED';
          updateData.claim_status = 'PARTIALLY_APPROVED';
          updateData.approved_amount = parseFloat(approvedAmount);
          break;
        case 'reject':
          newStatus = 'REJECTED';
          updateData.claim_status = 'REJECTED';
          updateData.rejection_reason = remarks;
          break;
        case 'clarify':
          updateData.claim_status = 'ON_HOLD';
          break;
      }

      await base44.entities.Claim.update(selectedClaim.id, updateData);

      await base44.entities.Notification.create({
        title: `Claim ${newStatus || 'Updated'}`,
        message: `Claim ${selectedClaim.claim_id} has been ${newStatus?.toLowerCase() || 'updated'}`,
        type: actionType === 'reject' ? 'WARNING' : 'DECISION',
        module: 'CLAIM',
        reference_id: selectedClaim.id,
        target_role: 'BRINS'
      });

      await base44.entities.AuditLog.create({
        action: `CLAIM_${actionType.toUpperCase()}`,
        module: 'CLAIM',
        entity_type: 'Claim',
        entity_id: selectedClaim.id,
        old_value: JSON.stringify({ status: selectedClaim.claim_status }),
        new_value: JSON.stringify({ status: newStatus || 'ON_HOLD' }),
        user_email: user?.email,
        user_role: user?.role,
        reason: remarks
      });

      setSuccessMessage(`Claim ${actionType === 'approve' ? 'approved' : actionType === 'reject' ? 'rejected' : 'updated'} successfully`);
      setShowActionDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Action error:', error);
    }
    setProcessing(false);
  };

  const resetForm = () => {
    setSelectedClaim(null);
    setActionType('');
    setApprovedAmount('');
    setRemarks('');
  };

  // Stats
  const pendingClaims = claims.filter(c => c.claim_status === 'SUBMITTED' || c.claim_status === 'UNDER_REVIEW');
  const approvedClaims = claims.filter(c => c.claim_status === 'APPROVED' || c.claim_status === 'PARTIALLY_APPROVED');
  const totalClaimValue = claims.reduce((sum, c) => sum + (c.nilai_klaim || 0), 0);
  const approvedValue = approvedClaims.reduce((sum, c) => sum + (c.approved_amount || 0), 0);

  const claimColumns = [
    { header: 'Claim ID', accessorKey: 'claim_id' },
    {
      header: 'Debtor',
      cell: (row) => (
        <div>
          <p className="font-medium">{row.nama_tertanggung}</p>
        </div>
      )
    },
    { header: 'DOL', accessorKey: 'dol' },
    { header: 'Claim Amount', cell: (row) => `IDR ${(row.nilai_klaim || 0).toLocaleString()}` },
    { header: 'Share Tugure', cell: (row) => `IDR ${(row.share_tugure || 0).toLocaleString()}` },
    { header: 'Status', cell: (row) => <StatusBadge status={row.claim_status} /> },
    { header: 'Eligibility', cell: (row) => <StatusBadge status={row.eligibility_status} /> },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setSelectedClaim(row)}
          >
            <Eye className="w-4 h-4" />
          </Button>
          {row.claim_status === 'SUBMITTED' && (
            <>
              <Button 
                size="sm" 
                className="bg-green-600 hover:bg-green-700"
                onClick={() => {
                  setSelectedClaim(row);
                  setActionType('approve');
                  setApprovedAmount(row.nilai_klaim?.toString() || '');
                  setShowActionDialog(true);
                }}
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button 
                size="sm" 
                variant="destructive"
                onClick={() => {
                  setSelectedClaim(row);
                  setActionType('reject');
                  setShowActionDialog(true);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  setSelectedClaim(row);
                  setActionType('clarify');
                  setShowActionDialog(true);
                }}
              >
                <MessageSquare className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      )
    }
  ];

  const subrogationColumns = [
    { header: 'Subrogation ID', accessorKey: 'subrogation_id' },
    { header: 'Claim ID', accessorKey: 'claim_id' },
    { header: 'Recovery Amount', cell: (row) => `IDR ${(row.recovery_amount || 0).toLocaleString()}` },
    { header: 'Recovery Date', accessorKey: 'recovery_date' },
    { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Eye className="w-4 h-4" />
          </Button>
          {row.status === 'IN_PROGRESS' && (
            <>
              <Button 
                size="sm" 
                className="bg-green-600 hover:bg-green-700"
                onClick={() => {
                  // Handle approve subrogation
                  console.log('Approve subrogation', row);
                }}
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  // Handle update status
                  console.log('Update subrogation', row);
                }}
              >
                <MessageSquare className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Claim Review"
        subtitle="Review and process reinsurance claims"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Claim Review' }
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
                const exportData = claims.map(c => ({
                  claim_id: c.claim_id,
                  debtor: c.nama_tertanggung,
                  dol: c.dol,
                  claim_amount: c.nilai_klaim,
                  share_tugure: c.share_tugure,
                  status: c.claim_status,
                  eligibility: c.eligibility_status
                }));
                const csvContent = [
                  Object.keys(exportData[0]).join(','),
                  ...exportData.map(row => Object.values(row).join(','))
                ].join('\n');
                const blob = new Blob([csvContent], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `claims_${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              Export Excel
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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Pending Review"
          value={pendingClaims.length}
          subtitle="Claims awaiting action"
          icon={FileText}
          gradient
          className="from-orange-500 to-orange-600"
        />
        <StatCard
          title="Total Claims"
          value={claims.length}
          icon={FileText}
          gradient
          className="from-blue-500 to-blue-600"
        />
        <StatCard
          title="Total Claim Value"
          value={`IDR ${(totalClaimValue / 1000000).toFixed(1)}M`}
          icon={DollarSign}
          gradient
          className="from-purple-500 to-purple-600"
        />
        <StatCard
          title="Approved Value"
          value={`IDR ${(approvedValue / 1000000).toFixed(1)}M`}
          icon={CheckCircle2}
          gradient
          className="from-green-500 to-green-600"
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <Select value={filters.contract} onValueChange={(val) => handleFilterChange('contract', val)}>
              <SelectTrigger>
                <SelectValue placeholder="Polis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Contracts</SelectItem>
                {contracts.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.contract_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Batch ID..."
              value={filters.batch}
              onChange={(e) => handleFilterChange('batch', e.target.value)}
            />
            <Input
              type="date"
              placeholder="Start Date"
              value={filters.startDate || ''}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
            <Input
              type="date"
              placeholder="End Date"
              value={filters.endDate || ''}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
            <Select value={filters.claimStatus} onValueChange={(val) => handleFilterChange('claimStatus', val)}>
              <SelectTrigger>
                <SelectValue placeholder="Claim Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Claim Status</SelectItem>
                <SelectItem value="SUBMITTED">Submitted</SelectItem>
                <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="SETTLED">Settled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.subrogationStatus} onValueChange={(val) => handleFilterChange('subrogationStatus', val)}>
              <SelectTrigger>
                <SelectValue placeholder="Subrogation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subrogation</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="RECOVERED">Recovered</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-3 flex justify-end">
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="review">
            <FileText className="w-4 h-4 mr-2" />
            Pending Review ({pendingClaims.length})
          </TabsTrigger>
          <TabsTrigger value="all">
            <FileText className="w-4 h-4 mr-2" />
            All Claims ({claims.length})
          </TabsTrigger>
          <TabsTrigger value="subrogation">
            <DollarSign className="w-4 h-4 mr-2" />
            Subrogation ({subrogations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="review" className="mt-4">
          <DataTable
            columns={claimColumns}
            data={pendingClaims}
            isLoading={loading}
            emptyMessage="No claims pending review"
          />
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          <DataTable
            columns={claimColumns}
            data={claims}
            isLoading={loading}
            emptyMessage="No claims"
          />
        </TabsContent>

        <TabsContent value="subrogation" className="mt-4">
          <DataTable
            columns={subrogationColumns}
            data={subrogations}
            isLoading={loading}
            emptyMessage="No subrogation records"
          />
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' && 'Approve Claim'}
              {actionType === 'partial' && 'Partial Approval'}
              {actionType === 'reject' && 'Reject Claim'}
              {actionType === 'clarify' && 'Request Clarification'}
            </DialogTitle>
            <DialogDescription>
              Claim: {selectedClaim?.claim_id}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 bg-gray-50 rounded-lg mb-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Debtor:</span>
                  <span className="ml-2 font-medium">{selectedClaim?.nama_tertanggung}</span>
                </div>
                <div>
                  <span className="text-gray-500">Claim Amount:</span>
                  <span className="ml-2 font-medium">IDR {(selectedClaim?.nilai_klaim || 0).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-500">DOL:</span>
                  <span className="ml-2 font-medium">{selectedClaim?.dol}</span>
                </div>
                <div>
                  <span className="text-gray-500">Share Tugure:</span>
                  <span className="ml-2 font-medium">IDR {(selectedClaim?.share_tugure || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {(actionType === 'approve' || actionType === 'partial') && (
              <div className="mb-4">
                <label className="text-sm font-medium">Approved Amount (IDR) *</label>
                <Input
                  type="number"
                  value={approvedAmount}
                  onChange={(e) => setApprovedAmount(e.target.value)}
                  placeholder="Enter approved amount"
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium">
                {actionType === 'reject' ? 'Rejection Reason *' : 'Remarks'}
              </label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder={actionType === 'clarify' ? 'Enter clarification needed...' : 'Enter remarks...'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowActionDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleClaimAction}
              disabled={processing || (actionType === 'reject' && !remarks)}
              className={
                actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                actionType === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                'bg-blue-600 hover:bg-blue-700'
              }
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {actionType === 'approve' && <><Check className="w-4 h-4 mr-2" />Approve</>}
                  {actionType === 'partial' && <><Check className="w-4 h-4 mr-2" />Partial Approve</>}
                  {actionType === 'reject' && <><X className="w-4 h-4 mr-2" />Reject</>}
                  {actionType === 'clarify' && <><MessageSquare className="w-4 h-4 mr-2" />Request</>}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}