import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, Upload, Download, RefreshCw, Eye, Folder, File,
  CheckCircle2, AlertCircle, Clock, Trash2, Plus, Filter
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";

const CLAIM_DOCUMENT_TYPES = [
  'Claim Advice',
  'Default Letter',
  'Outstanding Statement',
  'Collection Evidence',
  'Legal Documents',
  'Supporting Documents'
];

export default function DocumentClaim() {
  const [user, setUser] = useState(null);
  const [batches, setBatches] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [uploadFiles, setUploadFiles] = useState({});
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [filters, setFilters] = useState({
    contract: 'all',
    batch: '',
    status: 'all',
    version: 'all',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    loadUser();
    loadData();
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

  const loadData = async () => {
    setLoading(true);
    try {
      const [batchData, docData, contractData] = await Promise.all([
        base44.entities.Batch.list(),
        base44.entities.Document.list(),
        base44.entities.MasterContract.list()
      ]);
      setBatches(batchData || []);
      setDocuments((docData || []).filter(d => d.claim_id)); // Only claim documents
      
      const activeContracts = contractData.filter(c => c.effective_status === 'Active');
      setContracts(activeContracts || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  const getBatchDocuments = (batchId) => {
    return documents.filter(d => d.batch_id === batchId);
  };

  const calculateDocProgress = (batchId) => {
    const batchDocs = getBatchDocuments(batchId);
    const verifiedDocs = batchDocs.filter(d => d.status === 'VERIFIED');
    const total = CLAIM_DOCUMENT_TYPES.length;
    return {
      completed: verifiedDocs.length,
      total: total,
      percentage: Math.round((verifiedDocs.length / total) * 100)
    };
  };

  const handleBulkUpload = async () => {
    if (!selectedBatch || Object.keys(uploadFiles).length === 0) {
      setErrorMessage('Please select files to upload');
      return;
    }

    setProcessing(true);
    setErrorMessage('');
    try {
      const batch = batches.find(b => b.id === selectedBatch);
      
      for (const [docType, file] of Object.entries(uploadFiles)) {
        if (!file) continue;

        // Upload file
        const { file_url } = await base44.integrations.Core.UploadFile({ file });

        // Check existing versions
        const existingDocs = documents.filter(d => 
          d.batch_id === batch.batch_id && 
          d.document_type === docType &&
          d.claim_id
        );
        const latestVersion = existingDocs.length > 0 
          ? Math.max(...existingDocs.map(d => d.version || 1))
          : 0;

        // Create new document version
        await base44.entities.Document.create({
          batch_id: batch.batch_id,
          claim_id: batch.batch_id, // Link to batch as claim reference
          document_type: docType,
          document_name: file.name,
          file_url: file_url,
          upload_date: new Date().toISOString().split('T')[0],
          status: 'PENDING',
          version: latestVersion + 1,
          parent_document_id: existingDocs.length > 0 ? existingDocs[existingDocs.length - 1].id : null,
          uploaded_by: user?.email
        });
      }

      await base44.entities.Notification.create({
        title: 'Claim Documents Uploaded',
        message: `${Object.keys(uploadFiles).length} claim documents uploaded for batch ${batch.batch_id}`,
        type: 'INFO',
        module: 'DOCUMENT',
        reference_id: batch.batch_id,
        target_role: 'TUGURE'
      });

      setSuccessMessage('Claim documents uploaded successfully');
      setShowUploadDialog(false);
      setSelectedBatch(null);
      setUploadFiles({});
      loadData();
    } catch (error) {
      console.error('Upload error:', error);
      setErrorMessage('Failed to upload documents');
    }
    setProcessing(false);
  };

  const handleFileSelect = (docType, file) => {
    setUploadFiles(prev => ({
      ...prev,
      [docType]: file
    }));
  };

  const filteredBatches = batches.filter(b => {
    if (filters.contract !== 'all' && b.contract_id !== filters.contract) return false;
    if (filters.batch && !b.batch_id.includes(filters.batch)) return false;
    if (filters.startDate && b.created_date < filters.startDate) return false;
    if (filters.endDate && b.created_date > filters.endDate) return false;
    
    const batchDocs = getBatchDocuments(b.batch_id);
    if (filters.status !== 'all') {
      const hasStatus = batchDocs.some(d => d.status === filters.status);
      if (!hasStatus && batchDocs.length > 0) return false;
      if (batchDocs.length === 0 && filters.status !== 'all') return false;
    }
    
    if (filters.version !== 'all') {
      const hasVersion = batchDocs.some(d => d.version === parseInt(filters.version));
      if (!hasVersion) return false;
    }
    
    return true;
  });

  const groupedDocuments = {};
  documents.forEach(doc => {
    if (!groupedDocuments[doc.batch_id]) {
      groupedDocuments[doc.batch_id] = {};
    }
    if (!groupedDocuments[doc.batch_id][doc.document_type]) {
      groupedDocuments[doc.batch_id][doc.document_type] = [];
    }
    groupedDocuments[doc.batch_id][doc.document_type].push(doc);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Claim"
        subtitle="Bulk upload and manage claim documents per batch"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Document Claim' }
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => setShowUploadDialog(true)}
            >
              <Upload className="w-4 h-4 mr-2" />
              Bulk Upload
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

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <Select value={filters.contract} onValueChange={(val) => setFilters({...filters, contract: val})}>
              <SelectTrigger>
                <SelectValue placeholder="Contract" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Contracts</SelectItem>
                {contracts.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.contract_id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Batch ID..."
              value={filters.batch}
              onChange={(e) => setFilters({...filters, batch: e.target.value})}
            />
            <Select value={filters.status} onValueChange={(val) => setFilters({...filters, status: val})}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="VERIFIED">Verified</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.version} onValueChange={(val) => setFilters({...filters, version: val})}>
              <SelectTrigger>
                <SelectValue placeholder="Version" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Versions</SelectItem>
                <SelectItem value="1">Version 1</SelectItem>
                <SelectItem value="2">Version 2</SelectItem>
                <SelectItem value="3">Version 3</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({...filters, startDate: e.target.value})}
            />
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({...filters, endDate: e.target.value})}
            />
          </div>
          <div className="mt-3 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setFilters({ contract: 'all', batch: '', status: 'all', version: 'all', startDate: '', endDate: '' })}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* File Manager View */}
      <div className="grid gap-4">
        {filteredBatches.map(batch => {
          const progress = calculateDocProgress(batch.batch_id);
          const batchDocs = groupedDocuments[batch.batch_id] || {};
          
          return (
            <Card key={batch.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Folder className="w-8 h-8 text-blue-600" />
                    <div>
                      <CardTitle className="text-lg">{batch.batch_id}</CardTitle>
                      <p className="text-sm text-gray-500">
                        {batch.batch_month}/{batch.batch_year} • {batch.total_records || 0} claims
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Document Progress</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress value={progress.percentage} className="w-32 h-2" />
                        <span className="text-sm font-medium">{progress.percentage}%</span>
                      </div>
                    </div>
                    <Button 
                      size="sm"
                      onClick={() => {
                        setSelectedBatch(batch.id);
                        setShowUploadDialog(true);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Docs
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {CLAIM_DOCUMENT_TYPES.map(docType => {
                    const versions = batchDocs[docType] || [];
                    const latestDoc = versions.length > 0 ? versions[versions.length - 1] : null;
                    
                    return (
                      <div 
                        key={docType}
                        className={`p-3 rounded-lg border-2 cursor-pointer hover:border-blue-500 transition-colors ${
                          latestDoc ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                        }`}
                        onClick={() => {
                          if (latestDoc) {
                            setSelectedDocument({ ...latestDoc, versions });
                            setShowViewDialog(true);
                          }
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <File className={`w-5 h-5 flex-shrink-0 ${latestDoc ? 'text-green-600' : 'text-gray-400'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{docType}</div>
                            {latestDoc ? (
                              <div className="mt-1 space-y-1">
                                <div className="flex items-center gap-1">
                                  <StatusBadge status={latestDoc.status} />
                                  <Badge variant="outline" className="text-xs">v{latestDoc.version}</Badge>
                                </div>
                                <div className="text-xs text-gray-500">
                                  {latestDoc.uploaded_by} • {latestDoc.upload_date}
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-gray-500 mt-1">Not uploaded</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredBatches.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center text-gray-500">
              No batches found matching filters
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bulk Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Upload Claim Documents</DialogTitle>
            <DialogDescription>
              Upload multiple claim documents for batch: {selectedBatch ? batches.find(b => b.id === selectedBatch)?.batch_id : 'Select batch'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!selectedBatch && (
              <div>
                <label className="text-sm font-medium">Select Batch *</label>
                <Select value={selectedBatch || ''} onValueChange={setSelectedBatch}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select batch" />
                  </SelectTrigger>
                  <SelectContent>
                    {batches.map(b => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.batch_id} ({b.batch_month}/{b.batch_year})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedBatch && (
              <div className="space-y-3">
                <div className="text-sm font-medium">Upload Documents:</div>
                {CLAIM_DOCUMENT_TYPES.map(docType => (
                  <div key={docType} className="flex items-center gap-3 p-3 border rounded-lg">
                    <File className="w-5 h-5 text-gray-400" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{docType}</div>
                      {uploadFiles[docType] && (
                        <div className="text-xs text-gray-500 mt-1">{uploadFiles[docType].name}</div>
                      )}
                    </div>
                    <Input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(docType, file);
                      }}
                      className="w-48"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowUploadDialog(false);
              setSelectedBatch(null);
              setUploadFiles({});
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkUpload}
              disabled={processing || !selectedBatch || Object.keys(uploadFiles).length === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {processing ? 'Uploading...' : `Upload ${Object.keys(uploadFiles).length} Documents`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Document Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Document Details</DialogTitle>
            <DialogDescription>{selectedDocument?.document_type}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Document Name:</span>
                <span className="font-medium">{selectedDocument?.document_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Version:</span>
                <Badge>v{selectedDocument?.version}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Status:</span>
                <StatusBadge status={selectedDocument?.status} />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Uploaded By:</span>
                <span className="font-medium">{selectedDocument?.uploaded_by}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Upload Date:</span>
                <span className="font-medium">{selectedDocument?.upload_date}</span>
              </div>
            </div>

            {selectedDocument?.versions && selectedDocument.versions.length > 1 && (
              <div>
                <div className="text-sm font-medium mb-2">Version History:</div>
                <div className="space-y-2">
                  {selectedDocument.versions.map((doc, idx) => (
                    <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">v{doc.version}</Badge>
                        <span className="text-sm">{doc.upload_date}</span>
                        <StatusBadge status={doc.status} />
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => window.open(doc.file_url, '_blank')}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewDialog(false)}>Close</Button>
            <Button onClick={() => window.open(selectedDocument?.file_url, '_blank')}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}