import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import DataTable from '@/components/common/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { Download, Upload, FileSpreadsheet, Loader2, CheckCircle2, XCircle, AlertCircle, RefreshCw, FileText, Users } from 'lucide-react';
import { toast } from 'sonner';
import { createAuditLog, sendTemplatedEmail } from '@/components/utils/emailTemplateHelper';

export default function SubmitDebtor() {
  const [user, setUser] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [debtors, setDebtors] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [selectedContract, setSelectedContract] = useState('');
  const [batchMode, setBatchMode] = useState('new'); // 'new' or 'revise'
  const [selectedBatch, setSelectedBatch] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  // Filter state
  const [filterContract, setFilterContract] = useState('all');
  const [filterBatch, setFilterBatch] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [selectedDebtors, setSelectedDebtors] = useState([]);
  const [revisionNote, setRevisionNote] = useState('');
  const [actionNote, setActionNote] = useState('');
  
  // Message state
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const demoUserStr = localStorage.getItem('demo_user');
      if (demoUserStr) {
        const parsedUser = JSON.parse(demoUserStr);
        setUser(parsedUser);
      }

      await Promise.all([
        loadContracts(),
        loadBatches(),
        loadDebtors()
      ]);
    } catch (error) {
      console.error('Failed to load data:', error);
      setErrorMessage('Failed to load data');
    }
    setLoading(false);
  };

  const loadContracts = async () => {
    const contractsData = await base44.entities.MasterContract.list();
    setContracts(contractsData || []);
  };

  const loadBatches = async () => {
    const batchesData = await base44.entities.Batch.list();
    setBatches(batchesData || []);
  };

  const loadDebtors = async () => {
    const debtorsData = await base44.entities.Debtor.list();
    setDebtors(debtorsData || []);
  };

  const handleRefresh = () => {
    setSuccessMessage('');
    setErrorMessage('');
    loadInitialData();
  };

  // Download template
  const handleDownloadTemplate = () => {
    const headers = [
      'participant_no', 'loan_account_no', 'credit_agreement_no', 'debtor_name', 
      'debtor_identifier', 'debtor_address', 'debtor_type', 'credit_type',
      'loan_type', 'loan_type_desc', 'submission_type_desc', 'covering_type_desc',
      'coverage_start_date', 'coverage_end_date', 'credit_plafond', 'outstanding_amount',
      'gross_premium', 'reinsurance_premium', 'ric_amount', 'bf_amount', 'net_premium',
      'unit_code', 'unit_desc', 'branch_code', 'branch_desc', 'region_desc'
    ];
    
    const csvContent = headers.join(',') + '\n' + 
      'P001,LA001,CA001,John Doe,1234567890,Jakarta,Individual,Individual,KPR,Mortgage,New,Full,2025-01-01,2030-12-31,100000000,95000000,950000,100000,50000,25000,775000,U001,Unit 1,B001,Branch 1,Region 1';
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'debtor_template.csv';
    a.click();
    toast.success('Template downloaded');
  };

  // Parse CSV
  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || '';
      });
      data.push(row);
    }
    
    return data;
  };

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
    }
  };

  // Submit bulk upload
  const handleBulkUpload = async () => {
    if (!selectedContract) {
      toast.error('Please select a contract');
      return;
    }

    if (batchMode === 'revise' && !selectedBatch) {
      toast.error('Please select a batch to revise');
      return;
    }

    if (!uploadFile) {
      toast.error('Please select a file to upload');
      return;
    }

    setUploading(true);
    try {
      const text = await uploadFile.text();
      const parsedData = parseCSV(text);

      if (parsedData.length === 0) {
        toast.error('No data found in file');
        setUploading(false);
        return;
      }

      // Generate batch ID
      const batchId = batchMode === 'revise' 
        ? selectedBatch 
        : `BATCH-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${Date.now()}`;

      // Create or update batch
      if (batchMode === 'new') {
        await base44.entities.Batch.create({
          batch_id: batchId,
          batch_month: new Date().getMonth() + 1,
          batch_year: new Date().getFullYear(),
          contract_id: selectedContract,
          total_records: parsedData.length,
          total_exposure: parsedData.reduce((sum, d) => sum + (parseFloat(d.outstanding_amount) || 0), 0),
          total_premium: parsedData.reduce((sum, d) => sum + (parseFloat(d.gross_premium) || 0), 0),
          status: 'Uploaded'
        });
      }

      // Create debtors
      const debtorsToCreate = parsedData.map(row => ({
        batch_id: batchId,
        contract_id: selectedContract,
        participant_no: row.participant_no,
        loan_account_no: row.loan_account_no,
        credit_agreement_no: row.credit_agreement_no,
        debtor_name: row.debtor_name,
        debtor_identifier: row.debtor_identifier,
        debtor_address: row.debtor_address,
        debtor_type: row.debtor_type || 'Individual',
        credit_type: row.credit_type || 'Individual',
        loan_type: row.loan_type,
        loan_type_desc: row.loan_type_desc,
        submission_type_desc: row.submission_type_desc,
        covering_type_desc: row.covering_type_desc,
        coverage_start_date: row.coverage_start_date,
        coverage_end_date: row.coverage_end_date,
        credit_plafond: parseFloat(row.credit_plafond) || 0,
        outstanding_amount: parseFloat(row.outstanding_amount) || 0,
        gross_premium: parseFloat(row.gross_premium) || 0,
        reinsurance_premium: parseFloat(row.reinsurance_premium) || 0,
        ric_amount: parseFloat(row.ric_amount) || 0,
        bf_amount: parseFloat(row.bf_amount) || 0,
        net_premium: parseFloat(row.net_premium) || 0,
        unit_code: row.unit_code,
        unit_desc: row.unit_desc,
        branch_code: row.branch_code,
        branch_desc: row.branch_desc,
        region_desc: row.region_desc,
        underwriting_status: 'SUBMITTED',
        batch_status: 'SUBMITTED',
        record_status: 'ACTIVE'
      }));

      await base44.entities.Debtor.bulkCreate(debtorsToCreate);

      // Create audit log
      await createAuditLog(
        batchMode === 'new' ? 'BULK_UPLOAD' : 'BULK_REVISION',
        'DEBTOR',
        'Debtor',
        batchId,
        null,
        JSON.stringify({ count: parsedData.length }),
        user?.email,
        user?.role,
        null,
        `Uploaded ${parsedData.length} debtors to batch ${batchId}`
      );

      // Send notification to TUGURE
      await sendTemplatedEmail(
        'Batch',
        null,
        'Uploaded',
        { batch_id: batchId, user_name: user?.full_name || user?.email, count: parsedData.length }
      );

      toast.success(`Successfully uploaded ${parsedData.length} debtors`);
      setSuccessMessage(`Successfully uploaded ${parsedData.length} debtors to batch ${batchId}`);
      
      // Reset form
      setUploadDialogOpen(false);
      setUploadFile(null);
      setSelectedContract('');
      setBatchMode('new');
      setSelectedBatch('');
      
      // Reload data
      await loadBatches();
      await loadDebtors();
    } catch (error) {
      console.error('Failed to upload debtors:', error);
      toast.error('Failed to upload debtors');
      setErrorMessage('Failed to upload debtors');
    }
    setUploading(false);
  };

  // Handle request revision for selected debtors
  const handleRequestRevision = async () => {
    if (selectedDebtors.length === 0) {
      toast.error('Please select debtors to revise');
      return;
    }

    if (!revisionNote.trim()) {
      toast.error('Please provide a revision note');
      return;
    }

    try {
      for (const debtorId of selectedDebtors) {
        const debtor = debtors.find(d => d.id === debtorId);
        
        await base44.entities.Debtor.update(debtor.id, {
          underwriting_status: 'CONDITIONAL',
          validation_remarks: revisionNote
        });

        // Create audit log
        await createAuditLog(
          'REQUEST_REVISION',
          'DEBTOR',
          'Debtor',
          debtor.id,
          debtor.underwriting_status,
          'CONDITIONAL',
          user?.email,
          user?.role,
          null,
          revisionNote
        );
      }

      // Send notification
      await sendTemplatedEmail(
        'Record',
        null,
        'CONDITIONAL',
        { user_name: user?.full_name || user?.email, count: selectedDebtors.length, note: revisionNote }
      );

      toast.success(`Revision requested for ${selectedDebtors.length} debtors`);
      setSuccessMessage(`Revision requested for ${selectedDebtors.length} debtors`);
      
      setRevisionDialogOpen(false);
      setRevisionNote('');
      setSelectedDebtors([]);
      
      await loadDebtors();
    } catch (error) {
      console.error('Failed to request revision:', error);
      toast.error('Failed to request revision');
    }
  };

  // Calculate KPIs
  const kpis = {
    total: debtors.length,
    submitted: debtors.filter(d => d.underwriting_status === 'SUBMITTED').length,
    approved: debtors.filter(d => d.underwriting_status === 'APPROVED').length,
    rejected: debtors.filter(d => d.underwriting_status === 'REJECTED').length,
    conditional: debtors.filter(d => d.underwriting_status === 'CONDITIONAL').length
  };

  // Filter debtors
  const filteredDebtors = debtors.filter(debtor => {
    const contractMatch = filterContract === 'all' || debtor.contract_id === filterContract;
    const batchMatch = filterBatch === 'all' || debtor.batch_id === filterBatch;
    const statusMatch = filterStatus === 'all' || debtor.underwriting_status === filterStatus;
    const searchMatch = !searchTerm || 
      debtor.debtor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      debtor.participant_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      debtor.batch_id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return contractMatch && batchMatch && statusMatch && searchMatch;
  });

  // Table columns
  const columns = [
    {
      header: () => (
        <Checkbox
          checked={selectedDebtors.length === filteredDebtors.length && filteredDebtors.length > 0}
          onCheckedChange={(checked) => {
            if (checked) {
              setSelectedDebtors(filteredDebtors.map(d => d.id));
            } else {
              setSelectedDebtors([]);
            }
          }}
        />
      ),
      cell: (row) => (
        <Checkbox
          checked={selectedDebtors.includes(row.id)}
          onCheckedChange={(checked) => {
            if (checked) {
              setSelectedDebtors([...selectedDebtors, row.id]);
            } else {
              setSelectedDebtors(selectedDebtors.filter(id => id !== row.id));
            }
          }}
        />
      ),
      width: '50px'
    },
    {
      header: 'Batch ID',
      accessorKey: 'batch_id',
      cell: (row) => (
        <span className="font-mono text-xs">{row.batch_id}</span>
      )
    },
    {
      header: 'Participant No',
      accessorKey: 'participant_no',
      cell: (row) => (
        <div>
          <div className="font-medium">{row.participant_no}</div>
          <div className="text-xs text-gray-500">{row.debtor_name}</div>
        </div>
      )
    },
    {
      header: 'Credit Info',
      cell: (row) => (
        <div className="text-sm">
          <div>{row.credit_type}</div>
          <div className="text-xs text-gray-500">{row.loan_type_desc}</div>
        </div>
      )
    },
    {
      header: 'Outstanding',
      accessorKey: 'outstanding_amount',
      cell: (row) => (
        <div className="text-right">
          <div className="font-medium">
            Rp {row.outstanding_amount?.toLocaleString('id-ID')}
          </div>
        </div>
      )
    },
    {
      header: 'Premium',
      accessorKey: 'gross_premium',
      cell: (row) => (
        <div className="text-right">
          <div className="font-medium">
            Rp {row.gross_premium?.toLocaleString('id-ID')}
          </div>
        </div>
      )
    },
    {
      header: 'Status',
      accessorKey: 'underwriting_status',
      cell: (row) => <StatusBadge status={row.underwriting_status} />
    },
    {
      header: 'Submitted',
      accessorKey: 'created_date',
      cell: (row) => (
        <div className="text-sm text-gray-600">
          {new Date(row.created_date).toLocaleDateString('id-ID')}
        </div>
      )
    },
    {
      header: 'Note',
      cell: (row) => (
        row.validation_remarks && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setActionNote(row.validation_remarks);
              setNoteDialogOpen(true);
            }}
          >
            <FileText className="w-4 h-4" />
          </Button>
        )
      ),
      width: '80px'
    }
  ];

  const activeContracts = contracts.filter(c => c.effective_status === 'Active');
  const userBatches = batches.filter(b => filterContract === 'all' || b.contract_id === filterContract);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Submit Debtor"
        subtitle="Upload and manage debtor submissions for reinsurance coverage"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Submit Debtor' }
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={() => setUploadDialogOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Upload Debtors
            </Button>
          </div>
        }
      />

      {/* Messages */}
      {successMessage && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
        </Alert>
      )}

      {errorMessage && (
        <Alert className="border-red-200 bg-red-50">
          <XCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Debtors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{kpis.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Submitted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{kpis.submitted}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{kpis.approved}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{kpis.rejected}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Conditional</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{kpis.conditional}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Filter & Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Contract</Label>
              <Select value={filterContract} onValueChange={setFilterContract}>
                <SelectTrigger>
                  <SelectValue placeholder="All Contracts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Contracts</SelectItem>
                  {contracts.map(c => (
                    <SelectItem key={c.id} value={c.contract_id}>
                      {c.contract_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Batch</Label>
              <Select value={filterBatch} onValueChange={setFilterBatch}>
                <SelectTrigger>
                  <SelectValue placeholder="All Batches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Batches</SelectItem>
                  {batches.map(b => (
                    <SelectItem key={b.id} value={b.batch_id}>
                      {b.batch_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="SUBMITTED">Submitted</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="CONDITIONAL">Conditional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Search</Label>
              <Input
                placeholder="Search by name, participant no..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </Button>

            {selectedDebtors.length > 0 && (
              <>
                <Button 
                  variant="outline"
                  onClick={() => setRevisionDialogOpen(true)}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Request Revision ({selectedDebtors.length})
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setSelectedDebtors([])}
                >
                  Clear Selection
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Debtor Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={filteredDebtors}
            emptyMessage="No debtors found. Upload your first batch to get started."
          />
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Debtors</DialogTitle>
            <DialogDescription>
              Upload a CSV file containing debtor information
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Select Contract *</Label>
              <Select value={selectedContract} onValueChange={setSelectedContract}>
                <SelectTrigger>
                  <SelectValue placeholder="Select contract" />
                </SelectTrigger>
                <SelectContent>
                  {activeContracts.map(c => (
                    <SelectItem key={c.id} value={c.contract_id}>
                      {c.contract_id} - {c.policy_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Batch Mode *</Label>
              <Select value={batchMode} onValueChange={setBatchMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New Batch</SelectItem>
                  <SelectItem value="revise">Revise Existing Batch</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {batchMode === 'revise' && (
              <div>
                <Label>Select Batch to Revise *</Label>
                <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select batch" />
                  </SelectTrigger>
                  <SelectContent>
                    {userBatches.map(b => (
                      <SelectItem key={b.id} value={b.batch_id}>
                        {b.batch_id} - {b.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Upload File *</Label>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
              />
              {uploadFile && (
                <p className="text-sm text-gray-600 mt-1">
                  Selected: {uploadFile.name}
                </p>
              )}
            </div>

            <Alert>
              <FileSpreadsheet className="h-4 w-4" />
              <AlertDescription>
                Download the template first to see the required format. Make sure all required fields are filled.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleBulkUpload} disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revision Dialog */}
      <Dialog open={revisionDialogOpen} onOpenChange={setRevisionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Revision</DialogTitle>
            <DialogDescription>
              Request revision for {selectedDebtors.length} selected debtor(s)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Revision Note *</Label>
              <Textarea
                placeholder="Explain what needs to be revised..."
                value={revisionNote}
                onChange={(e) => setRevisionNote(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRevisionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRequestRevision}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Request Revision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Action Note</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Note from TUGURE:</Label>
            <div className="p-4 bg-gray-50 rounded-lg border">
              <p className="text-sm text-gray-700">{actionNote}</p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setNoteDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}