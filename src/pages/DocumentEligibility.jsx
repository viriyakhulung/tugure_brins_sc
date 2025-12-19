import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  FileText, Upload, CheckCircle2, XCircle, AlertCircle, 
  Clock, Eye, Trash2, RefreshCw, Loader2, Search, Download
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";

const DOCUMENT_TYPES = {
  Individual: [
    'Perjanjian Kredit',
    'Jadwal Angsuran',
    'Bukti Pencairan',
    'Identitas Debitur'
  ],
  Corporate: [
    'Facility Agreement',
    'Akta Perusahaan',
    'Board Resolution',
    'Bukti Penarikan'
  ]
};

function DocumentUploadRow({ docType, debtorId, existingDoc, onUploadComplete }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(!!existingDoc);

  const handleUpload = async () => {
    if (!file || !debtorId) return;
    
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Document.create({
        debtor_id: debtorId,
        document_type: docType,
        document_name: file.name,
        file_url,
        upload_date: new Date().toISOString().split('T')[0],
        status: 'PENDING'
      });
      setUploaded(true);
      setFile(null);
      onUploadComplete();
    } catch (error) {
      console.error('Upload error:', error);
    }
    setUploading(false);
  };

  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          {uploaded ? (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          ) : (
            <Clock className="w-4 h-4 text-gray-400" />
          )}
          <span className="font-medium text-sm">{docType}</span>
        </div>
        {existingDoc && (
          <p className="text-xs text-gray-500">{existingDoc.document_name}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {existingDoc && (
          <Button variant="ghost" size="sm" asChild>
            <a href={existingDoc.file_url} download={existingDoc.document_name}>
              <Download className="w-4 h-4" />
            </a>
          </Button>
        )}
        <Input
          type="file"
          onChange={(e) => setFile(e.target.files[0])}
          accept=".pdf,.jpg,.jpeg,.png"
          className="w-48 text-sm"
          disabled={uploading}
        />
        <Button 
          size="sm"
          onClick={handleUpload}
          disabled={!file || uploading}
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : uploaded ? (
            'Re-upload'
          ) : (
            'Upload'
          )}
        </Button>
      </div>
    </div>
  );
}

