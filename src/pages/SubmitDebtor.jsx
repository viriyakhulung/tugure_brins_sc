import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Upload, Download, FileSpreadsheet, Users, CheckCircle2, 
  AlertCircle, Loader2, Eye, Send, Plus, Trash2
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";


export default function SubmitDebtor() {
  const [contracts, setContracts] = useState([]);
  const [selectedContract, setSelectedContract] = useState('');
  const [creditType, setCreditType] = useState('Individual');
  const [coverageStart, setCoverageStart] = useState('');
  const [coverageEnd, setCoverageEnd] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Corporate form
  const [corporateDebtors, setCorporateDebtors] = useState([{
    nama_peserta: '',
    plafon: '',
    outstanding: '',
    tenor: '',
    coverage_start: '',
    coverage_end: ''
  }]);

  useEffect(() => {
    loadContracts();
  }, []);

  const loadContracts = async () => {
    try {
      const data = await base44.entities.Contract.list();
      setContracts(data || []);
      if (data && data.length > 0) {
        setSelectedContract(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load contracts:', error);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadedFile(file);
    setLoading(true);
    setErrorMessage('');

    try {
      // Upload file
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      // Extract data with simplified schema for faster processing
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              participant_no: { type: 'string' },
              debtor_name: { type: 'string' },
              loan_account_no: { type: 'string' },
              credit_plafond: { type: 'number' },
              outstanding_amount: { type: 'number' },
              coverage_pct: { type: 'number' },
              gross_premium: { type: 'number' }
            }
          }
        }
      });

      if (result.status === 'success' && result.output) {
        // Parse and enrich data
        const enrichedData = (Array.isArray(result.output) ? result.output : [result.output]).map((row, idx) => ({
          batch_id: `BATCH-${new Date().toISOString().split('T')[0]}-${idx}`,
          batch_month: new Date().getMonth() + 1,
          batch_year: new Date().getFullYear(),
          program_id: 'PROG-001',
          product_code: 'KUR-MIKRO',
          credit_type: creditType,
          currency: 'IDR',
          participant_no: row.participant_no || `P${Date.now()}-${idx}`,
          loan_account_no: row.loan_account_no || `LA${Date.now()}-${idx}`,
          debtor_name: row.debtor_name || '',
          debtor_identifier: '',
          debtor_type: creditType === 'Corporate' ? 'PT' : 'Individual',
          debtor_address: '',
          region_desc: '',
          loan_type: 'KMK',
          loan_type_desc: 'Kredit Modal Kerja',
          covering_type_desc: 'Full Coverage',
          coverage_start_date: coverageStart || new Date().toISOString().split('T')[0],
          coverage_end_date: coverageEnd || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
          credit_plafond: parseFloat(row.credit_plafond) || 0,
          outstanding_amount: parseFloat(row.outstanding_amount) || 0,
          coverage_pct: parseFloat(row.coverage_pct) || 75,
          collectability_col: 1,
          flag_restruktur: 0,
          underwriting_status: 'DRAFT',
          gross_premium: parseFloat(row.gross_premium) || 0,
          reinsurance_premium: 0,
          ric_amount: 0,
          bf_amount: 0,
          net_premium: parseFloat(row.gross_premium) || 0,
          unit_code: 'U001',
          unit_desc: 'Unit Jakarta',
          branch_code: 'BR001',
          branch_desc: 'Cabang Jakarta'
        }));
        
        setPreviewData(enrichedData);
        setShowPreview(true);
      } else {
        setErrorMessage('Failed to extract data from file');
      }
    } catch (error) {
      console.error('File upload error:', error);
      setErrorMessage('Failed to process file. Please check the format and try again.');
    }
    setLoading(false);
  };

  const handleSubmitToTugure = async () => {
    if (!selectedContract) {
      setErrorMessage('Please select a contract');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const batchId = previewData[0]?.batch_id || `BATCH-${Date.now()}`;
      const batchMonth = previewData[0]?.batch_month || new Date().getMonth() + 1;
      const batchYear = previewData[0]?.batch_year || new Date().getFullYear();
      
      // Calculate batch totals
      const totalRecords = previewData.length;
      const totalExposure = previewData.reduce((sum, d) => sum + (d.outstanding_amount || 0), 0);
      const totalPremium = previewData.reduce((sum, d) => sum + (d.gross_premium || 0), 0);

      // 1. Create Batch first
      await base44.entities.Batch.create({
        batch_id: batchId,
        batch_month: batchMonth,
        batch_year: batchYear,
        contract_id: selectedContract,
        total_records: totalRecords,
        total_exposure: totalExposure,
        total_premium: totalPremium,
        status: 'Uploaded'
      });

      // 2. Create Debtors
      const debtorsToCreate = previewData.map(d => ({
        ...d,
        contract_id: selectedContract,
        batch_id: batchId,
        underwriting_status: 'SUBMITTED',
        batch_status: 'SUBMITTED',
        record_status: 'ACTIVE',
        bordero_status: 'PENDING',
        invoice_status: 'NOT_ISSUED',
        recon_status: 'NOT_STARTED',
        claim_status: 'NO_CLAIM',
        subrogation_status: 'NO_SUBROGATION',
        source_system: 'EXCEL-UPLOAD'
      }));

      await base44.entities.Debtor.bulkCreate(debtorsToCreate);

      // 3. Create notification
      await base44.entities.Notification.create({
        title: 'New Debtor Submission',
        message: `Batch ${batchId} with ${debtorsToCreate.length} debtors submitted for approval`,
        type: 'ACTION_REQUIRED',
        module: 'DEBTOR',
        reference_id: batchId,
        target_role: 'TUGURE'
      });

      setSuccessMessage(`Successfully submitted ${debtorsToCreate.length} debtors to Tugure for approval`);
      setPreviewData([]);
      setShowPreview(false);
      setUploadedFile(null);
    } catch (error) {
      console.error('Submit error:', error);
      setErrorMessage('Failed to submit debtors. Please try again.');
    }
    setSubmitting(false);
  };

  const handleCorporateSubmit = async () => {
    if (!selectedContract) {
      setErrorMessage('Please select a contract');
      return;
    }

    const validDebtors = corporateDebtors.filter(d => d.nama_peserta && d.plafon);
    if (validDebtors.length === 0) {
      setErrorMessage('Please add at least one debtor');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const batchId = `BATCH-CORP-${Date.now()}`;
      const batchMonth = new Date().getMonth() + 1;
      const batchYear = new Date().getFullYear();
      
      const debtorsToCreate = validDebtors.map((d, idx) => ({
        contract_id: selectedContract,
        batch_id: batchId,
        batch_month: batchMonth,
        batch_year: batchYear,
        credit_type: 'Corporate',
        currency: 'IDR',
        participant_no: `P${Date.now()}-${idx}`,
        loan_account_no: `LA${Date.now()}-${idx}`,
        debtor_name: d.nama_peserta,
        debtor_type: 'PT',
        credit_plafond: parseFloat(d.plafon) || 0,
        outstanding_amount: parseFloat(d.outstanding) || 0,
        coverage_pct: 75,
        collectability_col: 1,
        flag_restruktur: 0,
        coverage_start_date: d.coverage_start || coverageStart,
        coverage_end_date: d.coverage_end || coverageEnd,
        underwriting_status: 'SUBMITTED',
        batch_status: 'SUBMITTED',
        record_status: 'ACTIVE',
        bordero_status: 'PENDING',
        invoice_status: 'NOT_ISSUED',
        recon_status: 'NOT_STARTED',
        claim_status: 'NO_CLAIM',
        subrogation_status: 'NO_SUBROGATION',
        source_system: 'MANUAL-INPUT'
      }));

      // Calculate batch totals
      const totalRecords = debtorsToCreate.length;
      const totalExposure = debtorsToCreate.reduce((sum, d) => sum + d.outstanding_amount, 0);
      const totalPremium = debtorsToCreate.reduce((sum, d) => sum + (d.credit_plafond * 0.025), 0);

      // 1. Create Batch first
      await base44.entities.Batch.create({
        batch_id: batchId,
        batch_month: batchMonth,
        batch_year: batchYear,
        contract_id: selectedContract,
        total_records: totalRecords,
        total_exposure: totalExposure,
        total_premium: totalPremium,
        status: 'Uploaded'
      });

      // 2. Create Debtors
      await base44.entities.Debtor.bulkCreate(debtorsToCreate);

      // 3. Create notification
      await base44.entities.Notification.create({
        title: 'New Corporate Debtor Submission',
        message: `Batch ${batchId} with ${debtorsToCreate.length} corporate debtors submitted`,
        type: 'ACTION_REQUIRED',
        module: 'DEBTOR',
        reference_id: batchId,
        target_role: 'TUGURE'
      });

      setSuccessMessage(`Successfully submitted ${debtorsToCreate.length} corporate debtors`);
      setCorporateDebtors([{ nama_peserta: '', plafon: '', outstanding: '', tenor: '', coverage_start: '', coverage_end: '' }]);
    } catch (error) {
      console.error('Submit error:', error);
      setErrorMessage('Failed to submit debtors');
    }
    setSubmitting(false);
  };

  const addCorporateDebtor = () => {
    setCorporateDebtors([...corporateDebtors, {
      nama_peserta: '',
      plafon: '',
      outstanding: '',
      tenor: '',
      coverage_start: '',
      coverage_end: ''
    }]);
  };

  const removeCorporateDebtor = (index) => {
    setCorporateDebtors(corporateDebtors.filter((_, i) => i !== index));
  };

  const updateCorporateDebtor = (index, field, value) => {
    const updated = [...corporateDebtors];
    updated[index][field] = value;
    setCorporateDebtors(updated);
  };

  const previewColumns = [
    { header: 'Participant No', accessorKey: 'participant_no' },
    { header: 'Debtor Name', accessorKey: 'debtor_name' },
    { header: 'Type', accessorKey: 'debtor_type' },
    { header: 'Loan Account', accessorKey: 'loan_account_no' },
    { header: 'Plafond', cell: (row) => `Rp ${(row.credit_plafond || 0).toLocaleString('id-ID')}` },
    { header: 'Premium', cell: (row) => `Rp ${(row.gross_premium || 0).toLocaleString('id-ID')}` },
    { header: 'Branch', accessorKey: 'branch_desc' }
  ];

  const downloadTemplate = () => {
    const templateData = [
      // Simplified header - only essential fields for upload
      ['participant_no', 'debtor_name', 'loan_account_no', 'debtor_identifier', 'credit_type', 
       'debtor_type', 'debtor_address', 'credit_plafond', 'outstanding_amount', 'coverage_pct', 
       'coverage_start_date', 'coverage_end_date', 'gross_premium', 'branch_code', 'branch_desc'],
      // Example Individual
      ['P2024001', 'Budi Santoso', '1001234567', '3201234567890123', 'Individual', 
       'Individual', 'Jl. Merdeka No. 45, Jakarta Pusat', '50000000', '45000000', '75', 
       '2024-01-15', '2025-01-14', '500000', 'BR001', 'Cabang Jakarta Pusat'],
      // Example Corporate
      ['P2024002', 'PT Sejahtera Abadi', '1001234568', '01.234.567.8-901.000', 'Corporate', 
       'PT', 'Jl. Sudirman No. 100, Jakarta Selatan', '500000000', '450000000', '80', 
       '2024-01-15', '2025-01-14', '5000000', 'BR002', 'Cabang Jakarta Selatan']
    ];
    
    const csvContent = templateData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'debtor_upload_template.csv';
    a.click();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Submit Debtor & Coverage"
        subtitle="Upload debtor data for reinsurance coverage"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Submit Debtor' }
        ]}
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

      {/* Debtor Upload */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Upload Debtor Data</CardTitle>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              {loading ? (
                <Loader2 className="w-12 h-12 mx-auto text-blue-500 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-12 h-12 mx-auto text-gray-400" />
              )}
              <p className="mt-4 text-gray-600">
                {uploadedFile ? uploadedFile.name : 'Click to upload or drag and drop'}
              </p>
              <p className="text-sm text-gray-400">Excel or CSV files</p>
            </label>
          </div>

          {showPreview && previewData.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Preview ({previewData.length} records)</h3>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowPreview(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSubmitToTugure}
                    disabled={submitting}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Submit to Tugure
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <DataTable columns={previewColumns} data={previewData} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}