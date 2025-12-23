import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, Download, FileSpreadsheet, CheckCircle2, 
  AlertCircle, Loader2, Send, DollarSign, Clock
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";

export default function SubmitDebtor() {
  const [contracts, setContracts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedContract, setSelectedContract] = useState('');
  const [submissionMode, setSubmissionMode] = useState('new'); // 'new' or 'revise'
  const [selectedBatch, setSelectedBatch] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [validationRemarks, setValidationRemarks] = useState([]);

  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUser();
    loadContracts();
    loadBatches();
  }, []);

  const loadUser = () => {
    try {
      const demoUserStr = localStorage.getItem('demo_user');
      if (demoUserStr) {
        setUser(JSON.parse(demoUserStr));
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    }
  };

  const loadContracts = async () => {
    try {
      const masterContracts = await base44.entities.MasterContract.list();
      const activeContracts = masterContracts.filter(c => c.effective_status === 'Active');
      setContracts(activeContracts || []);
    } catch (error) {
      console.error('Failed to load contracts:', error);
    }
  };

  const loadBatches = async () => {
    try {
      const data = await base44.entities.Batch.list();
      setBatches(data || []);
    } catch (error) {
      console.error('Failed to load batches:', error);
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
    
    if (!selectedContract) {
      setErrorMessage('Please select an active contract first');
      return;
    }

    if (submissionMode === 'revise' && !selectedBatch) {
      setErrorMessage('Please select a batch to revise');
      return;
    }

    setUploadedFile(file);
    setLoading(true);
    setErrorMessage('');
    setValidationRemarks([]);

    try {
      const contract = contracts.find(c => c.id === selectedContract);
      if (!contract) {
        setErrorMessage('Selected contract not found');
        setLoading(false);
        return;
      }

      const text = await file.text();
      const parsedData = parseCSV(text);
      
      if (parsedData.length === 0) {
        setErrorMessage('No data found in file');
        setLoading(false);
        return;
      }

      const batchTimestamp = Date.now();
      const batchId = submissionMode === 'revise' && selectedBatch 
        ? batches.find(b => b.id === selectedBatch)?.batch_id
        : `BATCH-${parsedData[0].batch_year || new Date().getFullYear()}-${String(parsedData[0].batch_month || new Date().getMonth() + 1).padStart(2, '0')}-${batchTimestamp}`;
      
      const validationErrors = [];
      const enrichedData = parsedData.map((row, idx) => {
        const creditType = row.credit_type || contract.credit_type;
        const creditPlafond = parseFloat(row.plafon?.replace(/[^0-9.-]/g, '')) || 0;
        const coverageStartDate = row.tanggal_mulai_covering || new Date().toISOString().split('T')[0];
        
        // Validation
        let rowRemarks = [];
        
        if (contract.credit_type !== creditType) {
          rowRemarks.push(`Credit type mismatch: expected ${contract.credit_type}, got ${creditType}`);
        }
        
        if (coverageStartDate < contract.coverage_start_date || coverageStartDate > contract.coverage_end_date) {
          rowRemarks.push(`Coverage date outside contract period (${contract.coverage_start_date} - ${contract.coverage_end_date})`);
        }
        
        if (creditPlafond > contract.coverage_limit) {
          rowRemarks.push(`Plafond exceeds contract limit (Rp ${contract.coverage_limit.toLocaleString()})`);
        }
        
        if (rowRemarks.length > 0) {
          validationErrors.push({ 
            row: idx + 2, 
            debtor: row.nama_peserta, 
            issues: rowRemarks 
          });
        }
        
        return {
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
          coverage_start_date: coverageStartDate,
          coverage_end_date: row.tanggal_akhir_covering || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
          credit_plafond: creditPlafond,
          outstanding_amount: creditPlafond,
          coverage_pct: contract.reinsurance_share || 75,
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
          underwriting_status: 'DRAFT',
          validation_remarks: rowRemarks.join('; ')
        };
      });
      
      setPreviewData(enrichedData);
      setValidationRemarks(validationErrors);
      setShowPreview(true);
      
      if (validationErrors.length > 0) {
        setErrorMessage(`${validationErrors.length} validation issues found - check remarks below`);
        
        await base44.entities.Notification.create({
          title: 'Batch Validation Issues',
          message: `${validationErrors.length} debtors have validation issues against contract ${contract.contract_id}`,
          type: 'WARNING',
          module: 'DEBTOR',
          reference_id: batchId,
          target_role: 'BRINS'
        });
      } else {
        setSuccessMessage(`Loaded ${enrichedData.length} debtors - all validated successfully`);
      }
    } catch (error) {
      console.error('File upload error:', error);
      setErrorMessage('Failed to process file');
    }
    setLoading(false);
  };

  const handleSubmitToTugure = async () => {
    if (!selectedContract) {
      setErrorMessage('Please select an active contract');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const batchId = previewData[0]?.batch_id || `BATCH-${Date.now()}`;
      const batchMonth = previewData[0]?.batch_month || new Date().getMonth() + 1;
      const batchYear = previewData[0]?.batch_year || new Date().getFullYear();
      
      const totalRecords = previewData.length;
      const totalExposure = previewData.reduce((sum, d) => sum + (d.outstanding_amount || 0), 0);
      const totalPremium = previewData.reduce((sum, d) => sum + (d.gross_premium || 0), 0);

      if (submissionMode === 'revise' && selectedBatch) {
        // Revise mode: mark old debtors inactive and update batch version
        const batch = batches.find(b => b.id === selectedBatch);
        const oldDebtors = await base44.entities.Debtor.filter({ batch_id: batch.batch_id });
        
        for (const oldDebtor of oldDebtors) {
          await base44.entities.Debtor.update(oldDebtor.id, {
            record_status: 'INACTIVE'
          });
        }
        
        await base44.entities.Batch.update(selectedBatch, {
          total_records: totalRecords,
          total_exposure: totalExposure,
          total_premium: totalPremium,
          status: 'Uploaded',
          version: (batch.version || 1) + 1
        });
        
        await base44.entities.AuditLog.create({
          action: 'BATCH_REVISED',
          module: 'DEBTOR',
          entity_type: 'Batch',
          entity_id: batch.batch_id,
          old_value: `v${batch.version || 1}`,
          new_value: `v${(batch.version || 1) + 1}`,
          user_email: user?.email,
          user_role: user?.role
        });
      } else {
        // New batch mode
        await base44.entities.Batch.create({
          batch_id: batchId,
          batch_month: batchMonth,
          batch_year: batchYear,
          contract_id: selectedContract,
          total_records: totalRecords,
          total_exposure: totalExposure,
          total_premium: totalPremium,
          status: 'Uploaded',
          version: 1
        });
      }

      const debtorsToCreate = previewData.map(d => ({
        ...d,
        contract_id: selectedContract,
        underwriting_status: 'SUBMITTED',
        batch_status: 'Uploaded',
        record_status: 'ACTIVE',
        bordero_status: 'PENDING',
        invoice_status: 'NOT_ISSUED',
        recon_status: 'NOT_STARTED',
        claim_status: 'NO_CLAIM',
        subrogation_status: 'NO_SUBROGATION',
        source_system: 'EXCEL-UPLOAD'
      }));

      await base44.entities.Debtor.bulkCreate(debtorsToCreate);

      await base44.entities.Notification.create({
        title: submissionMode === 'revise' ? 'Batch Revised' : 'New Batch Submitted',
        message: `Batch ${batchId} with ${debtorsToCreate.length} debtors ${submissionMode === 'revise' ? 'revised' : 'submitted'}`,
        type: 'ACTION_REQUIRED',
        module: 'DEBTOR',
        reference_id: batchId,
        target_role: 'TUGURE'
      });

      setSuccessMessage(`Successfully ${submissionMode === 'revise' ? 'revised' : 'submitted'} ${debtorsToCreate.length} debtors`);
      setPreviewData([]);
      setShowPreview(false);
      setUploadedFile(null);
      setSelectedBatch('');
      loadBatches();
    } catch (error) {
      console.error('Submit error:', error);
      setErrorMessage('Failed to submit debtors');
    }
    setSubmitting(false);
  };

  const previewColumns = [
    { header: 'Participant No', accessorKey: 'participant_no' },
    { header: 'Debtor Name', accessorKey: 'debtor_name' },
    { header: 'Type', accessorKey: 'debtor_type' },
    { header: 'Plafond', cell: (row) => `Rp ${(row.credit_plafond || 0).toLocaleString('id-ID')}` },
    { header: 'Premium', cell: (row) => `Rp ${(row.gross_premium || 0).toLocaleString('id-ID')}` },
    { header: 'Validation', cell: (row) => row.validation_remarks ? <Badge variant="destructive">Issues</Badge> : <Badge className="bg-green-100 text-green-700">OK</Badge> }
  ];

  const downloadTemplate = () => {
    const headers = [
      'cover_id', 'program_id', 'batch_month', 'batch_year', 'nomor_peserta', 'nomor_rekening_pinjaman',
      'nomor_perjanjian_kredit', 'nama_peserta', 'alamat_usaha', 'loan_type', 'loan_type_desc',
      'jenis_pengajuan_desc', 'jenis_covering_desc', 'tanggal_mulai_covering', 'tanggal_akhir_covering',
      'plafon', 'nominal_premi', 'premium_reinsurance', 'ric_amount', 'bf_amount', 'net_premi',
      'unit_code', 'unit_desc', 'branch_desc', 'region_desc', 'status_aktif', 'flag_restruktur',
      'kolektabilitas', 'remark_premi'
    ];

    const sampleData = [
      ['1001', 'PROG-KUR-001', '1', '2025', 'P2025001', '1001234567', 'PKS-2025-001',
       'Budi Santoso', 'Jl. Merdeka No. 45 Jakarta', 'KMK', 'Kredit Modal Kerja',
       'Pengajuan Baru', 'Full Coverage', '2025-01-15', '2026-01-14',
       '50000000', '500000', '100000', '30000', '10000', '360000',
       'U001', 'Unit Jakarta', 'Cabang Jakarta', 'DKI Jakarta', '1', '0', '1', '']
    ];

    const csvContent = [headers.join(','), ...sampleData.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'batch_debtor_template.csv';
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

      {validationRemarks.length > 0 && (
        <Card className="border-orange-300 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-700">System Validation Remarks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {validationRemarks.map((remark, idx) => (
                <Alert key={idx} className="bg-orange-100 border-orange-300">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-800">
                    <strong>Row {remark.row} ({remark.debtor}):</strong> {remark.issues.join(', ')}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>1. Select Active Contract</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedContract} onValueChange={setSelectedContract}>
            <SelectTrigger>
              <SelectValue placeholder="Select active master contract" />
            </SelectTrigger>
            <SelectContent>
              {contracts.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.contract_id} - {c.policy_number} ({c.credit_type}) - Limit: Rp {(c.coverage_limit || 0).toLocaleString('id-ID')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedContract && (
            <Alert className="mt-3 bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                Selected: {contracts.find(c => c.id === selectedContract)?.contract_id} - All uploaded debtors will be validated against this contract
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Choose Submission Mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={submissionMode} onValueChange={setSubmissionMode}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New Batch Submission</SelectItem>
              <SelectItem value="revise">Revise Existing Batch</SelectItem>
            </SelectContent>
          </Select>
          
          {submissionMode === 'revise' && selectedContract && (
            <Select value={selectedBatch} onValueChange={setSelectedBatch}>
              <SelectTrigger>
                <SelectValue placeholder="Select batch to revise" />
              </SelectTrigger>
              <SelectContent>
                {batches.filter(b => b.contract_id === selectedContract).map(b => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.batch_id} (v{b.version || 1}) - {b.total_records} debtors - Status: {b.status}
                  </SelectItem>
                ))}
                {batches.filter(b => b.contract_id === selectedContract).length === 0 && (
                  <SelectItem value="none" disabled>No batches found for this contract</SelectItem>
                )}
              </SelectContent>
            </Select>
          )}
          
          {submissionMode === 'revise' && selectedBatch && (
            <Alert className="bg-orange-50 border-orange-200">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-700">
                Revising batch will create new version (v{(batches.find(b => b.id === selectedBatch)?.version || 1) + 1}) and mark old debtors as inactive
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>3. Upload Batch File</CardTitle>
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
              disabled={!selectedContract}
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              {loading ? (
                <Loader2 className="w-12 h-12 mx-auto text-blue-500 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-12 h-12 mx-auto text-gray-400" />
              )}
              <p className="mt-4 text-gray-600">
                {uploadedFile ? uploadedFile.name : 'Click to upload CSV file'}
              </p>
              {!selectedContract && (
                <p className="text-sm text-orange-600 mt-2">⚠️ Please select a contract first</p>
              )}
            </label>
          </div>

          {showPreview && previewData.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Preview ({previewData.length} records)</h3>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setShowPreview(false); setValidationRemarks([]); }}>
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