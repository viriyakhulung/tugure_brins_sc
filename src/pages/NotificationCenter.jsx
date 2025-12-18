import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bell, CheckCircle2, AlertTriangle, Info, MessageSquare, 
  RefreshCw, Check, Trash2, Eye, Download, Filter
} from "lucide-react";
import { base44 } from '@/api/base44Client';
import PageHeader from "@/components/common/PageHeader";
import FilterPanel from "@/components/common/FilterPanel";
import DataTable from "@/components/common/DataTable";
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function NotificationCenter() {
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [contracts, setContracts] = useState([]);
  const [filters, setFilters] = useState({
    contract: 'all',
    batch: '',
    type: 'all',
    module: 'all'
  });

  useEffect(() => {
    loadUser();
    loadData();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error('Failed to load user:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [notifData, contractData] = await Promise.all([
        base44.entities.Notification.list(),
        base44.entities.Contract.list()
      ]);
      setNotifications(notifData || []);
      setContracts(contractData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  const handleMarkAsRead = async (notifId) => {
    try {
      await base44.entities.Notification.update(notifId, { is_read: true });
      loadData();
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unreadNotifs = notifications.filter(n => !n.is_read);
      for (const notif of unreadNotifs) {
        await base44.entities.Notification.update(notif.id, { is_read: true });
      }
      loadData();
    } catch (error) {
      console.error('Mark all as read error:', error);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    setFilters({
      contract: 'all',
      batch: '',
      type: 'all',
      module: 'all'
    });
  };

  const handleExport = (format) => {
    console.log('Export notifications to:', format);
  };

  const getIcon = (type) => {
    switch (type) {
      case 'ACTION_REQUIRED': return AlertTriangle;
      case 'WARNING': return AlertTriangle;
      case 'INFO': return Info;
      case 'DECISION': return CheckCircle2;
      default: return Bell;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'ACTION_REQUIRED': return 'bg-red-100 text-red-700 border-red-200';
      case 'WARNING': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'INFO': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'DECISION': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filters.type !== 'all' && n.type !== filters.type) return false;
    if (filters.module !== 'all' && n.module !== filters.module) return false;
    if (activeTab === 'unread' && n.is_read) return false;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification Center"
        subtitle="System notifications and alerts"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Notifications' }
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            {unreadCount > 0 && (
              <Button variant="outline" onClick={handleMarkAllAsRead}>
                <Check className="w-4 h-4 mr-2" />
                Mark All Read
              </Button>
            )}
          </div>
        }
      />

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Type</label>
              <select 
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="w-full h-9 rounded-md border border-gray-200 px-3 text-sm"
              >
                <option value="all">All Types</option>
                <option value="ACTION_REQUIRED">Action Required</option>
                <option value="WARNING">Warning</option>
                <option value="INFO">Info</option>
                <option value="DECISION">Decision</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Module</label>
              <select 
                value={filters.module}
                onChange={(e) => handleFilterChange('module', e.target.value)}
                className="w-full h-9 rounded-md border border-gray-200 px-3 text-sm"
              >
                <option value="all">All Modules</option>
                <option value="DEBTOR">Debtor</option>
                <option value="BORDERO">Bordero</option>
                <option value="PAYMENT">Payment</option>
                <option value="CLAIM">Claim</option>
              </select>
            </div>
            <div className="md:col-span-2 flex items-end gap-2">
              <Button variant="outline" onClick={clearFilters} className="flex-1">
                Clear Filters
              </Button>
              <Button variant="outline" onClick={() => handleExport('excel')}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">
            All Notifications ({notifications.length})
          </TabsTrigger>
          <TabsTrigger value="unread">
            <div className="flex items-center gap-2">
              Unread
              {unreadCount > 0 && (
                <Badge className="bg-red-500 text-white">{unreadCount}</Badge>
              )}
            </div>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <div className="space-y-3">
            {loading ? (
              <Card>
                <CardContent className="p-8 text-center text-gray-500">
                  Loading notifications...
                </CardContent>
              </Card>
            ) : filteredNotifications.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Bell className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">No notifications</p>
                </CardContent>
              </Card>
            ) : (
              filteredNotifications.map((notif) => {
                const Icon = getIcon(notif.type);
                return (
                  <Card 
                    key={notif.id}
                    className={`transition-all ${!notif.is_read ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-lg ${!notif.is_read ? 'bg-blue-100' : 'bg-gray-100'}`}>
                          <Icon className={`w-5 h-5 ${!notif.is_read ? 'text-blue-600' : 'text-gray-600'}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <h4 className={`font-semibold ${!notif.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                                {notif.title}
                              </h4>
                              <Badge variant="outline" className={getTypeColor(notif.type)}>
                                {notif.type.replace(/_/g, ' ')}
                              </Badge>
                              <Badge variant="outline">
                                {notif.module}
                              </Badge>
                            </div>
                            <span className="text-xs text-gray-500">
                              {format(new Date(notif.created_date), 'MMM d, yyyy HH:mm')}
                            </span>
                          </div>
                          <p className="text-gray-600 text-sm mb-3">{notif.message}</p>
                          <div className="flex items-center gap-2">
                            {!notif.is_read && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleMarkAsRead(notif.id)}
                              >
                                <Check className="w-4 h-4 mr-1" />
                                Mark as Read
                              </Button>
                            )}
                            {notif.action_url && (
                              <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                                <Eye className="w-4 h-4 mr-1" />
                                View Details
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}