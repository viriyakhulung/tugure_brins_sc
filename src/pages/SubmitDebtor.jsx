import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Upload, Download, FileSpreadsheet, CheckCircle2, 
  AlertCircle, Loader2, Send, DollarSign, Clock, RefreshCw, Eye, Filter
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import ModernKPI from "@/components/dashboard/ModernKPI";

export default function SubmitDebtor() {
  const [contracts, setContracts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [myDebtors, setMyDebtors] = useState([]);
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
  const [showReviseDialog, setShowReviseDialog] = useState(false);
  const [selectedDebtorForRevision, setSelectedDebtorForRevision] = useState(null);
  const [revisionFormData, setRevisionFormData] = useState({});
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [activeTab, setActiveTab] = useState('upload');

  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUser();
    loadContracts();
    loadBatches();
  }, []);

  useEffect(() => {
    if (user) {
      loadMyDebtors();
    }
  }, [user]);

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

  const loadMyDebtors = async () => {
    if (!user?.email) {
      console.log('User email not available yet');
      return;
    }
    
    try {
      const allDebtors = await base44.entities.Debtor.list();
      console.log('All debtors loaded:', allDebtors.length);
      console.log('Current user email:', user.email);
      
      // Filter by created_by email
      const mySubmittedDebtors = allDebtors.filter(d => 
        d.created_by === user?.email && 
        d.record_status === 'ACTIVE'
      );
      
      console.log('My submitted debtors:', mySubmittedDebtors.length);
      setMyDebtors(mySubmittedDebtors || []);
    } catch (error) {
      console.error('Failed to load my debtors:', error);
      setMyDebtors([]);
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

      // CRITICAL: BLOCK upload if contract is not ACTIVE
      if (contract.effective_status !== 'Active') {
        setErrorMessage(`❌ BLOCKED: Cannot upload debtor data.\n\nOnly ACTIVE contract versions may be used for debtor batch validation.\n\nCurrent contract status: ${contract.effective_status}`);
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
        batch_status: 'SUBMITTED',
        record_status: 'ACTIVE',
        bordero_status: 'PENDING',
        invoice_status: 'NOT_ISSUED',
        recon_status: 'NOT_STARTED',
        claim_status: 'NO_CLAIM',
        subrogation_status: 'NO_SUBROGATION',
        source_system: 'EXCEL-UPLOAD'
      }));

      // Create debtors one by one to ensure created_by is set
      for (const debtor of debtorsToCreate) {
        await base44.entities.Debtor.create(debtor);
      }

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
      
      // Reload data with delay to ensure DB updated
      setTimeout(async () => {
        await loadBatches();
        await loadMyDebtors();
        setActiveTab('tracking'); // Switch to tracking tab AFTER data loaded
      }, 1000);
    } catch (error) {
      console.error('Submit error:', error);
      setErrorMessage('Failed to submit debtors');
    }
    setSubmitting(false);
  };

  const handleReviseDebtor = (debtor) => {
    setSelectedDebtorForRevision(debtor);
    setRevisionFormData({
      debtor_name: debtor.debtor_name,
      participant_no: debtor.participant_no,
      loan_account_no: debtor.loan_account_no,
      credit_plafond: debtor.credit_plafond,
      outstanding_amount: debtor.outstanding_amount,
      gross_premium: debtor.gross_premium,
      net_premium: debtor.net_premium,
      coverage_start_date: debtor.coverage_start_date,
      coverage_end_date: debtor.coverage_end_date,
      debtor_address: debtor.debtor_address,
      revision_reason: ''
    });
    setShowReviseDialog(true);
  };

  const submitRevision = async () => {
    if (!revisionFormData.revision_reason) {
      setErrorMessage('Please provide revision reason');
      return;
    }

    setSubmitting(true);
    try {
      const originalDebtor = selectedDebtorForRevision;
      const newRevisionNumber = (originalDebtor.revision_number || 1) + 1;

      // Create new debtor as revision
      await base44.entities.Debtor.create({
        ...originalDebtor,
        id: undefined,
        debtor_name: revisionFormData.debtor_name,
        participant_no: revisionFormData.participant_no,
        loan_account_no: revisionFormData.loan_account_no,
        credit_plafond: parseFloat(revisionFormData.credit_plafond),
        outstanding_amount: parseFloat(revisionFormData.outstanding_amount),
        gross_premium: parseFloat(revisionFormData.gross_premium),
        net_premium: parseFloat(revisionFormData.net_premium),
        coverage_start_date: revisionFormData.coverage_start_date,
        coverage_end_date: revisionFormData.coverage_end_date,
        debtor_address: revisionFormData.debtor_address,
        is_revision: true,
        parent_debtor_id: originalDebtor.id,
        revision_number: newRevisionNumber,
        revision_reason: revisionFormData.revision_reason,
        underwriting_status: 'SUBMITTED',
        rejection_reason: null,
        record_status: 'ACTIVE'
      });

      // Mark original as inactive
      await base44.entities.Debtor.update(originalDebtor.id, {
        record_status: 'INACTIVE'
      });

      // Create notification
      await base44.entities.Notification.create({
        title: 'Debtor Revised and Resubmitted',
        message: `${originalDebtor.debtor_name} (${originalDebtor.participant_no}) has been revised (v${newRevisionNumber}) and resubmitted for review. Reason: ${revisionFormData.revision_reason}`,
        type: 'ACTION_REQUIRED',
        module: 'DEBTOR',
        reference_id: originalDebtor.batch_id,
        target_role: 'TUGURE'
      });

      // Audit log
      await base44.entities.AuditLog.create({
        action: 'DEBTOR_REVISED',
        module: 'DEBTOR',
        entity_type: 'Debtor',
        entity_id: originalDebtor.id,
        old_value: `v${originalDebtor.revision_number || 1} - REJECTED`,
        new_value: `v${newRevisionNumber} - SUBMITTED`,
        user_email: user?.email,
        user_role: user?.role,
        reason: revisionFormData.revision_reason
      });

      setSuccessMessage(`Debtor ${originalDebtor.debtor_name} revised successfully (v${newRevisionNumber})`);
      setShowReviseDialog(false);
      setSelectedDebtorForRevision(null);
      
      // Reload with delay
      setTimeout(() => {
        loadMyDebtors();
      }, 500);
    } catch (error) {
      console.error('Revision error:', error);
      setErrorMessage('Failed to submit revision');
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

  const filteredMyDebtors = filterStatus === 'ALL' 
    ? myDebtors 
    : myDebtors.filter(d => d.underwriting_status === filterStatus);

  const myDebtorsColumns = [
    { 
      header: 'Batch ID', 
      cell: (row) => (
        <div>
          <div className="font-mono text-sm">{row.batch_id}</div>
          {row.is_revision && (
            <Badge variant="outline" className="text-xs mt-1">v{row.revision_number}</Badge>
          )}
        </div>
      )
    },
    { header: 'Participant No', accessorKey: 'participant_no' },
    { 
      header: 'Debtor Name', 
      cell: (row) => (
        <div>
          <div className="font-medium">{row.debtor_name}</div>
          <div className="text-xs text-gray-500">{row.loan_account_no}</div>
        </div>
      )
    },
    { 
      header: 'Financial', 
      cell: (row) => (
        <div className="text-sm">
          <div>Plafond: Rp {((row.credit_plafond || 0) / 1000000).toFixed(1)}M</div>
          <div className="text-gray-500">Premium: Rp {((row.net_premium || 0) / 1000000).toFixed(2)}M</div>
        </div>
      )
    },
    { 
      header: 'Status', 
      cell: (row) => <StatusBadge status={row.underwriting_status} />
    },
    {
      header: 'Review Result',
      cell: (row) => (
        <div className="text-xs">
          {row.underwriting_status === 'REJECTED' && row.rejection_reason && (
            <div className="text-red-600 max-w-xs">
              <strong>Rejected:</strong> {row.rejection_reason}
            </div>
          )}
          {row.underwriting_status === 'APPROVED' && (
            <div className="text-green-600">✓ Approved</div>
          )}
          {row.underwriting_status === 'SUBMITTED' && (
            <div className="text-blue-600">⏳ Under Review</div>
          )}
          {row.underwriting_status === 'DRAFT' && (
            <div className="text-gray-500">Not Submitted</div>
          )}
        </div>
      )
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-2">
          {row.underwriting_status === 'REJECTED' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleReviseDebtor(row)}
              className="text-blue-600 hover:text-blue-700"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Revise
            </Button>
          )}
        </div>
      )
    }
  ];

  const debtorStats = {
    total: myDebtors.length,
    submitted: myDebtors.filter(d => d.underwriting_status === 'SUBMITTED').length,
    approved: myDebtors.filter(d => d.underwriting_status === 'APPROVED').length,
    rejected: myDebtors.filter(d => d.underwriting_status === 'REJECTED').length
  };

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
        subtitle="Upload and track debtor submissions for reinsurance coverage"
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">Upload New Batch</TabsTrigger>
          <TabsTrigger value="tracking">My Submissions ({myDebtors.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6 mt-6">
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
        </TabsContent>

        <TabsContent value="tracking" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <ModernKPI 
              title="Total Submissions" 
              value={debtorStats.total} 
              subtitle="All debtors" 
              icon={Upload} 
              color="blue" 
            />
            <ModernKPI 
              title="Under Review" 
              value={debtorStats.submitted} 
              subtitle="Pending TUGURE" 
              icon={Clock} 
              color="orange" 
            />
            <ModernKPI 
              title="Approved" 
              value={debtorStats.approved} 
              subtitle="Accepted" 
              icon={CheckCircle2} 
              color="green" 
            />
            <ModernKPI 
              title="Rejected" 
              value={debtorStats.rejected} 
              subtitle="Need revision" 
              icon={AlertCircle} 
              color="red" 
            />
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Debtor Submission Tracking</CardTitle>
                <div className="flex items-center gap-3">
                  <Filter className="w-4 h-4 text-gray-500" />
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Status</SelectItem>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="SUBMITTED">Submitted</SelectItem>
                      <SelectItem value="APPROVED">Approved</SelectItem>
                      <SelectItem value="REJECTED">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={loadMyDebtors}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {myDebtors.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No debtors submitted yet. Upload your first batch in the "Upload New Batch" tab.
                  </AlertDescription>
                </Alert>
              ) : (
                <DataTable 
                  columns={myDebtorsColumns} 
                  data={filteredMyDebtors}
                  emptyMessage="No debtors match the selected filter"
                />
              )}
            </CardContent>
          </Card>

          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700">
              <strong>Revision Workflow:</strong> If a debtor is REJECTED by TUGURE, click "Revise" to create a new version with updated data. The revised debtor will go through the review process again.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>

      {/* Revision Dialog */}
      <Dialog open={showReviseDialog} onOpenChange={setShowReviseDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Revise Rejected Debtor</DialogTitle>
          </DialogHeader>
          {selectedDebtorForRevision && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Rejection Reason:</strong> {selectedDebtorForRevision.rejection_reason}
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Debtor Name *</Label>
                  <Input
                    value={revisionFormData.debtor_name || ''}
                    onChange={(e) => setRevisionFormData({...revisionFormData, debtor_name: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Participant No *</Label>
                  <Input
                    value={revisionFormData.participant_no || ''}
                    onChange={(e) => setRevisionFormData({...revisionFormData, participant_no: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Loan Account No *</Label>
                  <Input
                    value={revisionFormData.loan_account_no || ''}
                    onChange={(e) => setRevisionFormData({...revisionFormData, loan_account_no: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Credit Plafond (Rp) *</Label>
                  <Input
                    type="number"
                    value={revisionFormData.credit_plafond || ''}
                    onChange={(e) => setRevisionFormData({...revisionFormData, credit_plafond: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Outstanding Amount (Rp) *</Label>
                  <Input
                    type="number"
                    value={revisionFormData.outstanding_amount || ''}
                    onChange={(e) => setRevisionFormData({...revisionFormData, outstanding_amount: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Gross Premium (Rp) *</Label>
                  <Input
                    type="number"
                    value={revisionFormData.gross_premium || ''}
                    onChange={(e) => setRevisionFormData({...revisionFormData, gross_premium: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Net Premium (Rp) *</Label>
                  <Input
                    type="number"
                    value={revisionFormData.net_premium || ''}
                    onChange={(e) => setRevisionFormData({...revisionFormData, net_premium: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Coverage Start Date *</Label>
                  <Input
                    type="date"
                    value={revisionFormData.coverage_start_date || ''}
                    onChange={(e) => setRevisionFormData({...revisionFormData, coverage_start_date: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Coverage End Date *</Label>
                  <Input
                    type="date"
                    value={revisionFormData.coverage_end_date || ''}
                    onChange={(e) => setRevisionFormData({...revisionFormData, coverage_end_date: e.target.value})}
                  />
                </div>
                <div className="col-span-2">
                  <Label>Debtor Address</Label>
                  <Input
                    value={revisionFormData.debtor_address || ''}
                    onChange={(e) => setRevisionFormData({...revisionFormData, debtor_address: e.target.value})}
                  />
                </div>
                <div className="col-span-2">
                  <Label>Revision Reason * (Why are you revising this debtor?)</Label>
                  <Input
                    placeholder="E.g., Updated plafond based on new documentation"
                    value={revisionFormData.revision_reason || ''}
                    onChange={(e) => setRevisionFormData({...revisionFormData, revision_reason: e.target.value})}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviseDialog(false)}>
              Cancel
            </Button>
            <Button onClick={submitRevision} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting Revision...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Revision
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}