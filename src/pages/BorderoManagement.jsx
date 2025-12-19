import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  FileText, CheckCircle2, Clock, Eye, Download, 
  Filter, RefreshCw, Check, X, AlertCircle, Loader2
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import FilterPanel from "@/components/common/FilterPanel";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import { Label } from "@/components/ui/label";

export default function BorderoManagement() {
  const [activeTab, setActiveTab] = useState('debtors');
  const [debtors, setDebtors] = useState([]);
  const [borderos, setBorderos] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [claims, setClaims] = useState([]);
  const [subrogations, setSubrogations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [filters, setFilters] = useState({
    contract: 'all',
    batch: '',
    submitStatus: 'all',
    reconStatus: 'all',
    claimStatus: 'all',
    subrogationStatus: 'all',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [debtorData, borderoData, contractData, claimData, subrogationData] = await Promise.all([
        base44.entities.Debtor.list(),
        base44.entities.Bordero.list(),
        base44.entities.Contract.list(),
        base44.entities.Claim.list(),
        base44.entities.Subrogation.list()
      ]);
      setDebtors(debtorData || []);
      setBorderos(borderoData || []);
      setContracts(contractData || []);
      setClaims(claimData || []);
      setSubrogations(subrogationData || []);
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
      claimStatus: 'all',
      subrogationStatus: 'all',
      startDate: '',
      endDate: ''
    });
  };

  const openDetailDialog = (item) => {
    setSelectedItem(item);
    setShowDetailDialog(true);
  };

  const handleExport = (format) => {
    console.log('Export to:', format);
    // Export functionality
  };

  const filteredDebtors = debtors.filter(d => {
    if (filters.contract !== 'all' && d.contract_id !== filters.contract) return false;
    if (filters.batch && !d.batch_id?.includes(filters.batch)) return false;
    if (filters.submitStatus !== 'all' && d.underwriting_status !== filters.submitStatus) return false;
    if (filters.reconStatus !== 'all' && d.recon_status !== filters.reconStatus) return false;
    if (filters.startDate && d.created_date < filters.startDate) return false;
    if (filters.endDate && d.created_date > filters.endDate) return false;
    return true;
  });

  const filteredClaims = claims.filter(c => {
    if (filters.claimStatus !== 'all' && c.claim_status !== filters.claimStatus) return false;
    if (filters.startDate && c.created_date < filters.startDate) return false;
    if (filters.endDate && c.created_date > filters.endDate) return false;
    return true;
  });

  const filteredSubrogations = subrogations.filter(s => {
    if (filters.subrogationStatus !== 'all' && s.status !== filters.subrogationStatus) return false;
    if (filters.startDate && s.created_date < filters.startDate) return false;
    if (filters.endDate && s.created_date > filters.endDate) return false;
    return true;
  });

  const toggleItemSelection = (itemId) => {
    if (selectedItems.includes(itemId)) {
      setSelectedItems(selectedItems.filter(id => id !== itemId));
    } else {
      setSelectedItems([...selectedItems, itemId]);
    }
  };

  const debtorColumns = [
    {
      header: (
        <Checkbox
          checked={selectedItems.length === filteredDebtors.length && filteredDebtors.length > 0}
          onCheckedChange={(checked) => {
            if (checked) {
              setSelectedItems(filteredDebtors.map(d => d.id));
            } else {
              setSelectedItems([]);
            }
          }}
        />
      ),
      cell: (row) => (
        <Checkbox
          checked={selectedItems.includes(row.id)}
          onCheckedChange={() => toggleItemSelection(row.id)}
        />
      ),
      width: '40px'
    },
    {
      header: 'Debtor',
      cell: (row) => (
        <div>
          <p className="font-medium">{row.debtor_name}</p>
          <p className="text-sm text-gray-500">{row.participant_no}</p>
        </div>
      )
    },
    { header: 'Batch', accessorKey: 'batch_id', cell: (row) => <span className="font-mono text-sm">{row.batch_id}</span> },
    { header: 'Plafond', cell: (row) => `Rp ${(row.credit_plafond || 0).toLocaleString('id-ID')}` },
    { header: 'Net Premium', cell: (row) => `Rp ${(row.net_premium || 0).toLocaleString('id-ID')}` },
    { header: 'Underwriting', cell: (row) => <StatusBadge status={row.underwriting_status} /> },
    { header: 'Bordero Status', cell: (row) => <StatusBadge status={row.bordero_status} /> },
    { header: 'Invoice Status', cell: (row) => <StatusBadge status={row.invoice_status} /> },
    {
      header: 'Actions',
      cell: (row) => (
        <Button variant="outline" size="sm" onClick={() => openDetailDialog(row)}>
          <Eye className="w-4 h-4 mr-1" />
          View
        </Button>
      )
    }
  ];

  const borderoColumns = [
    {
      header: (
        <Checkbox
          checked={selectedItems.length === borderos.length && borderos.length > 0}
          onCheckedChange={(checked) => {
            if (checked) {
              setSelectedItems(borderos.map(b => b.id));
            } else {
              setSelectedItems([]);
            }
          }}
        />
      ),
      cell: (row) => (
        <Checkbox
          checked={selectedItems.includes(row.id)}
          onCheckedChange={() => toggleItemSelection(row.id)}
        />
      ),
      width: '40px'
    },
    { header: 'Bordero ID', accessorKey: 'bordero_id' },
    { header: 'Period', accessorKey: 'period' },
    { header: 'Total Debtors', accessorKey: 'total_debtors' },
    { header: 'Total Exposure', cell: (row) => `IDR ${(row.total_exposure || 0).toLocaleString()}` },
    { header: 'Total Premium', cell: (row) => `IDR ${(row.total_premium || 0).toLocaleString()}` },
    { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
    {
      header: 'Actions',
      cell: (row) => (
        <Button variant="outline" size="sm" onClick={() => openDetailDialog(row)}>
          <Eye className="w-4 h-4 mr-1" />
          View
        </Button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bordero Management"
        subtitle="View debtors, exposure, bordero, claims, and process status"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Bordero Management' }
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
                let data = [];
                let headers = [];
                let sourceData = [];
                
                if (activeTab === 'debtors') {
                  sourceData = selectedItems.length > 0 
                    ? filteredDebtors.filter(d => selectedItems.includes(d.id))
                    : filteredDebtors;
                  headers = ['Debtor', 'Batch', 'Plafond', 'Net Premium', 'Underwriting Status', 'Bordero Status'];
                  data = sourceData.map(d => [d.debtor_name, d.batch_id, d.credit_plafond, d.net_premium, d.underwriting_status, d.bordero_status]);
                } else if (activeTab === 'borderos') {
                  sourceData = selectedItems.length > 0 
                    ? borderos.filter(b => selectedItems.includes(b.id))
                    : borderos;
                  headers = ['Bordero ID', 'Period', 'Total Debtors', 'Total Exposure', 'Total Premium', 'Status'];
                  data = sourceData.map(b => [b.bordero_id, b.period, b.total_debtors, b.total_exposure, b.total_premium, b.status]);
                } else if (activeTab === 'claims') {
                  sourceData = filteredClaims;
                  headers = ['Claim No', 'Debtor', 'DOL', 'Claim Amount', 'Status'];
                  data = sourceData.map(c => [c.claim_no, c.nama_tertanggung, c.dol, c.nilai_klaim, c.claim_status]);
                } else if (activeTab === 'subrogation') {
                  sourceData = filteredSubrogations;
                  headers = ['Subrogation ID', 'Claim ID', 'Recovery Amount', 'Recovery Date', 'Status'];
                  data = sourceData.map(s => [s.subrogation_id, s.claim_id, s.recovery_amount, s.recovery_date, s.status]);
                }
                
                const csv = [headers.join(','), ...data.map(row => row.join(','))].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `bordero-${activeTab}-${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
          </div>
        }
      />

      <FilterPanel
        filters={filters}
        onFilterChange={handleFilterChange}
        onClear={clearFilters}
        contracts={contracts}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="debtors">
            <FileText className="w-4 h-4 mr-2" />
            Debtors ({filteredDebtors.length})
          </TabsTrigger>
          <TabsTrigger value="exposure">
            <FileText className="w-4 h-4 mr-2" />
            Exposure Data
          </TabsTrigger>
          <TabsTrigger value="borderos">
            <FileText className="w-4 h-4 mr-2" />
            Borderos ({borderos.length})
          </TabsTrigger>
          <TabsTrigger value="claims">
            <FileText className="w-4 h-4 mr-2" />
            Claims ({filteredClaims.length})
          </TabsTrigger>
          <TabsTrigger value="subrogation">
            <FileText className="w-4 h-4 mr-2" />
            Subrogation ({filteredSubrogations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="debtors" className="mt-4">
          <DataTable
            columns={debtorColumns}
            data={filteredDebtors}
            isLoading={loading}
            emptyMessage="No debtors found"
          />
        </TabsContent>

        <TabsContent value="exposure" className="mt-4">
          <DataTable
            columns={[
              { header: 'Debtor', cell: (row) => row.debtor_name },
              { header: 'Coverage %', cell: (row) => `${row.coverage_pct}%` },
              { header: 'Credit Plafond', cell: (row) => `Rp ${(row.credit_plafond || 0).toLocaleString('id-ID')}` },
              { header: 'Outstanding', cell: (row) => `Rp ${(row.outstanding_amount || 0).toLocaleString('id-ID')}` },
              { header: 'Underwriting', cell: (row) => <StatusBadge status={row.underwriting_status} /> },
              { header: 'Bordero Status', cell: (row) => <StatusBadge status={row.bordero_status} /> }
            ]}
            data={filteredDebtors.filter(d => d.underwriting_status === 'APPROVED')}
            isLoading={loading}
            emptyMessage="No exposure data"
          />
        </TabsContent>

        <TabsContent value="borderos" className="mt-4">
          <DataTable
            columns={borderoColumns}
            data={borderos}
            isLoading={loading}
            emptyMessage="No borderos generated yet"
          />
        </TabsContent>

        <TabsContent value="claims" className="mt-4">
          <DataTable
            columns={[
              { header: 'Claim No', accessorKey: 'claim_no' },
              { header: 'Debtor', cell: (row) => row.nama_tertanggung },
              { header: 'Policy No', accessorKey: 'policy_no' },
              { header: 'DOL', accessorKey: 'dol' },
              { header: 'Claim Amount', cell: (row) => `IDR ${(row.nilai_klaim || 0).toLocaleString()}` },
              { header: 'Status', cell: (row) => <StatusBadge status={row.claim_status} /> },
              { header: 'Actions', cell: () => <Button variant="outline" size="sm"><Eye className="w-4 h-4" /></Button> }
            ]}
            data={filteredClaims}
            isLoading={loading}
            emptyMessage="No claims found"
          />
        </TabsContent>

        <TabsContent value="subrogation" className="mt-4">
          <DataTable
            columns={[
              { header: 'Subrogation ID', accessorKey: 'subrogation_id' },
              { header: 'Claim ID', accessorKey: 'claim_id' },
              { header: 'Debtor ID', accessorKey: 'debtor_id' },
              { header: 'Recovery Amount', cell: (row) => `IDR ${(row.recovery_amount || 0).toLocaleString()}` },
              { header: 'Recovery Date', accessorKey: 'recovery_date' },
              { header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
              { header: 'Actions', cell: () => <Button variant="outline" size="sm"><Eye className="w-4 h-4" /></Button> }
            ]}
            data={filteredSubrogations}
            isLoading={loading}
            emptyMessage="No subrogation records found"
          />
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {activeTab === 'debtors' && 'Debtor Detail'}
              {activeTab === 'borderos' && 'Bordero Detail'}
              {activeTab === 'claims' && 'Claim Detail'}
              {activeTab === 'subrogations' && 'Subrogation Detail'}
            </DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              {activeTab === 'debtors' && (
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-gray-500">Debtor Name</Label><p className="font-medium">{selectedItem.debtor_name}</p></div>
                  <div><Label className="text-gray-500">Batch ID</Label><p className="font-medium">{selectedItem.batch_id}</p></div>
                  <div><Label className="text-gray-500">Credit Plafond</Label><p className="font-medium">Rp {(selectedItem.credit_plafond || 0).toLocaleString('id-ID')}</p></div>
                  <div><Label className="text-gray-500">Outstanding</Label><p className="font-medium">Rp {(selectedItem.outstanding_amount || 0).toLocaleString('id-ID')}</p></div>
                  <div><Label className="text-gray-500">Net Premium</Label><p className="font-medium">Rp {(selectedItem.net_premium || 0).toLocaleString('id-ID')}</p></div>
                  <div><Label className="text-gray-500">Gross Premium</Label><p className="font-medium">Rp {(selectedItem.gross_premium || 0).toLocaleString('id-ID')}</p></div>
                  <div><Label className="text-gray-500">Underwriting Status</Label><StatusBadge status={selectedItem.underwriting_status} /></div>
                  <div><Label className="text-gray-500">Bordero Status</Label><StatusBadge status={selectedItem.bordero_status} /></div>
                </div>
              )}
              {activeTab === 'borderos' && (
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="text-gray-500">Bordero ID</Label><p className="font-medium">{selectedItem.bordero_id}</p></div>
                  <div><Label className="text-gray-500">Period</Label><p className="font-medium">{selectedItem.period}</p></div>
                  <div><Label className="text-gray-500">Total Debtors</Label><p className="font-medium">{selectedItem.total_debtors}</p></div>
                  <div><Label className="text-gray-500">Total Exposure</Label><p className="font-medium">IDR {(selectedItem.total_exposure || 0).toLocaleString()}</p></div>
                  <div><Label className="text-gray-500">Total Premium</Label><p className="font-medium">IDR {(selectedItem.total_premium || 0).toLocaleString()}</p></div>
                  <div><Label className="text-gray-500">Status</Label><StatusBadge status={selectedItem.status} /></div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}