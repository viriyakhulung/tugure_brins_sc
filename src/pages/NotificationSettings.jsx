import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bell, Mail, MessageSquare, Save, RefreshCw, 
  CheckCircle2, AlertCircle, Settings, User
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import DataTable from "@/components/common/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";

export default function NotificationSettings() {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      const allSettings = await base44.entities.NotificationSetting.list();
      setSettings(allSettings || []);
      
      // Load user's current settings
      const userSetting = allSettings.find(s => s.user_email === currentUser.email);
      if (userSetting) {
        setCurrentSetting(userSetting);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const existingSetting = settings.find(s => s.user_email === user.email);
      
      if (existingSetting) {
        await base44.entities.NotificationSetting.update(existingSetting.id, currentSetting);
      } else {
        await base44.entities.NotificationSetting.create({
          ...currentSetting,
          user_email: user.email,
          user_role: user.role.toUpperCase()
        });
      }

      await base44.entities.AuditLog.create({
        action: 'UPDATE_NOTIFICATION_SETTINGS',
        module: 'SYSTEM',
        entity_type: 'NotificationSetting',
        entity_id: existingSetting?.id || 'new',
        new_value: JSON.stringify(currentSetting),
        user_email: user.email,
        user_role: user.role
      });

      setSuccessMessage('Notification settings saved successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      loadData();
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
    setSaving(false);
  };

  const sendTestNotification = async (type) => {
    try {
      await base44.integrations.Core.SendEmail({
        to: currentSetting.notification_email,
        subject: `Test ${type} Notification - Credit Reinsurance Platform`,
        body: `This is a test notification from the Credit Reinsurance Platform.\n\nNotification Type: ${type}\nTimestamp: ${new Date().toLocaleString()}\n\nIf you received this email, your notification settings are working correctly.`
      });

      setSuccessMessage(`Test ${type} notification sent successfully`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Failed to send test notification:', error);
    }
  };

  const columns = [
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
          <span className="text-sm">{row.notification_email}</span>
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
          {row.notify_on_submit && <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">Submit</span>}
          {row.notify_on_approval && <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">Approval</span>}
          {row.notify_on_rejection && <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">Rejection</span>}
          {row.notify_on_payment && <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">Payment</span>}
          {row.notify_on_claim && <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">Claim</span>}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification Settings"
        subtitle="Manage email and WhatsApp notification preferences"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Notification Settings' }
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

      <Tabs defaultValue="my-settings">
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="my-settings">
            <User className="w-4 h-4 mr-2" />
            My Settings
          </TabsTrigger>
          <TabsTrigger value="all-settings">
            <Settings className="w-4 h-4 mr-2" />
            All Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-settings" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-blue-600" />
                  Contact Information
                </CardTitle>
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
                  <p className="text-xs text-gray-500 mt-1">Notifications will be sent to this email</p>
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
                  <p className="text-xs text-gray-500 mt-1">Include country code (e.g., +62)</p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-600" />
                    <Label>Enable Email Notifications</Label>
                  </div>
                  <Switch
                    checked={currentSetting.email_enabled}
                    onCheckedChange={(checked) => setCurrentSetting({...currentSetting, email_enabled: checked})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-gray-600" />
                    <Label>Enable WhatsApp Notifications</Label>
                  </div>
                  <Switch
                    checked={currentSetting.whatsapp_enabled}
                    onCheckedChange={(checked) => setCurrentSetting({...currentSetting, whatsapp_enabled: checked})}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Notification Types */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-purple-600" />
                  Notification Types
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600 mb-4">
                  Choose which events you want to receive notifications for
                </p>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div>
                      <Label className="font-medium">Debtor Submission</Label>
                      <p className="text-xs text-gray-600">New debtor submitted for review</p>
                    </div>
                    <Switch
                      checked={currentSetting.notify_on_submit}
                      onCheckedChange={(checked) => setCurrentSetting({...currentSetting, notify_on_submit: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div>
                      <Label className="font-medium">Approval</Label>
                      <p className="text-xs text-gray-600">Debtor or claim approved</p>
                    </div>
                    <Switch
                      checked={currentSetting.notify_on_approval}
                      onCheckedChange={(checked) => setCurrentSetting({...currentSetting, notify_on_approval: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div>
                      <Label className="font-medium">Rejection</Label>
                      <p className="text-xs text-gray-600">Debtor or claim rejected</p>
                    </div>
                    <Switch
                      checked={currentSetting.notify_on_rejection}
                      onCheckedChange={(checked) => setCurrentSetting({...currentSetting, notify_on_rejection: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                    <div>
                      <Label className="font-medium">Payment</Label>
                      <p className="text-xs text-gray-600">Payment received or matched</p>
                    </div>
                    <Switch
                      checked={currentSetting.notify_on_payment}
                      onCheckedChange={(checked) => setCurrentSetting({...currentSetting, notify_on_payment: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <div>
                      <Label className="font-medium">Claim</Label>
                      <p className="text-xs text-gray-600">Claim submitted or updated</p>
                    </div>
                    <Switch
                      checked={currentSetting.notify_on_claim}
                      onCheckedChange={(checked) => setCurrentSetting({...currentSetting, notify_on_claim: checked})}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <Card className="mt-6">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="flex gap-3">
                  <Button
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Settings
                      </>
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => sendTestNotification('Email')}
                    disabled={!currentSetting.email_enabled || !currentSetting.notification_email}
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Send Test Email
                  </Button>
                </div>

                <Alert className="max-w-md">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Changes will be applied immediately after saving
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all-settings" className="mt-6">
          <DataTable
            columns={columns}
            data={settings}
            isLoading={loading}
            emptyMessage="No notification settings found"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}