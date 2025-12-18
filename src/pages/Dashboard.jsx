import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, FileText, DollarSign, AlertTriangle, TrendingUp, 
  Clock, CheckCircle2, XCircle, BarChart3, PieChart,
  ArrowUpRight, ArrowDownRight, Download, Filter
} from "lucide-react";
import { PieChart as RePieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend, Area, AreaChart } from 'recharts';
import { useAuth } from "@/components/auth/AuthContext";
import StatCard from "@/components/dashboard/StatCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function Dashboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState('2025-03');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDebtors: 0,
    approvedDebtors: 0,
    pendingDebtors: 0,
    rejectedDebtors: 0,
    totalExposure: 0,
    totalPremium: 0,
    totalClaims: 0,
    claimsPaid: 0,
    osRecovery: 0,
    lossRatio: 0
  });

  const [debtors, setDebtors] = useState([]);
  const [claims, setClaims] = useState([]);
  const [borderos, setBorderos] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, [period]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [debtorData, claimData, borderoData] = await Promise.all([
        base44.entities.Debtor.list(),
        base44.entities.Claim.list(),
        base44.entities.Bordero.list()
      ]);

      setDebtors(debtorData || []);
      setClaims(claimData || []);
      setBorderos(borderoData || []);

      // Calculate stats
      const approved = debtorData.filter(d => d.submit_status === 'APPROVED').length;
      const pending = debtorData.filter(d => d.submit_status === 'SUBMITTED').length;
      const rejected = debtorData.filter(d => d.submit_status === 'REJECTED').length;
      
      const totalExposure = debtorData.reduce((sum, d) => sum + (d.exposure_amount || 0), 0);
      const totalPremium = debtorData.reduce((sum, d) => sum + (d.net_premi || 0), 0);
      const totalClaimValue = claimData.reduce((sum, c) => sum + (c.nilai_klaim || 0), 0);
      const claimsPaid = claimData.filter(c => c.claim_status === 'SETTLED').reduce((sum, c) => sum + (c.approved_amount || 0), 0);
      
      const lossRatio = totalPremium > 0 ? ((claimsPaid / totalPremium) * 100).toFixed(1) : 0;

      setStats({
        totalDebtors: debtorData.length,
        approvedDebtors: approved,
        pendingDebtors: pending,
        rejectedDebtors: rejected,
        totalExposure,
        totalPremium,
        totalClaims: claimData.length,
        claimsPaid,
        osRecovery: totalClaimValue - claimsPaid,
        lossRatio
      });

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
    setLoading(false);
  };

  // Chart data
  const premiumByStatusData = [
    { name: 'Approved', value: stats.approvedDebtors, color: '#10B981' },
    { name: 'Pending', value: stats.pendingDebtors, color: '#F59E0B' },
    { name: 'Rejected', value: stats.rejectedDebtors, color: '#EF4444' },
    { name: 'Draft', value: stats.totalDebtors - stats.approvedDebtors - stats.pendingDebtors - stats.rejectedDebtors, color: '#6B7280' }
  ].filter(d => d.value > 0);

  const monthlyTrendData = [
    { month: 'Jan', premium: 2500000000, claims: 500000000 },
    { month: 'Feb', premium: 2800000000, claims: 600000000 },
    { month: 'Mar', premium: 3200000000, claims: 450000000 },
    { month: 'Apr', premium: 2900000000, claims: 700000000 },
    { month: 'May', premium: 3500000000, claims: 550000000 },
    { month: 'Jun', premium: 3800000000, claims: 800000000 }
  ];

  const claimStatusData = [
    { name: 'Submitted', value: claims.filter(c => c.claim_status === 'SUBMITTED').length },
    { name: 'Under Review', value: claims.filter(c => c.claim_status === 'UNDER_REVIEW').length },
    { name: 'Approved', value: claims.filter(c => c.claim_status === 'APPROVED').length },
    { name: 'Settled', value: claims.filter(c => c.claim_status === 'SETTLED').length },
    { name: 'Rejected', value: claims.filter(c => c.claim_status === 'REJECTED').length }
  ].filter(d => d.value > 0);

  const formatCurrency = (value) => {
    if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B`;
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Analytics</h1>
          <p className="text-gray-500">Credit Reinsurance Overview - {user?.role || 'User'}</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025-03">March 2025</SelectItem>
              <SelectItem value="2025-02">February 2025</SelectItem>
              <SelectItem value="2025-01">January 2025</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
          <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Exposure"
          value={`IDR ${formatCurrency(stats.totalExposure)}`}
          subtitle={`${stats.approvedDebtors} approved debtors`}
          icon={TrendingUp}
          gradient
          className="from-blue-500 to-blue-600"
        />
        <StatCard
          title="Total Premium"
          value={`IDR ${formatCurrency(stats.totalPremium)}`}
          subtitle="Net premium collected"
          icon={DollarSign}
          gradient
          className="from-emerald-500 to-emerald-600"
        />
        <StatCard
          title="Claims Paid"
          value={`IDR ${formatCurrency(stats.claimsPaid)}`}
          subtitle={`${claims.filter(c => c.claim_status === 'SETTLED').length} claims settled`}
          icon={FileText}
          gradient
          className="from-amber-500 to-orange-500"
        />
        <StatCard
          title="Loss Ratio"
          value={`${stats.lossRatio}%`}
          subtitle="Claims vs Premium"
          icon={BarChart3}
          gradient
          className="from-purple-500 to-indigo-600"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Debtors</p>
              <p className="text-2xl font-bold">{stats.totalDebtors}</p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending Approval</p>
              <p className="text-2xl font-bold text-amber-600">{stats.pendingDebtors}</p>
            </div>
            <Clock className="w-8 h-8 text-amber-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">OS Recovery</p>
              <p className="text-2xl font-bold text-orange-600">IDR {formatCurrency(stats.osRecovery)}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Claims</p>
              <p className="text-2xl font-bold">{stats.totalClaims}</p>
            </div>
            <FileText className="w-8 h-8 text-purple-500" />
          </div>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Debtor Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-gray-500" />
              Debtor Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={premiumByStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {premiumByStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RePieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {premiumByStatusData.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-sm text-gray-600">{entry.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Premium vs Claims Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-gray-500" />
              Premium vs Claims Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#6B7280" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" tickFormatter={formatCurrency} />
                  <Tooltip formatter={(value) => `IDR ${formatCurrency(value)}`} />
                  <Legend />
                  <Area type="monotone" dataKey="premium" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} name="Premium" />
                  <Area type="monotone" dataKey="claims" stackId="2" stroke="#EF4444" fill="#EF4444" fillOpacity={0.3} name="Claims" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Claims Status Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gray-500" />
            Claims by Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={claimStatusData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="#6B7280" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} stroke="#6B7280" width={100} />
                <Tooltip />
                <Bar dataKey="value" fill="#3B82F6" radius={[0, 4, 4, 0]}>
                  {claimStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Debtor Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {debtors.slice(0, 5).map((debtor, index) => (
                <div key={debtor.id || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{debtor.nama_peserta}</p>
                    <p className="text-sm text-gray-500">Plafon: IDR {formatCurrency(debtor.plafon || 0)}</p>
                  </div>
                  <StatusBadge status={debtor.submit_status || 'DRAFT'} />
                </div>
              ))}
              {debtors.length === 0 && (
                <p className="text-center text-gray-500 py-8">No debtor submissions yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Claims</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {claims.slice(0, 5).map((claim, index) => (
                <div key={claim.id || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{claim.nama_tertanggung}</p>
                    <p className="text-sm text-gray-500">Claim: IDR {formatCurrency(claim.nilai_klaim || 0)}</p>
                  </div>
                  <StatusBadge status={claim.claim_status || 'DRAFT'} />
                </div>
              ))}
              {claims.length === 0 && (
                <p className="text-center text-gray-500 py-8">No claims submitted yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}