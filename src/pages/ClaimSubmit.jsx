import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  FileText, Upload, Send, CheckCircle2, AlertCircle, 
  Download, RefreshCw, Loader2, Eye, Plus
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import FilterPanel from "@/components/common/FilterPanel";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";

function ClaimDocumentUploadRow({ docType, existingDoc }) {
  const [file, setFile] = useState(null);
  const [uploaded, setUploaded] = useState(!!existingDoc);
  const [uploading, setUploading] = useState(false);
  const [fileUrl, setFileUrl] = useState(existingDoc?.file_url || null);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      // Simulate upload - in real scenario would upload via base44.integrations.Core.UploadFile
      await new Promise(resolve => setTimeout(resolve, 500));
      setFileUrl(URL.createObjectURL(file));
      setUploaded(true);
    } catch (error) {
      console.error('Upload error:', error);
    }
    setUploading(false);
  };

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
        {(file || existingDoc) && <p className="text-xs text-gray-500 mt-1">{file?.name || existingDoc?.document_name}</p>}
      </div>
      <div className="flex items-center gap-2">
        {(uploaded && fileUrl) && (
          <Button variant="ghost" size="sm" asChild>
            <a href={fileUrl} download={file?.name || existingDoc?.document_name}>
              <Download className="w-4 h-4" />
            </a>
          </Button>
        )}
        <Input
          type="file"
          onChange={(e) => {
            const selectedFile = e.target.files?.[0];
            if (selectedFile) {
              setFile(selectedFile);
              setUploaded(false);
            }
          }}
          accept=".pdf,.jpg,.jpeg,.png"
          className="w-48 text-sm"
        />
        <Button 
          size="sm"
          variant="outline"
          disabled={!file || uploading}
          onClick={handleUpload}
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : uploaded ? 'Re-upload' : 'Upload'}
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
  const [showSubrogationDialog, setShowSubrogationDialog] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Subrogation form state
  const [selectedClaim, setSelectedClaim] = useState('');
  const [recoveryAmount, setRecoveryAmount] = useState('');
  const [recoveryDate, setRecoveryDate] = useState('');
  const [subrogationRemarks, setSubrogationRemarks] = useState('');
  const [activeTab, setActiveTab] = useState('claims');
  const [selectedClaims, setSelectedClaims] = useState([]);
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
  
  // Upload state
  const [uploadFile, setUploadFile] = useState(null);
  const [parsedClaims, setParsedClaims] = useState([]);

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
      
      // Check eligibility - must be APPROVED
      if (debtor?.underwriting_status !== 'APPROVED') {
        setErrorMessage('Cannot submit claim: Debtor must be approved first');
        setProcessing(false);
        return;
      }

      const claimId = `CLM-${Date.now()}`;
      const maxCoverage = (debtor?.credit_plafond || 0) * (debtor?.coverage_pct || 75) / 100;
      const shareTugure = parseFloat(claimAmount) * (debtor?.coverage_pct || 75) / 100;
      
      await base44.entities.Claim.create({
        claim_no: claimId,
        policy_no: `POL/2024/${debtor?.product_code || 'KUR'}/${Date.now()}`,
        certificate_no: `CERT-2024-${debtor?.participant_no || Date.now()}`,
        debtor_id: selectedDebtor,
        contract_id: debtor?.contract_id,
        nama_tertanggung: debtor?.debtor_name,
        no_ktp_npwp: debtor?.debtor_identifier,
        no_fasilitas_kredit: debtor?.loan_account_no,
        bdo_premi: debtor?.batch_id,
        tanggal_realisasi_kredit: debtor?.coverage_start_date,
        plafond: debtor?.credit_plafond,
        max_coverage: maxCoverage,
        kol_debitur: debtor?.collectability_col?.toString() || '1',
        dol: lossDate,
        nilai_klaim: parseFloat(claimAmount),
        share_tugure_pct: debtor?.coverage_pct || 75,
        share_tugure_amount: shareTugure,
        claim_status: 'Draft',
        eligibility_status: 'ELIGIBLE'
      });

      // CRITICAL: Update Debtor claim_status
      await base44.entities.Debtor.update(selectedDebtor, {
        claim_status: 'Draft',
        claim_id: claimId,
        claim_amount: shareTugure
      });

      // Send email notifications
      const notifSettings = await base44.entities.NotificationSetting.list();
      const tugureSettings = notifSettings.filter(s => s.user_role === 'TUGURE' && s.email_enabled && s.notify_claim_status);
      
      for (const setting of tugureSettings) {
        await base44.integrations.Core.SendEmail({
          to: setting.notification_email,
          subject: `New Claim Submitted - ${debtor?.debtor_name}`,
          body: `New claim has been submitted for review.\n\nClaim No: ${claimId}\nDebtor: ${debtor?.debtor_name}\nPlafond: Rp ${(debtor?.credit_plafond || 0).toLocaleString('id-ID')}\nClaim Amount: Rp ${parseFloat(claimAmount).toLocaleString('id-ID')}\nShare TUGURE: ${debtor?.coverage_pct}% (Rp ${shareTugure.toLocaleString('id-ID')})\nDOL: ${lossDate}\n\nPlease review and take action.`
        });
      }

      await base44.entities.Notification.create({
        title: 'New Claim Submitted',
        message: `Claim ${claimId} for ${debtor?.debtor_name} submitted for review`,
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
      // Header matching user requirements
      ['claimno', 'policyno', 'nomor_sertifikat', 'participant_no', 'nama_tertanggung', 'no_ktp_npwp', 
       'no_fasilitas_kredit', 'tanggal_realisasi_kredit', 'nilai_klaim', 'dol', 'kol_debitur', 
       'plafond', 'max_coverage', 'share_tugure_pct', 'share_tugure_amount', 'bdo_premi_period', 'check_bdo_premi'],
      // Example Individual Claim
      ['CLM/2025/01/001', 'POL/2025/KUR/001', 'CERT-2025-P2024001', 'P2024001', 'Budi Santoso', '3201234567890123', 
       '1001234567', '2024-01-15', '35000000', '2024-12-01', '3', 
       '50000000', '37500000', '75', '26250000', '2024-10', 'TRUE'],
      // Example Corporate Claim
      ['CLM/2025/01/002', 'POL/2025/KI/001', 'CERT-2025-P2024002', 'P2024002', 'PT Sejahtera Abadi', '01.234.567.8-901.000', 
       '1001234568', '2024-01-15', '300000000', '2024-12-05', '4', 
       '500000000', '400000000', '80', '240000000', '2024-10', 'TRUE']
    ];
    
    const csvContent = templateData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'claim_upload_template.csv';
    a.click();
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    
    setProcessing(true);
    setErrorMessage('');
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',');
      
      const parsed = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length !== headers.length) continue;
        
        const claim = {
          claim_no: values[0]?.trim(),
          policy_no: values[1]?.trim(),
          certificate_no: values[2]?.trim(),
          participant_no: values[3]?.trim(),
          nama_tertanggung: values[4]?.trim(),
          no_ktp_npwp: values[5]?.trim(),
          no_fasilitas_kredit: values[6]?.trim(),
          tanggal_realisasi_kredit: values[7]?.trim(),
          nilai_klaim: parseFloat(values[8]) || 0,
          dol: values[9]?.trim(),
          kol_debitur: values[10]?.trim(),
          plafond: parseFloat(values[11]) || 0,
          max_coverage: parseFloat(values[12]) || 0,
          share_tugure_pct: parseFloat(values[13]) || 75,
          share_tugure_amount: parseFloat(values[14]) || 0,
          bdo_premi_period: values[15]?.trim(),
          check_bdo_premi: values[16]?.trim().toUpperCase() === 'TRUE'
        };
        parsed.push(claim);
      }
      
      setParsedClaims(parsed);
      setSuccessMessage(`Parsed ${parsed.length} claims from file`);
    } catch (error) {
      console.error('Parse error:', error);
      setErrorMessage('Failed to parse file. Please check format.');
    }
    setProcessing(false);
  };

  const handleBulkUpload = async () => {
    if (parsedClaims.length === 0) {
      setErrorMessage('No claims to upload');
      return;
    }

    setProcessing(true);
    setErrorMessage('');
    try {
      for (const claimData of parsedClaims) {
        const debtor = debtors.find(d => d.participant_no === claimData.participant_no);
        
        await base44.entities.Claim.create({
          claim_no: claimData.claim_no,
          policy_no: claimData.policy_no,
          certificate_no: claimData.certificate_no,
          participant_no: claimData.participant_no,
          debtor_id: debtor?.id || '',
          contract_id: debtor?.contract_id || '',
          nama_tertanggung: claimData.nama_tertanggung,
          no_ktp_npwp: claimData.no_ktp_npwp,
          no_fasilitas_kredit: claimData.no_fasilitas_kredit,
          tanggal_realisasi_kredit: claimData.tanggal_realisasi_kredit,
          plafond: claimData.plafond,
          max_coverage: claimData.max_coverage,
          kol_debitur: claimData.kol_debitur,
          dol: claimData.dol,
          nilai_klaim: claimData.nilai_klaim,
          share_tugure_pct: claimData.share_tugure_pct,
          share_tugure_amount: claimData.share_tugure_amount,
          bdo_premi_period: claimData.bdo_premi_period,
          check_bdo_premi: claimData.check_bdo_premi,
          claim_status: 'Draft',
          eligibility_status: 'PENDING'
        });
        
        if (debtor) {
          await base44.entities.Debtor.update(debtor.id, {
            claim_status: 'Draft',
            claim_id: claimData.claim_no,
            claim_amount: claimData.share_tugure_amount
          });
        }
      }
      
      setSuccessMessage(`Successfully uploaded ${parsedClaims.length} claims`);
      setShowUploadDialog(false);
      setUploadFile(null);
      setParsedClaims([]);
      loadData();
    } catch (error) {
      console.error('Upload error:', error);
      setErrorMessage('Failed to upload claims');
    }
    setProcessing(false);
  };

  const approvedDebtors = debtors.filter(d => d.underwriting_status === 'APPROVED');

  const [selectedClaimForDocs, setSelectedClaimForDocs] = useState(null);
  const [showDocUploadDialog, setShowDocUploadDialog] = useState(false);

  const REQUIRED_CLAIM_DOCS = [
    'Claim Advice',
    'Default Letter',
    'Outstanding Statement',
    'Collection Evidence',
    'Other Supporting Documents'
  ];

  const toggleClaimSelection = (claimId) => {
    if (selectedClaims.includes(claimId)) {
      setSelectedClaims(selectedClaims.filter(id => id !== claimId));
    } else {
      setSelectedClaims([...selectedClaims, claimId]);
    }
  };

  const claimColumns = [
    {
      header: (
        <Checkbox
          checked={selectedClaims.length === claims.length && claims.length > 0}
          onCheckedChange={(checked) => {
            if (checked) {
              setSelectedClaims(claims.map(c => c.id));
            } else {
              setSelectedClaims([]);
            }
          }}
        />
      ),
      cell: (row) => (
        <Checkbox
          checked={selectedClaims.includes(row.id)}
          onCheckedChange={() => toggleClaimSelection(row.id)}
        />
      ),
      width: '40px'
    },
    { header: 'Claim No', accessorKey: 'claim_no' },
    { header: 'Policy No', accessorKey: 'policy_no' },
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
    { header: 'Claim Amount', cell: (row) => `Rp ${(row.nilai_klaim || 0).toLocaleString('id-ID')}` },
    { header: 'Share Tugure', cell: (row) => `${row.share_tugure_pct}% (Rp ${(row.share_tugure_amount || 0).toLocaleString('id-ID')})` },
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
              Download Template
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
                  ['Claim No', 'Debtor', 'DOL', 'Claim Amount', 'Share Tugure %', 'Share Tugure Amount', 'Status'].join(','),
                  ...filteredData.map(c => [
                    c.claim_no, c.nama_tertanggung, c.dol, c.nilai_klaim, c.share_tugure_pct, c.share_tugure_amount, c.claim_status
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
              onClick={() => setShowSubrogationDialog(true)}
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
              Upload required documents for claim: {selectedClaimForDocs?.claim_no || 'N/A'}
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
                      {d.debtor_name} - Rp {(d.credit_plafond || 0).toLocaleString('id-ID')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedDebtor && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Plafond:</span>
                    <span className="ml-2 font-medium">
                      Rp {(debtors.find(d => d.id === selectedDebtor)?.credit_plafond || 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Max Coverage:</span>
                    <span className="ml-2 font-medium">
                      Rp {((debtors.find(d => d.id === selectedDebtor)?.credit_plafond || 0) * (debtors.find(d => d.id === selectedDebtor)?.coverage_pct || 75) / 100).toLocaleString('id-ID')}
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

      {/* New Subrogation Dialog */}
      <Dialog open={showSubrogationDialog} onOpenChange={setShowSubrogationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Subrogation</DialogTitle>
            <DialogDescription>
              Record subrogation recovery for a settled claim
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Select Claim *</Label>
              <Select value={selectedClaim} onValueChange={setSelectedClaim}>
                <SelectTrigger>
                  <SelectValue placeholder="Select settled claim" />
                </SelectTrigger>
                <SelectContent>
                  {claims.filter(c => c.claim_status === 'Paid').map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.claim_no} - {c.nama_tertanggung} (Rp {(c.nilai_klaim || 0).toLocaleString('id-ID')})
                    </SelectItem>
                  ))}
                  {claims.filter(c => c.claim_status === 'Paid').length === 0 && (
                    <SelectItem value="none" disabled>No settled claims available</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Recovery Amount (IDR) *</Label>
              <Input
                type="number"
                value={recoveryAmount}
                onChange={(e) => setRecoveryAmount(e.target.value)}
                placeholder="Enter recovery amount"
              />
            </div>
            <div>
              <Label>Recovery Date *</Label>
              <Input
                type="date"
                value={recoveryDate}
                onChange={(e) => setRecoveryDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Remarks</Label>
              <Input
                value={subrogationRemarks}
                onChange={(e) => setSubrogationRemarks(e.target.value)}
                placeholder="Enter remarks"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowSubrogationDialog(false);
              setSelectedClaim('');
              setRecoveryAmount('');
              setRecoveryDate('');
              setSubrogationRemarks('');
            }}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!selectedClaim || !recoveryAmount || !recoveryDate) {
                  setErrorMessage('Please fill all required fields');
                  return;
                }
                
                setProcessing(true);
                try {
                  const claim = claims.find(c => c.id === selectedClaim);
                  if (!claim) {
                    setErrorMessage('Selected claim not found');
                    setProcessing(false);
                    return;
                  }
                  
                  const subrogationId = `SUB-${Date.now()}`;
                  
                  await base44.entities.Subrogation.create({
                    subrogation_id: subrogationId,
                    claim_id: claim.claim_no,
                    debtor_id: claim.debtor_id,
                    recovery_amount: parseFloat(recoveryAmount),
                    recovery_date: recoveryDate,
                    status: 'Draft',
                    remarks: subrogationRemarks
                  });
                  
                  await base44.entities.Notification.create({
                    title: 'New Subrogation Created',
                    message: `Subrogation ${subrogationId} for claim ${claim.claim_no} created`,
                    type: 'INFO',
                    module: 'CLAIM',
                    reference_id: subrogationId,
                    target_role: 'ALL'
                  });
                  
                  setSuccessMessage('Subrogation created successfully');
                  setShowSubrogationDialog(false);
                  setSelectedClaim('');
                  setRecoveryAmount('');
                  setRecoveryDate('');
                  setSubrogationRemarks('');
                  loadData();
                } catch (error) {
                  console.error('Create error:', error);
                  setErrorMessage('Failed to create subrogation');
                }
                setProcessing(false);
              }}
              disabled={processing || !selectedClaim || !recoveryAmount || !recoveryDate}
              className="bg-green-600 hover:bg-green-700"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Subrogation
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
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setUploadFile(file);
                    handleFileUpload(file);
                  }
                }}
              />
              <p className="text-xs text-gray-500 mt-1">
                Supported formats: CSV (.csv)
              </p>
            </div>
            {parsedClaims.length > 0 && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700">
                  Successfully parsed {parsedClaims.length} claims from file
                </AlertDescription>
              </Alert>
            )}
            <Alert>
              <AlertDescription>
                Make sure your file follows the template format. Download the template if needed.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowUploadDialog(false);
              setUploadFile(null);
              setParsedClaims([]);
            }}>
              Cancel
            </Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700"
              disabled={parsedClaims.length === 0 || processing}
              onClick={handleBulkUpload}
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload {parsedClaims.length} Claims
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}