export default function DocumentEligibility() {
  const [debtors, setDebtors] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [selectedDebtor, setSelectedDebtor] = useState(null);
  const [selectedDebtors, setSelectedDebtors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [uploadDocType, setUploadDocType] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [debtorData, docData] = await Promise.all([
        base44.entities.Debtor.list(),
        base44.entities.Document.list()
      ]);
      setDebtors(debtorData || []);
      setDocuments(docData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  const getDebtorDocuments = (debtorId) => {
    return documents.filter(d => d.debtor_id === debtorId);
  };

  const calculateCompleteness = (debtor) => {
    if (!debtor) return 0;
    const debtorId = typeof debtor === 'object' ? debtor.id : debtor;
    if (!debtorId) return 0;
    const creditType = (typeof debtor === 'object' ? debtor.credit_type : null) || 'Individual';
    const requiredDocs = DOCUMENT_TYPES[creditType] || DOCUMENT_TYPES.Individual;
    const debtorDocs = getDebtorDocuments(debtorId);
    const completedDocs = requiredDocs.filter(type => 
      debtorDocs.some(d => d.document_type === type && d.status === 'VERIFIED')
    );
    return Math.round((completedDocs.length / requiredDocs.length) * 100);
  };

  const handleUploadDocument = async () => {
    if (!uploadFile || !uploadDocType || !selectedDebtor) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadFile });

      await base44.entities.Document.create({
        debtor_id: selectedDebtor.id,
        document_type: uploadDocType,
        document_name: uploadFile.name,
        file_url,
        upload_date: new Date().toISOString().split('T')[0],
        status: 'PENDING'
      });

      setSuccessMessage('Document uploaded successfully');
      setShowUploadDialog(false);
      setUploadFile(null);
      setUploadDocType('');
      loadData();
    } catch (error) {
      console.error('Upload error:', error);
    }
    setUploading(false);
  };

  const handleSubmitCompletion = async (debtor) => {
    if (!debtor || !debtor.id) return;
    
    const completeness = calculateCompleteness(debtor);
    if (completeness < 100) {
      return;
    }

    try {
      await base44.entities.Debtor.update(debtor.id, {
        batch_status: 'VALIDATED'
      });

      await base44.entities.Notification.create({
        title: 'Document Eligibility Complete',
        message: `Documents for ${debtor.debtor_name} are now complete`,
        type: 'INFO',
        module: 'DOCUMENT',
        reference_id: debtor.id,
        target_role: 'ALL'
      });

      setSuccessMessage('Admin eligibility marked as complete');
      loadData();
    } catch (error) {
      console.error('Update error:', error);
    }
  };

  const filteredDebtors = debtors.filter(d => {
    const matchesSearch = d.debtor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         d.participant_no?.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || d.batch_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const toggleDebtorSelection = (debtorId) => {
    if (selectedDebtors.includes(debtorId)) {
      setSelectedDebtors(selectedDebtors.filter(id => id !== debtorId));
    } else {
      setSelectedDebtors([...selectedDebtors, debtorId]);
    }
  };

  const columns = [
    {
      header: (
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
          onCheckedChange={() => toggleDebtorSelection(row.id)}
        />
      ),
      width: '40px'
    },
    { 
      header: 'Debtor Name', 
      cell: (row) => (
        <div>
          <p className="font-medium">{row.debtor_name}</p>
          <p className="text-sm text-gray-500">{row.participant_no}</p>
        </div>
      )
    },
    { 
      header: 'Batch', 
      accessorKey: 'batch_id',
      cell: (row) => <span className="text-sm font-mono">{row.batch_id?.slice(0, 15)}</span>
    },
    { 
      header: 'Credit Type', 
      cell: (row) => <StatusBadge status={row.credit_type} />
    },
    { 
      header: 'Document Completeness',
      cell: (row) => {
        const completeness = calculateCompleteness(row);
        return (
          <div className="w-32">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{completeness}%</span>
            </div>
            <Progress value={completeness} className="h-2" />
          </div>
        );
      }
    },
    { 
      header: 'Batch Status', 
      cell: (row) => <StatusBadge status={row.batch_status} />
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedDebtor(row);
              setShowDetailDialog(true);
            }}
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedDebtor(row);
              setShowUploadDialog(true);
            }}
          >
            <Upload className="w-4 h-4" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Eligibility"
        subtitle="Manage debtor documents for coverage eligibility"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Document Eligibility' }
        ]}
      />

      {successMessage && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by debtor name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Admin Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="INCOMPLETE">Incomplete</SelectItem>
                <SelectItem value="COMPLETE">Complete</SelectItem>
                <SelectItem value="EXPIRED">Expired</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button variant="outline" onClick={loadData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button 
                variant="outline" 
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => {
                  const csv = [
                    ['Debtor', 'Batch', 'Credit Type', 'Batch Status', 'Completeness'].join(','),
                    ...filteredDebtors.map(d => [
                      d.debtor_name, d.batch_id, d.credit_type, d.batch_status, `${calculateCompleteness(d)}%`
                    ].join(','))
                  ].join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'document-eligibility.csv';
                  a.click();
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Debtor List */}
      <DataTable
        columns={columns}
        data={filteredDebtors}
        isLoading={loading}
        onRowClick={setSelectedDebtor}
        emptyMessage="No debtors found"
      />

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Upload Documents</DialogTitle>
            <DialogDescription>
              Upload all required documents for {selectedDebtor?.debtor_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[500px] overflow-y-auto">
            {(DOCUMENT_TYPES[selectedDebtor?.credit_type] || DOCUMENT_TYPES.Individual).map((docType, idx) => {
              const existingDoc = getDebtorDocuments(selectedDebtor?.id || '').find(d => d.document_type === docType);
              return (
                <DocumentUploadRow 
                  key={idx}
                  docType={docType}
                  debtorId={selectedDebtor?.id}
                  existingDoc={existingDoc}
                  onUploadComplete={loadData}
                />
              );
            })}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowUploadDialog(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Debtor Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedDebtor?.debtor_name}</DialogTitle>
            <DialogDescription>
              {selectedDebtor?.participant_no} | Batch: {selectedDebtor?.batch_id}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center justify-between mb-6 pb-4 border-b">
              <div>
                <p className="text-sm text-gray-500 mb-2">Document Completeness</p>
                <div className="flex items-center gap-4">
                  <div className="w-48">
                    <Progress value={calculateCompleteness(selectedDebtor)} className="h-3" />
                  </div>
                  <span className="font-semibold text-lg">{calculateCompleteness(selectedDebtor)}%</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  onClick={() => {
                    setShowDetailDialog(false);
                    setShowUploadDialog(true);
                  }}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
                </Button>
                {selectedDebtor && calculateCompleteness(selectedDebtor) === 100 && selectedDebtor?.batch_status !== 'VALIDATED' && (
                  <Button 
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      handleSubmitCompletion(selectedDebtor);
                      setShowDetailDialog(false);
                    }}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Submit Completion
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Required Documents Checklist */}
              <div>
                <h4 className="font-semibold mb-4">Required Documents</h4>
                <div className="space-y-3">
                  {(DOCUMENT_TYPES[selectedDebtor?.credit_type] || DOCUMENT_TYPES.Individual).map((docType, index) => {
                    const doc = getDebtorDocuments(selectedDebtor?.id || '')
                      .find(d => d.document_type === docType);
                    
                    return (
                      <div 
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {doc?.status === 'VERIFIED' ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          ) : doc ? (
                            <Clock className="w-5 h-5 text-yellow-500" />
                          ) : (
                            <XCircle className="w-5 h-5 text-gray-300" />
                          )}
                          <span className={doc?.status === 'VERIFIED' ? 'text-gray-900' : 'text-gray-500'}>
                            {docType}
                          </span>
                        </div>
                        {doc && (
                          <StatusBadge status={doc.status} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Uploaded Documents */}
              <div>
                <h4 className="font-semibold mb-4">Uploaded Documents</h4>
                <div className="space-y-3">
                  {getDebtorDocuments(selectedDebtor?.id || '').map((doc, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-blue-500" />
                        <div>
                          <p className="font-medium text-sm">{doc.document_type}</p>
                          <p className="text-xs text-gray-500">{doc.document_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={doc.status} />
                        <Button variant="ghost" size="sm" asChild>
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                            <Eye className="w-4 h-4" />
                          </a>
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={doc.file_url} download={doc.document_name}>
                            <Download className="w-4 h-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                  {getDebtorDocuments(selectedDebtor?.id || '').length === 0 && (
                    <p className="text-center text-gray-500 py-8">No documents uploaded yet</p>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowDetailDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}