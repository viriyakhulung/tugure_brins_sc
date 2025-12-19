import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
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
      width: '50px'
    },
    { 
      header: 'Debtor Information', 
      cell: (row) => (
        <div className="py-2">
          <p className="font-semibold text-gray-900">{row.debtor_name}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-gray-500">ID: {row.participant_no}</span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-500">{row.debtor_identifier}</span>
          </div>
        </div>
      ),
      width: '250px'
    },
    { 
      header: 'Batch ID', 
      cell: (row) => (
        <div className="py-2">
          <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">{row.batch_id?.slice(0, 12)}...</span>
          <p className="text-xs text-gray-500 mt-1">{row.batch_month}/{row.batch_year}</p>
        </div>
      ),
      width: '150px'
    },
    { 
      header: 'Type & Coverage', 
      cell: (row) => (
        <div className="py-2">
          <StatusBadge status={row.credit_type} />
          <p className="text-xs text-gray-500 mt-1">Coverage: {row.coverage_pct || 0}%</p>
        </div>
      ),
      width: '140px'
    },
    { 
      header: 'Document Progress',
      cell: (row) => {
        const completeness = calculateCompleteness(row);
        const requiredDocs = DOCUMENT_TYPES[row.credit_type] || DOCUMENT_TYPES.Individual;
        const uploadedDocs = getDebtorDocuments(row.id);
        const verifiedDocs = uploadedDocs.filter(d => d.status === 'VERIFIED');
        
        return (
          <div className="py-2 w-40">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-gray-900">{completeness}%</span>
              <span className="text-xs text-gray-500">{verifiedDocs.length}/{requiredDocs.length}</span>
            </div>
            <Progress value={completeness} className="h-2.5" />
            {completeness === 100 ? (
              <div className="flex items-center gap-1 mt-1">
                <CheckCircle2 className="w-3 h-3 text-green-600" />
                <span className="text-xs text-green-600 font-medium">Complete</span>
              </div>
            ) : (
              <span className="text-xs text-orange-600 mt-1 block">Pending docs</span>
            )}
          </div>
        );
      }
    },
    { 
      header: 'Status', 
      cell: (row) => (
        <div className="py-2">
          <StatusBadge status={row.batch_status} />
          {row.underwriting_status && (
            <p className="text-xs text-gray-500 mt-1">{row.underwriting_status}</p>
          )}
        </div>
      ),
      width: '120px'
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-1.5">
          <Button 
            variant="outline" 
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedDebtor(row);
              setShowDetailDialog(true);
            }}
            className="hover:bg-blue-50"
          >
            <Eye className="w-4 h-4 mr-1" />
            Detail
          </Button>
          <Button 
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedDebtor(row);
              setShowUploadDialog(true);
            }}
          >
            <Upload className="w-4 h-4 mr-1" />
            Upload
          </Button>
        </div>
      ),
      width: '200px'
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
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">{selectedDebtor?.debtor_name}</DialogTitle>
            <DialogDescription className="text-base">
              Complete document eligibility review and verification
            </DialogDescription>
          </DialogHeader>
          
          {selectedDebtor && (
            <div className="space-y-6 py-4">
              {/* Debtor Information Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Debtor Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-xs text-gray-500">Participant No</Label>
                      <p className="font-medium">{selectedDebtor.participant_no}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Identifier</Label>
                      <p className="font-medium">{selectedDebtor.debtor_identifier}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Credit Type</Label>
                      <div className="mt-1"><StatusBadge status={selectedDebtor.credit_type} /></div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Debtor Type</Label>
                      <p className="font-medium">{selectedDebtor.debtor_type}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Batch ID</Label>
                      <p className="font-mono text-sm">{selectedDebtor.batch_id}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Period</Label>
                      <p className="font-medium">{selectedDebtor.batch_month}/{selectedDebtor.batch_year}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Coverage</Label>
                      <p className="font-medium">{selectedDebtor.coverage_pct}%</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Plafond</Label>
                      <p className="font-medium">Rp {(selectedDebtor.credit_plafond || 0).toLocaleString('id-ID')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Document Progress */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Document Verification Progress</CardTitle>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600">{calculateCompleteness(selectedDebtor)}%</p>
                        <p className="text-xs text-gray-500">Complete</p>
                      </div>
                      <div className="w-32">
                        <Progress value={calculateCompleteness(selectedDebtor)} className="h-3" />
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 mb-4">
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setShowDetailDialog(false);
                        setShowUploadDialog(true);
                      }}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Documents
                    </Button>
                    {calculateCompleteness(selectedDebtor) === 100 && selectedDebtor.batch_status !== 'VALIDATED' && (
                      <Button 
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => {
                          handleSubmitCompletion(selectedDebtor);
                          setShowDetailDialog(false);
                        }}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Mark as Complete
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Required Documents Checklist */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Required Documents</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(DOCUMENT_TYPES[selectedDebtor.credit_type] || DOCUMENT_TYPES.Individual).map((docType, index) => {
                        const doc = getDebtorDocuments(selectedDebtor.id).find(d => d.document_type === docType);
                        
                        return (
                          <div 
                            key={index}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                              doc?.status === 'VERIFIED' ? 'bg-green-50 border-green-200' : 
                              doc ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {doc?.status === 'VERIFIED' ? (
                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                              ) : doc ? (
                                <Clock className="w-5 h-5 text-yellow-600" />
                              ) : (
                                <XCircle className="w-5 h-5 text-gray-400" />
                              )}
                              <div>
                                <p className={`font-medium text-sm ${doc?.status === 'VERIFIED' ? 'text-gray-900' : 'text-gray-600'}`}>
                                  {docType}
                                </p>
                                {doc && (
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    Uploaded: {doc.upload_date}
                                  </p>
                                )}
                              </div>
                            </div>
                            {doc && <StatusBadge status={doc.status} />}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Uploaded Documents */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Uploaded Files</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {getDebtorDocuments(selectedDebtor.id).map((doc, index) => (
                        <div 
                          key={index}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{doc.document_type}</p>
                              <p className="text-xs text-gray-500 truncate">{doc.document_name}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            <StatusBadge status={doc.status} />
                            <Button variant="ghost" size="sm" asChild>
                              <a href={doc.file_url} target="_blank" rel="noopener noreferrer" title="View">
                                <Eye className="w-4 h-4" />
                              </a>
                            </Button>
                            <Button variant="ghost" size="sm" asChild>
                              <a href={doc.file_url} download={doc.document_name} title="Download">
                                <Download className="w-4 h-4" />
                              </a>
                            </Button>
                          </div>
                        </div>
                      ))}
                      {getDebtorDocuments(selectedDebtor.id).length === 0 && (
                        <div className="text-center py-12">
                          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500">No documents uploaded yet</p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-3"
                            onClick={() => {
                              setShowDetailDialog(false);
                              setShowUploadDialog(true);
                            }}
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Upload Documents
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Status Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Status Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-xs text-gray-500">Batch Status</Label>
                      <div className="mt-1"><StatusBadge status={selectedDebtor.batch_status} /></div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Underwriting</Label>
                      <div className="mt-1"><StatusBadge status={selectedDebtor.underwriting_status} /></div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Record Status</Label>
                      <div className="mt-1"><StatusBadge status={selectedDebtor.record_status} /></div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Created Date</Label>
                      <p className="font-medium text-sm mt-1">{selectedDebtor.created_date}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}