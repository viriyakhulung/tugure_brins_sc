import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  FileText, Upload, Send, CheckCircle2, AlertCircle, 
  Download, RefreshCw, Loader2, Eye, Plus
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import FilterPanel from "@/components/common/FilterPanel";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";

function ClaimDocumentUploadRow({ docType }) {
  const [file, setFile] = useState(null);
  const [uploaded, setUploaded] = useState(false);

  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          {uploaded ? (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          ) : (
            <FileText className="w-4 h-4 text-gray-400" />
          )}
          <span className="font-medium text-sm">{docType}</span>
        </div>
        {file && <p className="text-xs text-gray-500 mt-1">{file.name}</p>}
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="file"
          onChange={(e) => {
            setFile(e.target.files[0]);
            setUploaded(false);
          }}
          accept=".pdf,.jpg,.jpeg,.png"
          className="w-48 text-sm"
        />
        <Button 
          size="sm"
          variant="outline"
          disabled={!file}
          onClick={() => setUploaded(true)}
        >
          {uploaded ? 'Re-upload' : 'Upload'}
        </Button>
      </div>
    </div>
  );
}

export default function ClaimSubmit() {
  const [claims, setClaims] = useState([]);
  const [subrogations, setSubrogations] = useState([]);
  const [debtors, setDebtors] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [activeTab, setActiveTab] = useState('claims');
  const [filters, setFilters] = useState({
    contract: 'all',
    batch: '',
    claimStatus: 'all',
    subrogationStatus: 'all'
  });

  // Form state
  const [selectedDebtor, setSelectedDebtor] = useState('');
  const [lossDate, setLossDate] = useState('');
  const [claimAmount, setClaimAmount] = useState('');
  const [claimDocuments, setClaimDocuments] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [claimData, subrogationData, debtorData, contractData] = await Promise.all([
        base44.entities.Claim.list(),
        base44.entities.Subrogation.list(),
        base44.entities.Debtor.list(),
        base44.entities.Contract.list()
      ]);
      setClaims(claimData || []);
      setSubrogations(subrogationData || []);
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
      claimStatus: 'all',
      subrogationStatus: 'all'
    });
  };

  const handleCreateClaim = async () => {
    if (!selectedDebtor || !lossDate || !claimAmount) {
      setErrorMessage('Please fill all required fields');
      return;
    }

    setProcessing(true);
    setErrorMessage('');
    try {
      const debtor = debtors.find(d => d.id === selectedDebtor);
      
      // Check eligibility
      if (debtor?.admin_status !== 'COMPLETE') {
        setErrorMessage('Cannot submit claim: Document eligibility is not complete');
        setProcessing(false);
        return;
      }

      const claimId = `CLM-${Date.now()}`;
      await base44.entities.Claim.create({
        claim_id: claimId,
        debtor_id: selectedDebtor,
        contract_id: debtor?.contract_id,
        nama_tertanggung: debtor?.nama_peserta,
        dol: lossDate,
        nilai_klaim: parseFloat(claimAmount),
        share_tugure: parseFloat(claimAmount) * 0.44,
        plafon: debtor?.plafon,
        max_coverage: (debtor?.plafon || 0) * 0.75,
        claim_status: 'SUBMITTED',
        eligibility_status: 'ELIGIBLE'
      });

      await base44.entities.Notification.create({
        title: 'New Claim Submitted',
        message: `Claim ${claimId} for ${debtor?.nama_peserta} submitted for review`,
        type: 'ACTION_REQUIRED',
        module: 'CLAIM',
        reference_id: claimId,
        target_role: 'TUGURE'
      });

      setSuccessMessage('Claim submitted successfully');
      setShowCreateDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Create error:', error);
      setErrorMessage('Failed to submit claim');
    }
    setProcessing(false);
  };

  const resetForm = () => {
    setSelectedDebtor('');
    setLossDate('');
    setClaimAmount('');
    setClaimDocuments([]);
  };

  const downloadTemplate = () => {
    const templateData = [
      ['NAMA_TERTANGGUNG', 'NO_KTP_NPWP', 'NO_FASILITAS_KREDIT', 'BDO_PREMI', 'TANGGAL_REALISASI_KREDIT', 
       'PLAFOND', 'MAX_COVERAGE', 'KOL_DEBITUR', 'DOL', 'NILAI_KLAIM', 'SHARE_TUGURE'],
      ['Nama Debitur A', '17101500875158', 'Juni 2023', '27-Jun-23', '200000000', 
       '150000000', 'Kol 4', '22-Sep-24', '114685298', '50461531', '44%']
    ];
    
    const csvContent = templateData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'claim_template.csv';
    a.click();
  };

  const approvedDebtors = debtors.filter(d => d.submit_status === 'APPROVED');

  const [selectedClaimForDocs, setSelectedClaimForDocs] = useState(null);
  const [showDocUploadDialog, setShowDocUploadDialog] = useState(false);

  const REQUIRED_CLAIM_DOCS = [
    'Claim Advice',
    'Default Letter',
    'Outstanding Statement',
    'Collection Evidence',
    'Other Supporting Documents'
  ];

  const claimColumns = [
    { header: 'Claim ID', accessorKey: 'claim_id' },
    {
      header: 'Debtor',
      cell: (row) => (
        <div>
          <p className="font-medium">{row.nama_tertanggung}</p>
          <p className="text-sm text-gray-500">{row.no_fasilitas_kredit}</p>
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
            onClick={() => {
              setSelectedClaimForDocs(row);
              setShowDocUploadDialog(true);
            }}
          >
            <Upload className="w-4 h-4 mr-1" />
            Docs
          </Button>
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
        <Button variant="outline" size="sm">
          <Eye className="w-4 h-4" />
        </Button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Claim Submission"
        subtitle="Submit and manage reinsurance claims"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Claim Submit' }
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-2" />
              Template
            </Button>
            <Button 
              variant="outline"
              onClick={() => setShowUploadDialog(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Claims
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => {
                const filteredData = claims.filter(c => {
                  if (filters.contract !== 'all' && c.contract_id !== filters.contract) return false;
                  if (filters.claimStatus !== 'all' && c.claim_status !== filters.claimStatus) return false;
                  return true;
                });
                const csv = [
                  ['Claim ID', 'Debtor', 'DOL', 'Claim Amount', 'Share Tugure', 'Status'].join(','),
                  ...filteredData.map(c => [
                    c.claim_id, c.nama_tertanggung, c.dol, c.nilai_klaim, c.share_tugure, c.claim_status
                  ].join(','))
                ].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'claims-export.csv';
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

      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <FilterPanel
        filters={filters}
        onFilterChange={handleFilterChange}
        onClear={clearFilters}
        contracts={contracts}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="claims">
            <FileText className="w-4 h-4 mr-2" />
            Claims ({claims.length})
          </TabsTrigger>
          <TabsTrigger value="subrogation">
            <FileText className="w-4 h-4 mr-2" />
            Subrogation ({subrogations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="claims" className="mt-4">
          <DataTable
            columns={claimColumns}
            data={claims}
            isLoading={loading}
            emptyMessage="No claims submitted"
          />
        </TabsContent>

        <TabsContent value="subrogation" className="mt-4">
          <div className="mb-4 flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Subrogation records for settled claims
            </p>
            <Button 
              className="bg-green-600 hover:bg-green-700"
              onClick={() => {
                // Create subrogation dialog
                console.log('Create subrogation');
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Subrogation
            </Button>
          </div>
          <DataTable
            columns={subrogationColumns}
            data={subrogations}
            isLoading={loading}
            emptyMessage="No subrogation records"
          />
        </TabsContent>
      </Tabs>

      {/* Document Upload Dialog */}
      <Dialog open={showDocUploadDialog} onOpenChange={setShowDocUploadDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Claim Documents</DialogTitle>
            <DialogDescription>
              Upload required documents for claim: {selectedClaimForDocs?.claim_id || 'N/A'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {REQUIRED_CLAIM_DOCS.map(docType => (
              <ClaimDocumentUploadRow key={docType} docType={docType} />
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowDocUploadDialog(false);
              setSelectedClaimForDocs(null);
            }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Claim Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submit New Claim</DialogTitle>
            <DialogDescription>
              Create a claim for an approved debtor and upload required documents
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Debtor *</Label>
              <Select value={selectedDebtor} onValueChange={setSelectedDebtor}>
                <SelectTrigger>
                  <SelectValue placeholder="Select debtor" />
                </SelectTrigger>
                <SelectContent>
                  {approvedDebtors.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nama_peserta} - IDR {(d.plafon || 0).toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedDebtor && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Plafon:</span>
                    <span className="ml-2 font-medium">
                      IDR {(debtors.find(d => d.id === selectedDebtor)?.plafon || 0).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Max Coverage:</span>
                    <span className="ml-2 font-medium">
                      IDR {((debtors.find(d => d.id === selectedDebtor)?.plafon || 0) * 0.75).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label>Date of Loss (DOL) *</Label>
              <Input
                type="date"
                value={lossDate}
                onChange={(e) => setLossDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Claim Amount (IDR) *</Label>
              <Input
                type="number"
                value={claimAmount}
                onChange={(e) => setClaimAmount(e.target.value)}
                placeholder="Enter claim amount"
              />
            </div>
            
            <div className="border-t pt-4">
              <Label className="text-base font-semibold mb-3 block">Upload Required Documents</Label>
              <div className="space-y-3">
                <ClaimDocumentUploadRow docType="Claim Advice" />
                <ClaimDocumentUploadRow docType="Default Letter" />
                <ClaimDocumentUploadRow docType="Outstanding Statement" />
                <ClaimDocumentUploadRow docType="Collection Evidence" />
                <ClaimDocumentUploadRow docType="Other Supporting Documents" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateClaim}
              disabled={processing || !selectedDebtor || !lossDate || !claimAmount}
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
                  Submit Claim
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Claims Dialog (Excel/CSV) */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Claims (Excel/CSV)</DialogTitle>
            <DialogDescription>
              Upload multiple claims from Excel or CSV file
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Upload File</Label>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    console.log('File selected:', file.name);
                    // Handle file upload and processing
                  }
                }}
              />
              <p className="text-xs text-gray-500 mt-1">
                Supported formats: Excel (.xlsx, .xls) or CSV (.csv)
              </p>
            </div>
            <Alert>
              <AlertDescription>
                Make sure your file follows the template format. Download the template if needed.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              Cancel
            </Button>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}