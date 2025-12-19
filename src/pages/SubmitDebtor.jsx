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
      // Upload file and extract data
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              batch_id: { type: 'string' },
              batch_month: { type: 'number' },
              batch_year: { type: 'number' },
              program_id: { type: 'string' },
              product_code: { type: 'string' },
              credit_type: { type: 'string' },
              participant_no: { type: 'string' },
              loan_account_no: { type: 'string' },
              debtor_name: { type: 'string' },
              debtor_identifier: { type: 'string' },
              debtor_type: { type: 'string' },
              debtor_address: { type: 'string' },
              region_desc: { type: 'string' },
              loan_type: { type: 'string' },
              loan_type_desc: { type: 'string' },
              covering_type_desc: { type: 'string' },
              coverage_start_date: { type: 'string' },
              coverage_end_date: { type: 'string' },
              credit_plafond: { type: 'number' },
              outstanding_amount: { type: 'number' },
              coverage_pct: { type: 'number' },
              collectability_col: { type: 'number' },
              flag_restruktur: { type: 'number' },
              underwriting_status: { type: 'string' },
              gross_premium: { type: 'number' },
              reinsurance_premium: { type: 'number' },
              ric_amount: { type: 'number' },
              bf_amount: { type: 'number' },
              net_premium: { type: 'number' },
              unit_code: { type: 'string' },
              unit_desc: { type: 'string' },
              branch_code: { type: 'string' },
              branch_desc: { type: 'string' }
            }
          }
        }
      });

      if (result.status === 'success' && result.output) {
        setPreviewData(Array.isArray(result.output) ? result.output : [result.output]);
        setShowPreview(true);
      } else {
        setErrorMessage('Failed to extract data from file');
      }
    } catch (error) {
      console.error('File upload error:', error);
      setErrorMessage('Failed to process file. Please check the format.');
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

      // Create notification
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
      const debtorsToCreate = validDebtors.map((d, idx) => ({
        contract_id: selectedContract,
        batch_id: batchId,
        batch_month: new Date().getMonth() + 1,
        batch_year: new Date().getFullYear(),
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

      await base44.entities.Debtor.bulkCreate(debtorsToCreate);

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
      ['batch_id', 'batch_month', 'batch_year', 'program_id', 'product_code', 'credit_type', 'currency', 
       'participant_no', 'loan_account_no', 'debtor_name', 'debtor_identifier', 'debtor_type', 'debtor_address',
       'region_desc', 'loan_type', 'loan_type_desc', 'covering_type_desc', 'coverage_start_date', 'coverage_end_date',
       'credit_plafond', 'outstanding_amount', 'coverage_pct', 'collectability_col', 'flag_restruktur',
       'underwriting_status', 'gross_premium', 'reinsurance_premium', 'ric_amount', 'bf_amount', 'net_premium',
       'unit_code', 'unit_desc', 'branch_code', 'branch_desc'],
      ['BATCH-2024-001', '12', '2024', 'PROG-KUR-001', 'KUR-MIKRO', 'Corporate', 'IDR',
       'P2024001', '1234567890', 'PT Example Corp', '01.234.567.8-901.000', 'PT', 'Jl. Example No. 123, Jakarta',
       'DKI Jakarta', 'KMK', 'Kredit Modal Kerja', 'Full Coverage', '2024-01-15', '2025-01-14',
       '500000000', '450000000', '80', '1', '0', 'DRAFT', '5000000', '4000000', '1300000', '100000', '2600000',
       'U001', 'Unit Jakarta', 'BR001', 'Cabang Jakarta Pusat']
    ];
    
    const csvContent = templateData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'debtor_template.csv';
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