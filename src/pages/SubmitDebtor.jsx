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
              cover_id: { type: 'string' },
              program_id: { type: 'string' },
              nomor_rekening_pinjaman: { type: 'string' },
              nomor_peserta: { type: 'string' },
              loan_type: { type: 'string' },
              loan_type_desc: { type: 'string' },
              nama_peserta: { type: 'string' },
              plafon: { type: 'number' },
              nominal_premi: { type: 'number' },
              net_premi: { type: 'number' },
              tanggal_mulai_covering: { type: 'string' },
              tanggal_akhir_covering: { type: 'string' }
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
      const batchId = `BATCH-${Date.now()}`;
      const debtorsToCreate = previewData.map(d => ({
        contract_id: selectedContract,
        batch_id: batchId,
        cover_id: d.cover_id || '',
        program_id: d.program_id || '194',
        nomor_peserta: d.nomor_peserta || '',
        nama_peserta: d.nama_peserta || '',
        nomor_rekening_pinjaman: d.nomor_rekening_pinjaman || '',
        loan_type: d.loan_type || '',
        loan_type_desc: d.loan_type_desc || '',
        plafon: d.plafon || 0,
        nominal_premi: d.nominal_premi || 0,
        net_premi: d.net_premi || 0,
        coverage_start: d.tanggal_mulai_covering || coverageStart,
        coverage_end: d.tanggal_akhir_covering || coverageEnd,
        submit_status: 'SUBMITTED',
        admin_status: 'INCOMPLETE',
        exposure_status: 'PENDING'
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
      const debtorsToCreate = validDebtors.map(d => ({
        contract_id: selectedContract,
        batch_id: batchId,
        nama_peserta: d.nama_peserta,
        plafon: parseFloat(d.plafon) || 0,
        outstanding: parseFloat(d.outstanding) || 0,
        coverage_start: d.coverage_start || coverageStart,
        coverage_end: d.coverage_end || coverageEnd,
        submit_status: 'SUBMITTED',
        admin_status: 'INCOMPLETE',
        exposure_status: 'PENDING'
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
    { header: 'Nama Peserta', accessorKey: 'nama_peserta' },
    { header: 'No. Rekening', accessorKey: 'nomor_rekening_pinjaman' },
    { header: 'Plafon', cell: (row) => `IDR ${(row.plafon || 0).toLocaleString()}` },
    { header: 'Net Premi', cell: (row) => `IDR ${(row.net_premi || 0).toLocaleString()}` },
    { header: 'Coverage Start', accessorKey: 'tanggal_mulai_covering' },
    { header: 'Coverage End', accessorKey: 'tanggal_akhir_covering' }
  ];

  const downloadTemplate = () => {
    const templateData = [
      ['COVER_ID', 'PROGRAM_ID', 'NOMOR_REKENING_PINJAMAN', 'NOMOR_PESERTA', 'LOAN_TYPE', 'LOAN_TYPE_DESC', 
       'NAMA_PESERTA', 'PLAFON', 'NOMINAL_PREMI', 'NET_PREMI', 'TANGGAL_MULAI_COVERING', 'TANGGAL_AKHIR_COVERING'],
      ['992536', '194', '01234', '0000M.00039.2025.03.00001.1.1', 'DL', 'KMK RC RITEL', 
       'DEBITUR A', '500000000', '10125000', '2797031.25', '28/02/2025', '28/02/2028']
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

      {/* Debtor Input */}
      <Tabs defaultValue="upload" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upload">
            <Upload className="w-4 h-4 mr-2" />
            Upload Excel
          </TabsTrigger>
          <TabsTrigger value="manual">
            <Users className="w-4 h-4 mr-2" />
            Manual Input
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
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
        </TabsContent>

        <TabsContent value="manual">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Corporate Debtor Input</CardTitle>
                <Button variant="outline" onClick={addCorporateDebtor}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Debtor
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {corporateDebtors.map((debtor, index) => (
                  <div key={index} className="p-4 border rounded-lg bg-gray-50">
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-medium">Debtor #{index + 1}</span>
                      {corporateDebtors.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removeCorporateDebtor(index)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>Debtor Name</Label>
                        <Input
                          value={debtor.nama_peserta}
                          onChange={(e) => updateCorporateDebtor(index, 'nama_peserta', e.target.value)}
                          placeholder="Enter debtor name"
                        />
                      </div>
                      <div>
                        <Label>Credit Limit (Plafon)</Label>
                        <Input
                          type="number"
                          value={debtor.plafon}
                          onChange={(e) => updateCorporateDebtor(index, 'plafon', e.target.value)}
                          placeholder="Enter amount"
                        />
                      </div>
                      <div>
                        <Label>Outstanding</Label>
                        <Input
                          type="number"
                          value={debtor.outstanding}
                          onChange={(e) => updateCorporateDebtor(index, 'outstanding', e.target.value)}
                          placeholder="Enter amount"
                        />
                      </div>
                      <div>
                        <Label>Tenor (months)</Label>
                        <Input
                          type="number"
                          value={debtor.tenor}
                          onChange={(e) => updateCorporateDebtor(index, 'tenor', e.target.value)}
                          placeholder="Enter tenor"
                        />
                      </div>
                      <div>
                        <Label>Coverage Start</Label>
                        <Input
                          type="date"
                          value={debtor.coverage_start}
                          onChange={(e) => updateCorporateDebtor(index, 'coverage_start', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Coverage End</Label>
                        <Input
                          type="date"
                          value={debtor.coverage_end}
                          onChange={(e) => updateCorporateDebtor(index, 'coverage_end', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex justify-end">
                <Button 
                  onClick={handleCorporateSubmit}
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}