import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, Upload, Plus, RefreshCw, CheckCircle2, 
  XCircle, Eye, Clock, Download, History
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import StatCard from "@/components/dashboard/StatCard";

export default function MasterContractManagement() {
  const [user, setUser] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showVersionDialog, setShowVersionDialog] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [formData, setFormData] = useState({
    contract_id: '',
    policy_number: '',
    product_type: 'Treaty',
    credit_type: 'Individual',
    coverage_start_date: '',
    coverage_end_date: '',
    coverage_limit: 0,
    reinsurance_share: 0,
    effective_date: '',
    remarks: ''
  });
  const [approvalAction, setApprovalAction] = useState('');
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [uploadFile, setUploadFile] = useState(null);

  const isTugure = user?.role === 'TUGURE' || user?.role === 'admin';
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadUser();
    loadData();
  }, []);

  const loadUser = async () => {
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
      const data = await base44.entities.MasterContract.list();
      setContracts(data || []);
    } catch (error) {
      console.error('Failed to load contracts:', error);
    }
    setLoading(false);
  };

  const handleCreateContract = async () => {
    setProcessing(true);
    try {
      await base44.entities.MasterContract.create({
        ...formData,
        effective_status: 'Draft',
        version: 1
      });

      await base44.entities.AuditLog.create({
        action: 'CREATE_MASTER_CONTRACT',
        module: 'CONFIG',
        entity_type: 'MasterContract',
        entity_id: formData.contract_id,
        user_email: user?.email,
        user_role: user?.role
      });

      setSuccessMessage('Master Contract created successfully');
      setShowFormDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Create error:', error);
    }
    setProcessing(false);
  };

  const handleApproval = async () => {
    if (!selectedContract || !approvalAction) return;

    setProcessing(true);
    try {
      const updates = { rejection_reason: approvalRemarks };

      if (approvalAction === 'FIRST_APPROVE') {
        updates.effective_status = 'Pending Second Approval';
        updates.first_approved_by = user?.email;
        updates.first_approved_date = new Date().toISOString();
      } else if (approvalAction === 'SECOND_APPROVE') {
        updates.effective_status = 'Active';
        updates.second_approved_by = user?.email;
        updates.second_approved_date = new Date().toISOString();
      } else if (approvalAction === 'REJECT') {
        updates.effective_status = 'Draft';
      }

      await base44.entities.MasterContract.update(selectedContract.id, updates);

      await base44.entities.AuditLog.create({
        action: `CONTRACT_${approvalAction}`,
        module: 'CONFIG',
        entity_type: 'MasterContract',
        entity_id: selectedContract.id,
        user_email: user?.email,
        user_role: user?.role,
        reason: approvalRemarks
      });

      setSuccessMessage(`Contract ${approvalAction.toLowerCase().replace('_', ' ')} successfully`);
      setShowApprovalDialog(false);
      setSelectedContract(null);
      setApprovalAction('');
      setApprovalRemarks('');
      loadData();
    } catch (error) {
      console.error('Approval error:', error);
    }
    setProcessing(false);
  };

  const handleCreateVersion = async () => {
    if (!selectedContract) return;

    setProcessing(true);
    try {
      const newVersion = {
        ...formData,
        version: (selectedContract.version || 1) + 1,
        parent_contract_id: selectedContract.id,
        effective_status: 'Draft'
      };

      await base44.entities.MasterContract.create(newVersion);

      // Archive old version
      await base44.entities.MasterContract.update(selectedContract.id, {
        effective_status: 'Archived'
      });

      await base44.entities.AuditLog.create({
        action: 'CREATE_CONTRACT_VERSION',
        module: 'CONFIG',
        entity_type: 'MasterContract',
        entity_id: selectedContract.id,
        user_email: user?.email,
        user_role: user?.role
      });

      setSuccessMessage('New contract version created successfully');
      setShowVersionDialog(false);
      setSelectedContract(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Version error:', error);
    }
    setProcessing(false);
  };

  const handleUploadExcel = async () => {
    if (!uploadFile) return;

    setProcessing(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadFile });

      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: file_url,
        json_schema: {
          type: "object",
          properties: {
            contracts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  contract_id: { type: "string" },
                  policy_number: { type: "string" },
                  product_type: { type: "string" },
                  credit_type: { type: "string" },
                  coverage_start_date: { type: "string" },
                  coverage_end_date: { type: "string" },
                  coverage_limit: { type: "number" },
                  reinsurance_share: { type: "number" }
                }
              }
            }
          }
        }
      });

      if (result.status === 'success' && result.output?.contracts) {
        for (const contract of result.output.contracts) {
          await base44.entities.MasterContract.create({
            ...contract,
            effective_status: 'Draft',
            version: 1
          });
        }
        setSuccessMessage(`${result.output.contracts.length} contracts uploaded successfully`);
      } else {
        alert('Failed to extract data from file');
      }

      setShowUploadDialog(false);
      setUploadFile(null);
      loadData();
    } catch (error) {
      console.error('Upload error:', error);
    }
    setProcessing(false);
  };

  const resetForm = () => {
    setFormData({
      contract_id: '',
      policy_number: '',
      product_type: 'Treaty',
      credit_type: 'Individual',
      coverage_start_date: '',
      coverage_end_date: '',
      coverage_limit: 0,
      reinsurance_share: 0,
      effective_date: '',
      remarks: ''
    });
  };

  const getVersionHistory = (contractId) => {
    return contracts.filter(c => 
      c.contract_id === contractId || c.parent_contract_id === contractId
    ).sort((a, b) => (b.version || 1) - (a.version || 1));
  };

  const stats = {
    total: contracts.length,
    active: contracts.filter(c => c.effective_status === 'Active').length,
    pending: contracts.filter(c => c.effective_status?.includes('Pending')).length,
    draft: contracts.filter(c => c.effective_status === 'Draft').length
  };

  const columns = [
    { 
      header: 'Contract ID', 
      accessorKey: 'contract_id',
      cell: (row) => (
        <div>
          <div className="font-medium">{row.contract_id}</div>
          <div className="text-xs text-gray-500">v{row.version || 1}</div>
        </div>
      )
    },
    { header: 'Policy Number', accessorKey: 'policy_number' },
    { header: 'Product Type', accessorKey: 'product_type' },
    { header: 'Credit Type', accessorKey: 'credit_type' },
    { 
      header: 'Coverage Period', 
      cell: (row) => (
        <div className="text-sm">
          {row.coverage_start_date} to {row.coverage_end_date}
        </div>
      )
    },
    { 
      header: 'Coverage Limit', 
      cell: (row) => `IDR ${((row.coverage_limit || 0) / 1000000).toFixed(1)}M`
    },
    { 
      header: 'Share %', 
      cell: (row) => `${row.reinsurance_share || 0}%`
    },
    { 
      header: 'Status', 
      cell: (row) => <StatusBadge status={row.effective_status} />
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedContract(row);
              setShowVersionDialog(true);
            }}
          >
            <History className="w-4 h-4" />
          </Button>
          
          {isTugure && row.effective_status === 'Draft' && (
            <Button
              size="sm"
              className="bg-blue-600"
              onClick={() => {
                setSelectedContract(row);
                setApprovalAction('FIRST_APPROVE');
                setShowApprovalDialog(true);
              }}
            >
              1st Approve
            </Button>
          )}
          
          {isAdmin && row.effective_status === 'Pending Second Approval' && (
            <Button
              size="sm"
              className="bg-green-600"
              onClick={() => {
                setSelectedContract(row);
                setApprovalAction('SECOND_APPROVE');
                setShowApprovalDialog(true);
              }}
            >
              2nd Approve
            </Button>
          )}

          {row.effective_status === 'Active' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelectedContract(row);
                setFormData({ ...row });
                setShowVersionDialog(true);
              }}
            >
              New Version
            </Button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Master Contract Management"
        subtitle="Manage reinsurance master contracts with approval workflow"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Master Contract Management' }
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => {
              const csv = [
                ['contract_id', 'policy_number', 'product_type', 'credit_type', 'coverage_start_date', 'coverage_end_date', 'coverage_limit', 'reinsurance_share', 'effective_date', 'remarks'].join(','),
                ['MC-2025-001', 'POL-12345', 'Treaty', 'Individual', '2025-01-01', '2025-12-31', '1000000000', '75', '2025-01-01', 'Sample contract'].join(','),
                ['MC-2025-002', 'POL-12346', 'Facultative', 'Corporate', '2025-01-01', '2025-12-31', '5000000000', '80', '2025-01-01', 'Sample corporate'].join(',')
              ].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'master_contract_template.csv';
              a.click();
            }}>
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </Button>
            <Button onClick={() => setShowUploadDialog(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Upload Excel
            </Button>
            <Button className="bg-blue-600" onClick={() => setShowFormDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Contract
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total Contracts" value={stats.total} icon={FileText} />
        <StatCard title="Active" value={stats.active} icon={CheckCircle2} className="text-green-600" />
        <StatCard title="Pending Approval" value={stats.pending} icon={Clock} className="text-orange-600" />
        <StatCard title="Draft" value={stats.draft} icon={FileText} className="text-gray-600" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Master Contracts</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={contracts}
            isLoading={loading}
            emptyMessage="No master contracts found"
          />
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Master Contract</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div>
              <label className="text-sm font-medium">Contract ID *</label>
              <Input
                value={formData.contract_id}
                onChange={(e) => setFormData({...formData, contract_id: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Policy Number *</label>
              <Input
                value={formData.policy_number}
                onChange={(e) => setFormData({...formData, policy_number: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Product Type *</label>
              <Select value={formData.product_type} onValueChange={(val) => setFormData({...formData, product_type: val})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Treaty">Treaty</SelectItem>
                  <SelectItem value="Facultative">Facultative</SelectItem>
                  <SelectItem value="Retro">Retro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Credit Type *</label>
              <Select value={formData.credit_type} onValueChange={(val) => setFormData({...formData, credit_type: val})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Individual">Individual</SelectItem>
                  <SelectItem value="Corporate">Corporate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Coverage Start Date *</label>
              <Input
                type="date"
                value={formData.coverage_start_date}
                onChange={(e) => setFormData({...formData, coverage_start_date: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Coverage End Date *</label>
              <Input
                type="date"
                value={formData.coverage_end_date}
                onChange={(e) => setFormData({...formData, coverage_end_date: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Coverage Limit (IDR) *</label>
              <Input
                type="number"
                value={formData.coverage_limit}
                onChange={(e) => setFormData({...formData, coverage_limit: parseFloat(e.target.value) || 0})}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Reinsurance Share (%) *</label>
              <Input
                type="number"
                value={formData.reinsurance_share}
                onChange={(e) => setFormData({...formData, reinsurance_share: parseFloat(e.target.value) || 0})}
              />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium">Remarks</label>
              <Textarea
                value={formData.remarks}
                onChange={(e) => setFormData({...formData, remarks: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFormDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateContract} disabled={processing}>
              Create Contract
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Master Contracts (Excel)</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setUploadFile(e.target.files[0])}
              className="w-full"
            />
            <p className="text-sm text-gray-500 mt-2">
              Upload Excel file with contract data
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>Cancel</Button>
            <Button onClick={handleUploadExcel} disabled={processing || !uploadFile}>
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{approvalAction === 'REJECT' ? 'Reject' : 'Approve'} Contract</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">Remarks</label>
            <Textarea
              value={approvalRemarks}
              onChange={(e) => setApprovalRemarks(e.target.value)}
              placeholder="Enter approval/rejection remarks..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>Cancel</Button>
            <Button onClick={handleApproval} disabled={processing}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog open={showVersionDialog} onOpenChange={setShowVersionDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Contract Version History</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {selectedContract && (
              <div className="space-y-4">
                {getVersionHistory(selectedContract.contract_id).map((version, idx) => (
                  <Card key={idx}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <Badge>Version {version.version || 1}</Badge>
                          <p className="text-sm mt-2"><strong>Status:</strong> {version.effective_status}</p>
                          <p className="text-sm"><strong>Effective Date:</strong> {version.effective_date || 'N/A'}</p>
                          <p className="text-sm"><strong>Coverage:</strong> {version.coverage_start_date} to {version.coverage_end_date}</p>
                        </div>
                        <StatusBadge status={version.effective_status} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVersionDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}