import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Settings, Bell, Mail, MessageSquare, Shield, DollarSign, 
  CheckCircle2, RefreshCw, Loader2, Plus, Edit, Trash2, Eye, User
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import { format } from 'date-fns';

export default function SystemConfiguration() {
  const [user, setUser] = useState(null);
  const [configs, setConfigs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [notificationSettings, setNotificationSettings] = useState([]);
  const [selectedSettings, setSelectedSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('notifications');
  const [showDialog, setShowDialog] = useState(false);
  const [showSettingDialog, setShowSettingDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // User notification setting
  const [currentSetting, setCurrentSetting] = useState({
    notification_email: '',
    whatsapp_number: '',
    email_enabled: true,
    whatsapp_enabled: false,
    notify_on_submit: true,
    notify_on_approval: true,
    notify_on_rejection: true,
    notify_on_payment: true,
    notify_on_claim: true
  });

  // Config form
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
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      const [configData, notifData, settingsData] = await Promise.all([
        base44.entities.SystemConfig.list(),
        base44.entities.Notification.list(),
        base44.entities.NotificationSetting.list()
      ]);
      
      if (!configData || configData.length === 0) {
        await createSampleConfigs();
        const newConfigData = await base44.entities.SystemConfig.list();
        setConfigs(newConfigData || []);
      } else {
        setConfigs(configData || []);
      }
      
      setNotifications(notifData || []);
      setNotificationSettings(settingsData || []);
      
      const userSetting = settingsData.find(s => s.user_email === currentUser.email);
      if (userSetting) {
        setCurrentSetting(userSetting);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  const createSampleConfigs = async () => {
    const sampleConfigs = [
      // Eligibility Rules
      { config_type: 'ELIGIBILITY_RULE', config_key: 'MAX_LOAN_TENURE_MONTHS', config_value: '120', description: 'Maximum loan tenure allowed for coverage (months)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'ELIGIBILITY_RULE', config_key: 'MIN_LOAN_AMOUNT_IDR', config_value: '10000000', description: 'Minimum loan amount eligible for coverage (IDR)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'ELIGIBILITY_RULE', config_key: 'MAX_DEBTOR_AGE', config_value: '65', description: 'Maximum age of debtor at time of application', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
      { config_type: 'ELIGIBILITY_RULE', config_key: 'KOLEKTIBILITAS_THRESHOLD', config_value: '2', description: 'Maximum collectibility level allowed (0=Normal, 1=DPK, 2=KL)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' },
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
      { config_type: 'APPROVAL_MATRIX', config_key: 'CLAIM_REVIEW_SLA_DAYS', config_value: '14', description: 'SLA for claim review and decision (days)', is_active: true, status: 'APPROVED', effective_date: '2025-01-01' }
    ];

    for (const config of sampleConfigs) {
      try {
        await base44.entities.SystemConfig.create(config);
      } catch (error) {
        console.error('Failed to create sample config:', error);
      }
    }
    
    // Create sample notifications
    const sampleNotifications = [
      {
        title: 'Email Notification Sent',
        message: 'Auto email notification has been sent to brins@company.com regarding debtor approval for Batch BATCH-2025-001. The system successfully notified the recipient about the approval of 15 debtors.',
        type: 'INFO',
        module: 'SYSTEM',
        is_read: false,
        target_role: 'ALL'
      },
      {
        title: 'Debtor Submission Approved',
        message: 'Batch BATCH-2025-001 with 15 debtors has been approved. Email notification was automatically sent to the submitter.',
        type: 'DECISION',
        module: 'DEBTOR',
        is_read: false,
        target_role: 'BRINS'
      },
      {
        title: 'Payment Received',
        message: 'Payment of IDR 50,000,000 received for Invoice INV-2025-001. Auto email notification sent to finance team.',
        type: 'INFO',
        module: 'PAYMENT',
        is_read: false,
        target_role: 'TUGURE'
      }
    ];
    
    for (const notif of sampleNotifications) {
      try {
        await base44.entities.Notification.create(notif);
      } catch (error) {
        console.error('Failed to create sample notification:', error);
      }
    }
  };

  const handleSaveUserSettings = async () => {
    setProcessing(true);
    try {
      const existing = notificationSettings.find(s => s.user_email === user.email);
      
      if (existing) {
        await base44.entities.NotificationSetting.update(existing.id, currentSetting);
      } else {
        await base44.entities.NotificationSetting.create({
          ...currentSetting,
          user_email: user.email,
          user_role: user.role.toUpperCase()
        });
      }

      setSuccessMessage('Settings saved successfully');
      loadData();
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
    setProcessing(false);
  };

  const handleSaveConfig = async () => {
    setProcessing(true);
    try {
      const typeMap = {
        'rules': 'ELIGIBILITY_RULE',
        'thresholds': 'FINANCIAL_THRESHOLD',
        'approval': 'APPROVAL_MATRIX'
      };
      
      const configData = {
        config_type: typeMap[activeTab === 'rules' ? 'rules' : activeTab === 'thresholds' ? 'thresholds' : 'approval'],
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

  const handleMarkAsRead = async (notifId) => {
    try {
      await base44.entities.Notification.update(notifId, { is_read: true });
      loadData();
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  };

  const handleDeleteSettings = async () => {
    if (selectedSettings.length === 0) return;
    
    setProcessing(true);
    try {
      for (const id of selectedSettings) {
        await base44.entities.NotificationSetting.delete(id);
      }
      setSuccessMessage(`Deleted ${selectedSettings.length} settings`);
      setSelectedSettings([]);
      loadData();
    } catch (error) {
      console.error('Delete error:', error);
    }
    setProcessing(false);
  };

  const toggleSettingSelection = (id) => {
    if (selectedSettings.includes(id)) {
      setSelectedSettings(selectedSettings.filter(sid => sid !== id));
    } else {
      setSelectedSettings([...selectedSettings, id]);
    }
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
    const typeMap = {
      'rules': 'ELIGIBILITY_RULE',
      'thresholds': 'FINANCIAL_THRESHOLD',
      'approval': 'APPROVAL_MATRIX'
    };
    return configs.filter(c => c.config_type === typeMap[type]);
  };

  const unreadNotifications = notifications.filter(n => !n.is_read);

  const configColumns = [
    { header: 'Config Key', cell: (row) => <span className="font-mono text-sm">{row.config_key}</span> },
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
        <Button variant="outline" size="sm" onClick={() => openEditDialog(row)}>
          <Edit className="w-4 h-4" />
        </Button>
      )
    }
  ];

  const settingsColumns = [
    {
      header: (
        <Checkbox
          checked={selectedSettings.length === notificationSettings.length && notificationSettings.length > 0}
          onCheckedChange={(checked) => {
            if (checked) {
              setSelectedSettings(notificationSettings.map(s => s.id));
            } else {
              setSelectedSettings([]);
            }
          }}
        />
      ),
      cell: (row) => (
        <Checkbox
          checked={selectedSettings.includes(row.id)}
          onCheckedChange={() => toggleSettingSelection(row.id)}
        />
      ),
      width: '50px'
    },
    {
      header: 'User',
      cell: (row) => (
        <div>
          <p className="font-medium">{row.user_email}</p>
          <StatusBadge status={row.user_role} />
        </div>
      )
    },
    {
      header: 'Email',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Mail className={`w-4 h-4 ${row.email_enabled ? 'text-green-600' : 'text-gray-400'}`} />
          <span className="text-sm">{row.notification_email || '-'}</span>
        </div>
      )
    },
    {
      header: 'WhatsApp',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <MessageSquare className={`w-4 h-4 ${row.whatsapp_enabled ? 'text-green-600' : 'text-gray-400'}`} />
          <span className="text-sm">{row.whatsapp_number || '-'}</span>
        </div>
      )
    },
    {
      header: 'Notifications',
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.notify_on_submit && <Badge variant="outline" className="text-xs">Submit</Badge>}
          {row.notify_on_approval && <Badge variant="outline" className="text-xs">Approval</Badge>}
          {row.notify_on_payment && <Badge variant="outline" className="text-xs">Payment</Badge>}
          {row.notify_on_claim && <Badge variant="outline" className="text-xs">Claim</Badge>}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Configuration"
        subtitle="Manage notifications, settings, and system rules"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'System Configuration' }
        ]}
        actions={
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        }
      />

      {successMessage && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">{successMessage}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="notifications">
            <Bell className="w-4 h-4 mr-2" />
            Notifications ({unreadNotifications.length})
          </TabsTrigger>
          <TabsTrigger value="my-settings">
            <User className="w-4 h-4 mr-2" />
            My Settings
          </TabsTrigger>
          <TabsTrigger value="all-settings">
            <Settings className="w-4 h-4 mr-2" />
            All Settings
          </TabsTrigger>
          <TabsTrigger value="rules">
            <Shield className="w-4 h-4 mr-2" />
            Business Rules
          </TabsTrigger>
          <TabsTrigger value="thresholds">
            <DollarSign className="w-4 h-4 mr-2" />
            Thresholds
          </TabsTrigger>
        </TabsList>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="mt-4">
          <div className="space-y-3">
            {unreadNotifications.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Bell className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">No unread notifications</p>
                </CardContent>
              </Card>
            ) : (
              unreadNotifications.map((notif) => (
                <Card key={notif.id} className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-lg bg-blue-100">
                        <Bell className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <h4 className="font-semibold text-gray-900">{notif.title}</h4>
                            <Badge variant="outline">{notif.type.replace(/_/g, ' ')}</Badge>
                            <Badge variant="outline">{notif.module}</Badge>
                          </div>
                          <span className="text-xs text-gray-500">
                            {format(new Date(notif.created_date), 'MMM d, HH:mm')}
                          </span>
                        </div>
                        <p className="text-gray-600 text-sm mb-3">{notif.message}</p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleMarkAsRead(notif.id)}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Mark as Read
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* My Settings Tab */}
        <TabsContent value="my-settings" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Email for Notifications</Label>
                  <Input
                    type="email"
                    value={currentSetting.notification_email}
                    onChange={(e) => setCurrentSetting({...currentSetting, notification_email: e.target.value})}
                    placeholder="your.email@example.com"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>WhatsApp Number</Label>
                  <Input
                    type="tel"
                    value={currentSetting.whatsapp_number}
                    onChange={(e) => setCurrentSetting({...currentSetting, whatsapp_number: e.target.value})}
                    placeholder="+62812345678"
                    className="mt-1"
                  />
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <Label>Enable Email Notifications</Label>
                  <Switch
                    checked={currentSetting.email_enabled}
                    onCheckedChange={(checked) => setCurrentSetting({...currentSetting, email_enabled: checked})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Enable WhatsApp Notifications</Label>
                  <Switch
                    checked={currentSetting.whatsapp_enabled}
                    onCheckedChange={(checked) => setCurrentSetting({...currentSetting, whatsapp_enabled: checked})}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notification Types</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { key: 'notify_on_submit', label: 'Debtor Submission', color: 'blue' },
                  { key: 'notify_on_approval', label: 'Approval', color: 'green' },
                  { key: 'notify_on_rejection', label: 'Rejection', color: 'red' },
                  { key: 'notify_on_payment', label: 'Payment', color: 'yellow' },
                  { key: 'notify_on_claim', label: 'Claim', color: 'purple' }
                ].map(({ key, label, color }) => (
                  <div key={key} className={`flex items-center justify-between p-3 bg-${color}-50 rounded-lg`}>
                    <Label>{label}</Label>
                    <Switch
                      checked={currentSetting[key]}
                      onCheckedChange={(checked) => setCurrentSetting({...currentSetting, [key]: checked})}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardContent className="p-6 flex justify-center">
              <Button
                onClick={handleSaveUserSettings}
                disabled={processing}
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
                    Save Settings
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Settings Tab */}
        <TabsContent value="all-settings" className="mt-4">
          {selectedSettings.length > 0 && (
            <Card className="mb-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">{selectedSettings.length} settings selected</p>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteSettings}
                    disabled={processing}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Selected
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          <DataTable
            columns={settingsColumns}
            data={notificationSettings}
            isLoading={loading}
            emptyMessage="No notification settings found"
          />
        </TabsContent>

        {/* Business Rules Tab */}
        <TabsContent value="rules" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Business Rules</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">Configure eligibility criteria and requirements</p>
                </div>
                <Button onClick={() => { resetForm(); setShowDialog(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Rule
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                columns={configColumns}
                data={getConfigsByType('rules')}
                isLoading={loading}
                emptyMessage="No rules configured"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Thresholds Tab */}
        <TabsContent value="thresholds" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Financial Thresholds</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">Set coverage percentages, premium rates, and limits</p>
                </div>
                <Button onClick={() => { resetForm(); setShowDialog(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Threshold
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                columns={configColumns}
                data={getConfigsByType('thresholds')}
                isLoading={loading}
                emptyMessage="No thresholds configured"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Config Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingConfig ? 'Edit Configuration' : 'Add Configuration'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
                placeholder="Enter value"
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
                  Save
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}