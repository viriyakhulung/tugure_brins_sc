import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  LayoutDashboard, FileText, Upload, FileCheck, BarChart3, 
  DollarSign, CreditCard, Scale, Bell, User, Settings, 
  LogOut, Menu, X, ChevronRight, Shield, Activity
} from "lucide-react";
export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { base44 } = await import('@/api/base44Client');
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      loadNotificationCount();
    } catch (error) {
      // User not logged in, redirect to Home
      if (currentPageName !== 'Home') {
        window.location.href = createPageUrl('Home');
      }
    }
    setLoading(false);
  };

  const logout = async () => {
    try {
      const { base44 } = await import('@/api/base44Client');
      await base44.auth.logout();
      window.location.href = createPageUrl('Home');
    } catch (error) {
      window.location.href = createPageUrl('Home');
    }
  };

  const hasAccess = (allowedRoles) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return allowedRoles.includes(user.role?.toUpperCase());
  };

  const loadNotificationCount = async () => {
    try {
      const { base44 } = await import('@/api/base44Client');
      const notifs = await base44.entities.Notification.list();
      const unread = (notifs || []).filter(n => !n.is_read).length;
      setUnreadNotifications(unread);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  // Show loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Menu structure - all users can access all features in prototype mode
  const menuItems = {
    common: [
      { name: 'Dashboard', icon: LayoutDashboard, path: 'Dashboard' }
    ],
    operations: [
      { name: 'Submit Debtor', icon: Upload, path: 'SubmitDebtor' },
      { name: 'Document Eligibility', icon: FileCheck, path: 'DocumentEligibility' },
      { name: 'Debtor Review', icon: FileCheck, path: 'DebtorReview' },
      { name: 'Payment Intent', icon: DollarSign, path: 'PaymentIntent' },
      { name: 'Payment Status', icon: CreditCard, path: 'PaymentStatus' },
      { name: 'Reconciliation', icon: Scale, path: 'Reconciliation' },
      { name: 'Claim Submit', icon: FileText, path: 'ClaimSubmit' },
      { name: 'Claim Review', icon: FileText, path: 'ClaimReview' }
    ],
    shared: [
      { name: 'Bordero Management', icon: BarChart3, path: 'BorderoManagement' },
      { name: 'Notifications', icon: Bell, path: 'NotificationCenter', badge: unreadNotifications },
      { name: 'Audit Log', icon: Activity, path: 'AuditLog' },
      { name: 'System Config', icon: Settings, path: 'SystemConfiguration' },
      { name: 'Profile', icon: User, path: 'Profile' }
    ]
  };

  // Don't render layout for Home page (show custom login)
  if (currentPageName === 'Home') {
    return <>{children}</>;
  }

  const renderMenuItem = (item) => {
    const isActive = currentPageName === item.path;
    const Icon = item.icon;

    return (
      <Link
        key={item.path}
        to={createPageUrl(item.path)}
        className={`flex items-center justify-between px-4 py-3 rounded-lg transition-all ${
          isActive 
            ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md' 
            : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        <div className="flex items-center gap-3">
          <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
          <span className={`font-medium ${isActive ? 'text-white' : ''}`}>{item.name}</span>
        </div>
        {item.badge > 0 && (
          <Badge className="bg-red-500 text-white">{item.badge}</Badge>
        )}
        {isActive && (
          <ChevronRight className="w-4 h-4 text-white" />
        )}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50">
      {/* Top Header */}
      <header className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Credit Reinsurance Platform</h1>
                <p className="text-xs text-gray-500">BRINS - TUGURE System</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link to={createPageUrl('NotificationCenter')}>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                {unreadNotifications > 0 && (
                  <Badge className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs">
                    {unreadNotifications}
                  </Badge>
                )}
              </Button>
            </Link>
            <Separator orientation="vertical" className="h-6" />
            <Link to={createPageUrl('Profile')}>
              <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user?.full_name || user?.email}</p>
                  <p className="text-xs text-gray-500">{user?.role?.toUpperCase() || 'USER'}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
              </div>
            </Link>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`
          fixed lg:sticky top-[73px] left-0 h-[calc(100vh-73px)] bg-white border-r shadow-lg
          transition-all duration-300 z-30 overflow-y-auto
          ${sidebarOpen ? 'w-64 lg:w-64' : 'w-0 lg:w-64'}
        `}>
          <div className="p-4 space-y-6">
            {/* Common */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">
                Main
              </p>
              <nav className="space-y-1">
                {menuItems.common.map(renderMenuItem)}
              </nav>
            </div>

            {/* Operations */}
            <Separator />
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">
                Operations
              </p>
              <nav className="space-y-1">
                {menuItems.operations.map(renderMenuItem)}
              </nav>
            </div>

            {/* Shared */}
            <Separator />
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">
                Shared
              </p>
              <nav className="space-y-1">
                {menuItems.shared.map(renderMenuItem)}
              </nav>
            </div>

            {/* Logout */}
            <Separator />
            <Button
              variant="ghost"
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={logout}
            >
              <LogOut className="w-5 h-5 mr-3" />
              Logout
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 transition-all duration-300">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}