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

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      rows.push(row);
    }
    
    return rows;
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadedFile(file);
    setLoading(true);
    setErrorMessage('');

    try {
      // Read file directly in browser - much faster than AI extraction
      const text = await file.text();
      const parsedData = parseCSV(text);
      
      if (parsedData.length === 0) {
        setErrorMessage('No data found in file');
        setLoading(false);
        return;
      }

      // Map parsed CSV to Debtor entity instantly
      const batchTimestamp = Date.now();
      const batchId = `BATCH-${parsedData[0].batch_year || new Date().getFullYear()}-${String(parsedData[0].batch_month || new Date().getMonth() + 1).padStart(2, '0')}-${batchTimestamp}`;
      
      const enrichedData = parsedData.map((row, idx) => ({
        cover_id: parseInt(row.cover_id) || idx + 1,
        program_id: row.program_id || 'PROG-001',
        batch_id: batchId,
        batch_month: parseInt(row.batch_month) || new Date().getMonth() + 1,
        batch_year: parseInt(row.batch_year) || new Date().getFullYear(),
        participant_no: row.nomor_peserta || `P${batchTimestamp}-${idx}`,
        loan_account_no: row.nomor_rekening_pinjaman || `LA${batchTimestamp}-${idx}`,
        credit_agreement_no: row.nomor_perjanjian_kredit || '',
        debtor_name: row.nama_peserta || '',
        debtor_address: row.alamat_usaha || '',
        debtor_identifier: '',
        debtor_type: creditType === 'Corporate' ? 'PT' : 'Individual',
        credit_type: creditType,
        currency: 'IDR',
        product_code: row.loan_type || 'KUR',
        loan_type: row.loan_type || 'KMK',
        loan_type_desc: row.loan_type_desc || 'Kredit Modal Kerja',
        submission_type_desc: row.jenis_pengajuan_desc || 'Pengajuan Baru',
        covering_type_desc: row.jenis_covering_desc || 'Full Coverage',
        coverage_start_date: row.tanggal_mulai_covering || coverageStart || new Date().toISOString().split('T')[0],
        coverage_end_date: row.tanggal_akhir_covering || coverageEnd || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
        credit_plafond: parseFloat(row.plafon?.replace(/[^0-9.-]/g, '')) || 0,
        outstanding_amount: parseFloat(row.plafon?.replace(/[^0-9.-]/g, '')) || 0,
        coverage_pct: 75,
        gross_premium: parseFloat(row.nominal_premi?.replace(/[^0-9.-]/g, '')) || 0,
        reinsurance_premium: parseFloat(row.premium_reinsurance?.replace(/[^0-9.-]/g, '')) || 0,
        ric_amount: parseFloat(row.ric_amount?.replace(/[^0-9.-]/g, '')) || 0,
        bf_amount: parseFloat(row.bf_amount?.replace(/[^0-9.-]/g, '')) || 0,
        net_premium: parseFloat(row.net_premi?.replace(/[^0-9.-]/g, '')) || 0,
        unit_code: row.unit_code || 'U001',
        unit_desc: row.unit_desc || 'Unit Jakarta',
        branch_code: 'BR001',
        branch_desc: row.branch_desc || 'Cabang Jakarta',
        region_desc: row.region_desc || 'DKI Jakarta',
        received_date: new Date().toISOString(),
        status_aktif: parseInt(row.status_aktif) || 1,
        flag_restruktur: parseInt(row.flag_restruktur) || 0,
        collectability_col: parseInt(row.kolektabilitas) || 1,
        premium_remarks: row.remark_premi || '',
        underwriting_status: 'DRAFT'
      }));
      
      setPreviewData(enrichedData);
      setShowPreview(true);
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
    // Proper CSV formatting with quoted fields to handle commas in addresses
    const escapeCSV = (field) => {
      if (field === null || field === undefined) return '';
      const str = String(field);
      // If field contains comma, quote, or newline, wrap in quotes and escape quotes
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = [
      'cover_id', 'program_id', 'batch_month', 'batch_year', 'nomor_peserta', 'nomor_rekening_pinjaman',
      'nomor_perjanjian_kredit', 'nama_peserta', 'alamat_usaha', 'loan_type', 'loan_type_desc',
      'jenis_pengajuan_desc', 'jenis_covering_desc', 'tanggal_mulai_covering', 'tanggal_akhir_covering',
      'plafon', 'nominal_premi', 'premium_reinsurance', 'ric_amount', 'bf_amount', 'net_premi',
      'unit_code', 'unit_desc', 'branch_desc', 'region_desc', 'status_aktif', 'flag_restruktur',
      'kolektabilitas', 'remark_premi'
    ];

    const sampleData = [
      // Individual Example 1
      ['1001', 'PROG-KUR-001', '1', '2025', 'P2025001', '1001234567', 'PKS-2025-001',
       'Budi Santoso', 'Jl. Merdeka No. 45 Jakarta Pusat', 'KMK', 'Kredit Modal Kerja',
       'Pengajuan Baru', 'Full Coverage', '2025-01-15', '2026-01-14',
       '50000000', '500000', '100000', '30000', '10000', '360000',
       'U001', 'Unit Jakarta', 'Cabang Jakarta Pusat', 'DKI Jakarta', '1', '0',
       '1', 'Premi individual KUR'],
      // Individual Example 2
      ['1002', 'PROG-KUR-001', '1', '2025', 'P2025002', '1001234568', 'PKS-2025-002',
       'Siti Nurhaliza', 'Jl. Gatot Subroto No. 123 Jakarta Selatan', 'KMK', 'Kredit Modal Kerja',
       'Pengajuan Baru', 'Full Coverage', '2025-01-15', '2026-01-14',
       '75000000', '750000', '150000', '45000', '15000', '540000',
       'U002', 'Unit Jakarta Selatan', 'Cabang Jakarta Selatan', 'DKI Jakarta', '1', '0',
       '1', 'Premi individual KMK'],
      // Individual Example 3
      ['1003', 'PROG-KUR-001', '1', '2025', 'P2025003', '1001234569', 'PKS-2025-003',
       'Ahmad Hidayat', 'Jl. Thamrin No. 88 Jakarta Pusat', 'KUR', 'Kredit Usaha Rakyat',
       'Pengajuan Baru', 'Full Coverage', '2025-01-15', '2026-01-14',
       '100000000', '1000000', '200000', '60000', '20000', '720000',
       'U001', 'Unit Jakarta', 'Cabang Jakarta Pusat', 'DKI Jakarta', '1', '0',
       '1', 'Premi KUR Mikro'],
      // Corporate Example 1
      ['2001', 'PROG-CORP-001', '1', '2025', 'C2025001', '2001234567', 'PKS-CORP-2025-001',
       'PT Maju Jaya Sentosa', 'Jl. Sudirman Kav 52-53 Jakarta Selatan', 'KI', 'Kredit Investasi',
       'Pengajuan Baru', 'Proportional Coverage', '2025-01-15', '2026-01-14',
       '500000000', '5000000', '1000000', '300000', '100000', '3600000',
       'U002', 'Unit Jakarta Selatan', 'Cabang Jakarta Selatan', 'DKI Jakarta', '1', '0',
       '1', 'Premi corporate investasi'],
      // Corporate Example 2
      ['2002', 'PROG-CORP-001', '1', '2025', 'C2025002', '2001234568', 'PKS-CORP-2025-002',
       'PT Sejahtera Mandiri', 'Jl. HR Rasuna Said Kav C-22 Jakarta Selatan', 'KI', 'Kredit Investasi',
       'Pengajuan Baru', 'Full Coverage', '2025-01-15', '2026-01-14',
       '1000000000', '10000000', '2000000', '600000', '200000', '7200000',
       'U002', 'Unit Jakarta Selatan', 'Cabang Jakarta Selatan', 'DKI Jakarta', '1', '0',
       '1', 'Premi corporate full coverage']
    ];

    // Build CSV with proper escaping
    const csvRows = [
      headers.map(escapeCSV).join(','),
      ...sampleData.map(row => row.map(escapeCSV).join(','))
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'batch_premi_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
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