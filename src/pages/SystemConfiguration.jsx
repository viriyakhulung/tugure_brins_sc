import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { 
  Settings, Tag, Shield, DollarSign, Bell, Mail, 
  MessageSquare, Plus, Edit, CheckCircle2, RefreshCw, Loader2
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";

export default function SystemConfiguration() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('status');
  const [showDialog, setShowDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Form state
  const [configKey, setConfigKey] = useState('');
  const [configValue, setConfigValue] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.SystemConfig.list();
      
      // If no data, create sample configurations
      if (!data || data.length === 0) {
        await createSampleData();
        const newData = await base44.entities.SystemConfig.list();
        setConfigs(newData || []);
      } else {
        setConfigs(data);
      }
    } catch (error) {
      console.error('Failed to load configs:', error);
    }
    setLoading(false);
  };

  const createSampleData = async () => {
    const sampleConfigs = [
      // Status Reference
      { config_type: 'STATUS_REFERENCE', config_key: 'DEBTOR_APPROVED', config_value: 'Active Coverage', description: 'Debtor approved and coverage is active', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'STATUS_REFERENCE', config_key: 'DEBTOR_REJECTED', config_value: 'Rejected', description: 'Debtor application rejected', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'STATUS_REFERENCE', config_key: 'CLAIM_SETTLED', config_value: 'Claim Paid', description: 'Claim has been settled and payment completed', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'STATUS_REFERENCE', config_key: 'EXPOSURE_TERMINATED', config_value: 'Coverage Ended', description: 'Exposure terminated due to policy end or early termination', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      
      // Eligibility Rules
      { config_type: 'ELIGIBILITY_RULE', config_key: 'MAX_LOAN_TENURE_MONTHS', config_value: '120', description: 'Maximum loan tenure allowed for coverage (in months)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'ELIGIBILITY_RULE', config_key: 'MIN_LOAN_AMOUNT_IDR', config_value: '10000000', description: 'Minimum loan amount eligible for coverage (IDR)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'ELIGIBILITY_RULE', config_key: 'MAX_DEBTOR_AGE', config_value: '65', description: 'Maximum age of debtor at time of application', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'ELIGIBILITY_RULE', config_key: 'KOLEKTIBILITAS_THRESHOLD', config_value: '2', description: 'Maximum collectibility level allowed (0=Normal, 1=DPK, 2=KL, 3-5=NPL)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'ELIGIBILITY_RULE', config_key: 'REQUIRED_DOCS_INDIVIDUAL', config_value: '4', description: 'Number of required documents for Individual credit type', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'ELIGIBILITY_RULE', config_key: 'REQUIRED_DOCS_CORPORATE', config_value: '6', description: 'Number of required documents for Corporate credit type', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      
      // Financial Thresholds
      { config_type: 'FINANCIAL_THRESHOLD', config_key: 'COVERAGE_PERCENTAGE', config_value: '70', description: 'Default coverage percentage for reinsurance', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'FINANCIAL_THRESHOLD', config_key: 'PREMIUM_RATE_INDIVIDUAL', config_value: '0.85', description: 'Premium rate for individual credit (as % of exposure)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'FINANCIAL_THRESHOLD', config_key: 'PREMIUM_RATE_CORPORATE', config_value: '0.65', description: 'Premium rate for corporate credit (as % of exposure)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'FINANCIAL_THRESHOLD', config_key: 'MAX_CLAIM_AMOUNT_IDR', config_value: '5000000000', description: 'Maximum claimable amount per debtor (IDR)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'FINANCIAL_THRESHOLD', config_key: 'LATE_PAYMENT_PENALTY_RATE', config_value: '0.5', description: 'Late payment penalty rate per month (%)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'FINANCIAL_THRESHOLD', config_key: 'PAYMENT_GRACE_PERIOD_DAYS', config_value: '30', description: 'Grace period before late payment penalty applies', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      
      // Approval Matrix
      { config_type: 'APPROVAL_MATRIX', config_key: 'DEBTOR_AUTO_APPROVE_LIMIT', config_value: '100000000', description: 'Auto-approve debtors with exposure below this amount (IDR)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'APPROVAL_MATRIX', config_key: 'CLAIM_AUTO_APPROVE_LIMIT', config_value: '50000000', description: 'Auto-approve claims below this amount (IDR)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'APPROVAL_MATRIX', config_key: 'REQUIRES_SENIOR_APPROVAL', config_value: '500000000', description: 'Amount requiring senior management approval (IDR)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'APPROVAL_MATRIX', config_key: 'DEBTOR_REVIEW_SLA_HOURS', config_value: '48', description: 'SLA for debtor review and approval (hours)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'APPROVAL_MATRIX', config_key: 'CLAIM_REVIEW_SLA_DAYS', config_value: '14', description: 'SLA for claim review and decision (days)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      
      // Notification Rules
      { config_type: 'NOTIFICATION_RULE', config_key: 'NOTIFY_DEBTOR_SUBMITTED', config_value: 'true', description: 'Send notification when debtor is submitted', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'NOTIFICATION_RULE', config_key: 'NOTIFY_DEBTOR_APPROVED', config_value: 'true', description: 'Send notification when debtor is approved', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'NOTIFICATION_RULE', config_key: 'NOTIFY_CLAIM_SUBMITTED', config_value: 'true', description: 'Send notification when claim is submitted', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'NOTIFICATION_RULE', config_key: 'NOTIFY_PAYMENT_RECEIVED', config_value: 'true', description: 'Send notification when payment is received', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'NOTIFICATION_RULE', config_key: 'NOTIFY_PAYMENT_OVERDUE', config_value: 'true', description: 'Send notification when payment becomes overdue', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'NOTIFICATION_RULE', config_key: 'NOTIFY_DOCUMENT_INCOMPLETE', config_value: 'true', description: 'Notify when debtor documents are incomplete', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      
      // Notification Channels
      { config_type: 'NOTIFICATION_CHANNEL', config_key: 'EMAIL_ENABLED', config_value: 'true', description: 'Enable email notifications', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'NOTIFICATION_CHANNEL', config_key: 'WHATSAPP_ENABLED', config_value: 'false', description: 'Enable WhatsApp notifications', is_active: false, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'NOTIFICATION_CHANNEL', config_key: 'IN_APP_ENABLED', config_value: 'true', description: 'Enable in-app notifications', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'NOTIFICATION_CHANNEL', config_key: 'EMAIL_SMTP_HOST', config_value: 'smtp.company.com', description: 'SMTP server host for email', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'NOTIFICATION_CHANNEL', config_key: 'EMAIL_FROM_ADDRESS', config_value: 'noreply@crp.com', description: 'From email address for notifications', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
    ];

    for (const config of sampleConfigs) {
      try {
        await base44.entities.SystemConfig.create(config);
      } catch (error) {
        console.error('Failed to create sample config:', error);
      }
    }
  };

  const handleSaveConfig = async () => {
    setProcessing(true);
    try {
      const configData = {
        config_type: activeTab.toUpperCase().replace('-', '_'),
        config_key: configKey,
        config_value: configValue,
        description: description,
        is_active: isActive,
        effective_date: new Date().toISOString().split('T')[0],
        status: 'APPROVED'
      };

      if (editingConfig) {
        await base44.entities.SystemConfig.update(editingConfig.id, configData);
      } else {
        await base44.entities.SystemConfig.create(configData);
      }

      setSuccessMessage('Configuration saved successfully');
      setShowDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Save error:', error);
    }
    setProcessing(false);
  };

  const resetForm = () => {
    setConfigKey('');
    setConfigValue('');
    setDescription('');
    setIsActive(true);
    setEditingConfig(null);
  };

  const openEditDialog = (config) => {
    setEditingConfig(config);
    setConfigKey(config.config_key);
    setConfigValue(config.config_value);
    setDescription(config.description || '');
    setIsActive(config.is_active);
    setShowDialog(true);
  };

  const getConfigsByType = (type) => {
    return configs.filter(c => c.config_type === type.toUpperCase().replace('-', '_'));
  };

  const configColumns = [
    { header: 'Config Key', accessorKey: 'config_key', cell: (row) => <span className="font-mono text-sm">{row.config_key}</span> },
    { header: 'Value', accessorKey: 'config_value' },
    { header: 'Description', accessorKey: 'description' },
    { 
      header: 'Status',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${row.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="text-sm">{row.is_active ? 'Active' : 'Inactive'}</span>
        </div>
      )
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => openEditDialog(row)}>
            <Edit className="w-4 h-4" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Configuration"
        subtitle="Manage system parameters and rules"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'System Configuration' }
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                resetForm();
                setShowDialog(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Config
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="status">
            <Tag className="w-4 h-4 mr-2" />
            Status
          </TabsTrigger>
          <TabsTrigger value="eligibility">
            <Shield className="w-4 h-4 mr-2" />
            Eligibility
          </TabsTrigger>
          <TabsTrigger value="financial">
            <DollarSign className="w-4 h-4 mr-2" />
            Financial
          </TabsTrigger>
          <TabsTrigger value="approval">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Approval
          </TabsTrigger>
          <TabsTrigger value="notification">
            <Bell className="w-4 h-4 mr-2" />
            Notification
          </TabsTrigger>
          <TabsTrigger value="channel">
            <MessageSquare className="w-4 h-4 mr-2" />
            Channel
          </TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Status Reference Configuration</CardTitle>
              <p className="text-sm text-gray-500 mt-1">Define status labels and descriptions for various entities</p>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                columns={configColumns}
                data={getConfigsByType('status')}
                isLoading={loading}
                emptyMessage="No status references configured"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="eligibility" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Eligibility Rules</CardTitle>
              <p className="text-sm text-gray-500 mt-1">Configure debtor eligibility criteria and requirements</p>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                columns={configColumns}
                data={getConfigsByType('eligibility')}
                isLoading={loading}
                emptyMessage="No eligibility rules configured"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Financial Thresholds</CardTitle>
              <p className="text-sm text-gray-500 mt-1">Set coverage percentages, premium rates, and claim limits</p>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                columns={configColumns}
                data={getConfigsByType('financial')}
                isLoading={loading}
                emptyMessage="No financial thresholds configured"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approval" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Approval Matrix</CardTitle>
              <p className="text-sm text-gray-500 mt-1">Define auto-approval limits and SLA requirements</p>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                columns={configColumns}
                data={getConfigsByType('approval')}
                isLoading={loading}
                emptyMessage="No approval matrix configured"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notification" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Rules</CardTitle>
              <p className="text-sm text-gray-500 mt-1">Control when notifications are triggered for different events</p>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                columns={configColumns}
                data={getConfigsByType('notification')}
                isLoading={loading}
                emptyMessage="No notification rules configured"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="channel" className="mt-4">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Notification Channels</CardTitle>
                <p className="text-sm text-gray-500 mt-1">Enable or disable notification delivery channels</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Mail className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">Email Notifications</p>
                        <p className="text-sm text-gray-500">Send notifications via SMTP email</p>
                      </div>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium">WhatsApp Notifications</p>
                        <p className="text-sm text-gray-500">Send notifications via WhatsApp Business API</p>
                      </div>
                    </div>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                        <Bell className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium">In-App Notifications</p>
                        <p className="text-sm text-gray-500">Display in notification center</p>
                      </div>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Channel Configuration</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <DataTable
                  columns={configColumns}
                  data={getConfigsByType('channel')}
                  isLoading={loading}
                  emptyMessage="No channel configurations"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Config Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingConfig ? 'Edit Configuration' : 'Add Configuration'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Config Type</Label>
              <Select value={activeTab} disabled>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="status">Status Reference</SelectItem>
                  <SelectItem value="eligibility">Eligibility Rule</SelectItem>
                  <SelectItem value="financial">Financial Threshold</SelectItem>
                  <SelectItem value="approval">Approval Matrix</SelectItem>
                  <SelectItem value="notification">Notification Rule</SelectItem>
                  <SelectItem value="channel">Notification Channel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Config Key *</Label>
              <Input
                value={configKey}
                onChange={(e) => setConfigKey(e.target.value.toUpperCase().replace(/\s/g, '_'))}
                placeholder="e.g., MAX_LOAN_AMOUNT"
              />
            </div>
            <div>
              <Label>Config Value *</Label>
              <Input
                value={configValue}
                onChange={(e) => setConfigValue(e.target.value)}
                placeholder="Enter value (number, text, or true/false)"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe this configuration..."
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveConfig}
              disabled={processing || !configKey || !configValue}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Save Config
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}