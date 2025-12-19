import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, FileText, RefreshCw, Download, Filter } from 'lucide-react';
import { format } from 'date-fns';
import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/dashboard/StatCard';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AdvancedReports() {
  const [loading, setLoading] = useState(true);
  const [debtors, setDebtors] = useState([]);
  const [claims, setClaims] = useState([]);
  const [filters, setFilters] = useState({
    batch: 'all',
    period: '2024',
    branch: 'all',
    plafonRange: 'all'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [debtorData, claimData] = await Promise.all([
        base44.entities.Debtor.list(),
        base44.entities.Claim.list()
      ]);
      setDebtors(debtorData || []);
      setClaims(claimData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  // Filter data based on selected filters
  const filteredDebtors = debtors.filter(d => {
    if (filters.batch !== 'all' && d.batch_id !== filters.batch) return false;
    if (filters.period !== 'all' && d.batch_year?.toString() !== filters.period) return false;
    if (filters.branch !== 'all' && d.branch_code !== filters.branch) return false;
    if (filters.plafonRange !== 'all') {
      const plafon = d.credit_plafond || 0;
      if (filters.plafonRange === '<100M' && plafon >= 100000000) return false;
      if (filters.plafonRange === '100-500M' && (plafon < 100000000 || plafon >= 500000000)) return false;
      if (filters.plafonRange === '500M-1B' && (plafon < 500000000 || plafon >= 1000000000)) return false;
      if (filters.plafonRange === '>1B' && plafon < 1000000000) return false;
    }
    return true;
  });

  // Loss Ratio Calculations
  const lossRatioData = () => {
    const totalPremium = filteredDebtors.reduce((sum, d) => sum + (d.gross_premium || 0), 0);
    const totalClaimPaid = filteredDebtors.reduce((sum, d) => sum + (d.claim_amount || 0), 0);
    const lossRatio = totalPremium > 0 ? (totalClaimPaid / totalPremium * 100) : 0;

    // Monthly trend
    const monthlyData = {};
    filteredDebtors.forEach(d => {
      const month = d.batch_month || 1;
      const key = `${d.batch_year}-${String(month).padStart(2, '0')}`;
      if (!monthlyData[key]) {
        monthlyData[key] = { month: key, premium: 0, claim: 0 };
      }
      monthlyData[key].premium += d.gross_premium || 0;
      monthlyData[key].claim += d.claim_amount || 0;
    });

    const trend = Object.values(monthlyData).map(m => ({
      ...m,
      lossRatio: m.premium > 0 ? (m.claim / m.premium * 100).toFixed(2) : 0
    })).sort((a, b) => a.month.localeCompare(b.month));

    return { totalPremium, totalClaimPaid, lossRatio, trend };
  };

  // Premium by Status
  const premiumByStatus = () => {
    const statusData = {};
    filteredDebtors.forEach(d => {
      const status = d.underwriting_status || 'UNKNOWN';
      if (!statusData[status]) {
        statusData[status] = 0;
      }
      statusData[status] += d.gross_premium || 0;
    });

    return Object.entries(statusData).map(([status, amount]) => ({
      status,
      amount,
      percentage: ((amount / filteredDebtors.reduce((sum, d) => sum + (d.gross_premium || 0), 0)) * 100).toFixed(1)
    }));
  };

  // Claim Paid Report
  const claimPaidData = () => {
    const paidClaims = filteredDebtors.filter(d => d.claim_status === 'SETTLED');
    const totalPaid = paidClaims.reduce((sum, d) => sum + (d.claim_amount || 0), 0);
    const avgClaim = paidClaims.length > 0 ? totalPaid / paidClaims.length : 0;

    // By plafon range
    const ranges = {
      '<100M': 0,
      '100-500M': 0,
      '500M-1B': 0,
      '>1B': 0
    };
    paidClaims.forEach(d => {
      const plafon = d.credit_plafond || 0;
      if (plafon < 100000000) ranges['<100M'] += d.claim_amount || 0;
      else if (plafon < 500000000) ranges['100-500M'] += d.claim_amount || 0;
      else if (plafon < 1000000000) ranges['500M-1B'] += d.claim_amount || 0;
      else ranges['>1B'] += d.claim_amount || 0;
    });

    return { 
      totalPaid, 
      count: paidClaims.length, 
      avgClaim,
      byRange: Object.entries(ranges).map(([range, amount]) => ({ range, amount }))
    };
  };

  // Outstanding Recovery
  const outstandingRecovery = () => {
    const totalClaimPaid = filteredDebtors.reduce((sum, d) => sum + (d.claim_amount || 0), 0);
    const totalRecovered = filteredDebtors.reduce((sum, d) => sum + (d.subrogation_amount || 0), 0);
    const outstanding = totalClaimPaid - totalRecovered;
    const recoveryRate = totalClaimPaid > 0 ? (totalRecovered / totalClaimPaid * 100) : 0;

    return { totalClaimPaid, totalRecovered, outstanding, recoveryRate };
  };

  // Subrogation Tracking
  const subrogationData = () => {
    const statusCount = {};
    filteredDebtors.forEach(d => {
      const status = d.subrogation_status || 'NO_SUBROGATION';
      statusCount[status] = (statusCount[status] || 0) + 1;
    });

    const totalRecovery = filteredDebtors
      .filter(d => d.subrogation_status === 'RECOVERED')
      .reduce((sum, d) => sum + (d.subrogation_amount || 0), 0);

    return {
      statusData: Object.entries(statusCount).map(([status, count]) => ({ status, count })),
      totalRecovery,
      successRate: statusCount['RECOVERED'] ? 
        ((statusCount['RECOVERED'] / Object.values(statusCount).reduce((a,b) => a+b, 0)) * 100).toFixed(1) : 0
    };
  };

  const exportToPDF = async (tabName) => {
    const element = document.getElementById('report-content');
    const canvas = await html2canvas(element);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save(`${tabName}-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const exportToExcel = (data, filename) => {
    const csv = [
      Object.keys(data[0] || {}).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const lossRatio = lossRatioData();
  const premiumStatus = premiumByStatus();
  const claimPaid = claimPaidData();
  const recovery = outstandingRecovery();
  const subrogation = subrogationData();

  const batches = [...new Set(debtors.map(d => d.batch_id))];
  const branches = [...new Set(debtors.map(d => d.branch_code))];
  const years = [...new Set(debtors.map(d => d.batch_year?.toString()))];

  return (
    <div>
      <PageHeader
        title="Advanced Reports"
        subtitle="Executive summary and analytics dashboard"
        breadcrumbs={[
          { label: 'Dashboard', url: 'Dashboard' },
          { label: 'Advanced Reports' }
        ]}
        actions={
          <Button onClick={loadData} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        }
      />

      {/* Filter Panel */}
      <Card className="mb-6 border-2 shadow-lg">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-semibold mb-2 block text-gray-900">Batch</label>
              <Select value={filters.batch} onValueChange={(v) => setFilters({...filters, batch: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Batches</SelectItem>
                  {batches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-semibold mb-2 block text-gray-900">Period</label>
              <Select value={filters.period} onValueChange={(v) => setFilters({...filters, period: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-semibold mb-2 block text-gray-900">Branch</label>
              <Select value={filters.branch} onValueChange={(v) => setFilters({...filters, branch: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-semibold mb-2 block text-gray-900">Plafon Range</label>
              <Select value={filters.plafonRange} onValueChange={(v) => setFilters({...filters, plafonRange: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ranges</SelectItem>
                  <SelectItem value="<100M">&lt; 100 Juta</SelectItem>
                  <SelectItem value="100-500M">100 - 500 Juta</SelectItem>
                  <SelectItem value="500M-1B">500 Juta - 1 Milyar</SelectItem>
                  <SelectItem value=">1B">&gt; 1 Milyar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setFilters({ batch: 'all', period: 'all', branch: 'all', plafonRange: 'all' })}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <div id="report-content">
        <Tabs defaultValue="loss-ratio" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="loss-ratio">Loss Ratio</TabsTrigger>
            <TabsTrigger value="premium-status">Premium by Status</TabsTrigger>
            <TabsTrigger value="claim-paid">Claim Paid</TabsTrigger>
            <TabsTrigger value="recovery">OS Recovery</TabsTrigger>
            <TabsTrigger value="subrogation">Subrogation</TabsTrigger>
          </TabsList>

          {/* Loss Ratio Tab */}
          <TabsContent value="loss-ratio" className="space-y-6">
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => exportToPDF('loss-ratio')}>
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportToExcel(lossRatio.trend, 'loss-ratio')}>
                <Download className="w-4 h-4 mr-2" />
                Excel
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                title="Total Premium"
                value={`Rp ${(lossRatio.totalPremium / 1000000).toFixed(1)}M`}
                subtitle="Total premium collected"
                icon={DollarSign}
                gradient="from-blue-500 to-indigo-600"
              />
              <StatCard
                title="Total Claim Paid"
                value={`Rp ${(lossRatio.totalClaimPaid / 1000000).toFixed(1)}M`}
                subtitle="Total claims settled"
                icon={FileText}
                gradient="from-red-500 to-pink-600"
              />
              <StatCard
                title="Loss Ratio"
                value={`${lossRatio.lossRatio.toFixed(2)}%`}
                subtitle={lossRatio.lossRatio < 70 ? 'Healthy' : lossRatio.lossRatio < 85 ? 'Warning' : 'Critical'}
                icon={lossRatio.lossRatio < 70 ? TrendingDown : TrendingUp}
                gradient={lossRatio.lossRatio < 70 ? 'from-green-500 to-emerald-600' : lossRatio.lossRatio < 85 ? 'from-yellow-500 to-orange-600' : 'from-red-500 to-red-700'}
              />
            </div>

            <Card className="shadow-lg border-2">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-blue-50">
                <CardTitle className="text-gray-900 font-bold">Loss Ratio Trend</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {loading ? (
                  <Skeleton className="h-80 w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={lossRatio.trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="month" tick={{ fontSize: 13, fill: '#1F2937', fontWeight: 500 }} stroke="#9CA3AF" />
                      <YAxis yAxisId="left" tick={{ fontSize: 13, fill: '#1F2937', fontWeight: 500 }} stroke="#9CA3AF" />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 13, fill: '#1F2937', fontWeight: 500 }} stroke="#9CA3AF" />
                      <Tooltip 
                        formatter={(value) => `Rp ${(value / 1000000).toFixed(2)}M`}
                        contentStyle={{ backgroundColor: '#fff', border: '2px solid #3B82F6', borderRadius: '8px', color: '#1F2937', fontWeight: 600 }}
                      />
                      <Legend wrapperStyle={{ color: '#1F2937', fontWeight: 600 }} />
                      <Line yAxisId="left" type="monotone" dataKey="premium" stroke="#3b82f6" strokeWidth={3} name="Premium" dot={{ fill: '#3b82f6', r: 5 }} />
                      <Line yAxisId="left" type="monotone" dataKey="claim" stroke="#ef4444" strokeWidth={3} name="Claim" dot={{ fill: '#ef4444', r: 5 }} />
                      <Line yAxisId="right" type="monotone" dataKey="lossRatio" stroke="#10b981" strokeWidth={3} name="Loss Ratio %" dot={{ fill: '#10b981', r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Premium by Status Tab */}
          <TabsContent value="premium-status" className="space-y-6">
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => exportToPDF('premium-status')}>
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportToExcel(premiumStatus, 'premium-status')}>
                <Download className="w-4 h-4 mr-2" />
                Excel
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="shadow-lg border-2">
                <CardHeader className="bg-gradient-to-r from-gray-50 to-purple-50">
                  <CardTitle className="text-gray-900 font-bold">Premium Distribution by Status</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {loading ? (
                    <Skeleton className="h-80 w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={premiumStatus}
                          dataKey="amount"
                          nameKey="status"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={(entry) => `${entry.status} (${entry.percentage}%)`}
                          labelStyle={{ fill: '#1F2937', fontSize: '13px', fontWeight: '700' }}
                        >
                          {premiumStatus.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value) => `Rp ${(value / 1000000).toFixed(2)}M`}
                          contentStyle={{ backgroundColor: '#fff', border: '2px solid #3B82F6', borderRadius: '8px', color: '#1F2937', fontWeight: 600 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-lg border-2">
                <CardHeader className="bg-gradient-to-r from-gray-50 to-indigo-50">
                  <CardTitle className="text-gray-900 font-bold">Premium by Status Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {loading ? (
                    <Skeleton className="h-80 w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={premiumStatus}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="status" tick={{ fontSize: 13, fill: '#1F2937', fontWeight: 500 }} stroke="#9CA3AF" />
                        <YAxis tick={{ fontSize: 13, fill: '#1F2937', fontWeight: 500 }} stroke="#9CA3AF" />
                        <Tooltip 
                          formatter={(value) => `Rp ${(value / 1000000).toFixed(2)}M`}
                          contentStyle={{ backgroundColor: '#fff', border: '2px solid #3B82F6', borderRadius: '8px', color: '#1F2937', fontWeight: 600 }}
                        />
                        <Legend wrapperStyle={{ color: '#1F2937', fontWeight: 600 }} />
                        <Bar dataKey="amount" fill="#3b82f6" name="Premium Amount" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Claim Paid Tab */}
          <TabsContent value="claim-paid" className="space-y-6">
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => exportToPDF('claim-paid')}>
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportToExcel(claimPaid.byRange, 'claim-paid')}>
                <Download className="w-4 h-4 mr-2" />
                Excel
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                title="Total Claim Paid"
                value={`Rp ${(claimPaid.totalPaid / 1000000).toFixed(1)}M`}
                subtitle={`${claimPaid.count} claims settled`}
                icon={FileText}
                gradient="from-green-500 to-emerald-600"
              />
              <StatCard
                title="Average Claim"
                value={`Rp ${(claimPaid.avgClaim / 1000000).toFixed(1)}M`}
                subtitle="Per claim average"
                icon={DollarSign}
                gradient="from-blue-500 to-indigo-600"
              />
              <StatCard
                title="Settlement Count"
                value={claimPaid.count}
                subtitle="Total settled claims"
                icon={FileText}
                gradient="from-purple-500 to-pink-600"
              />
            </div>

            <Card className="shadow-lg border-2">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-green-50">
                <CardTitle className="text-gray-900 font-bold">Claims by Plafon Range</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {loading ? (
                  <Skeleton className="h-80 w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={claimPaid.byRange}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="range" tick={{ fontSize: 13, fill: '#1F2937', fontWeight: 500 }} stroke="#9CA3AF" />
                      <YAxis tick={{ fontSize: 13, fill: '#1F2937', fontWeight: 500 }} stroke="#9CA3AF" />
                      <Tooltip 
                        formatter={(value) => `Rp ${(value / 1000000).toFixed(2)}M`}
                        contentStyle={{ backgroundColor: '#fff', border: '2px solid #10B981', borderRadius: '8px', color: '#1F2937', fontWeight: 600 }}
                      />
                      <Legend wrapperStyle={{ color: '#1F2937', fontWeight: 600 }} />
                      <Bar dataKey="amount" fill="#10b981" name="Claim Amount" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Outstanding Recovery Tab */}
          <TabsContent value="recovery" className="space-y-6">
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => exportToPDF('recovery')}>
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard
                title="Total Claim Paid"
                value={`Rp ${(recovery.totalClaimPaid / 1000000).toFixed(1)}M`}
                subtitle="Total claims paid"
                icon={FileText}
                gradient="from-red-500 to-pink-600"
              />
              <StatCard
                title="Total Recovered"
                value={`Rp ${(recovery.totalRecovered / 1000000).toFixed(1)}M`}
                subtitle="Amount recovered"
                icon={DollarSign}
                gradient="from-green-500 to-emerald-600"
              />
              <StatCard
                title="Outstanding"
                value={`Rp ${(recovery.outstanding / 1000000).toFixed(1)}M`}
                subtitle="Remaining to recover"
                icon={TrendingUp}
                gradient="from-orange-500 to-red-600"
              />
              <StatCard
                title="Recovery Rate"
                value={`${recovery.recoveryRate.toFixed(1)}%`}
                subtitle="Success rate"
                icon={TrendingDown}
                gradient="from-blue-500 to-indigo-600"
              />
            </div>

            <Card className="shadow-lg border-2">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-orange-50">
                <CardTitle className="text-gray-900 font-bold">Recovery Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {loading ? (
                  <Skeleton className="h-80 w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={[
                      { name: 'Claim Paid', value: recovery.totalClaimPaid },
                      { name: 'Recovered', value: recovery.totalRecovered },
                      { name: 'Outstanding', value: recovery.outstanding }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="name" tick={{ fontSize: 13, fill: '#1F2937', fontWeight: 500 }} stroke="#9CA3AF" />
                      <YAxis tick={{ fontSize: 13, fill: '#1F2937', fontWeight: 500 }} stroke="#9CA3AF" />
                      <Tooltip 
                        formatter={(value) => `Rp ${(value / 1000000).toFixed(2)}M`}
                        contentStyle={{ backgroundColor: '#fff', border: '2px solid #F59E0B', borderRadius: '8px', color: '#1F2937', fontWeight: 600 }}
                      />
                      <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]}>
                        {[0, 1, 2].map((index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subrogation Tab */}
          <TabsContent value="subrogation" className="space-y-6">
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => exportToPDF('subrogation')}>
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportToExcel(subrogation.statusData, 'subrogation')}>
                <Download className="w-4 h-4 mr-2" />
                Excel
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatCard
                title="Total Recovery"
                value={`Rp ${(subrogation.totalRecovery / 1000000).toFixed(1)}M`}
                subtitle="Successfully recovered"
                icon={DollarSign}
                gradient="from-green-500 to-emerald-600"
              />
              <StatCard
                title="Success Rate"
                value={`${subrogation.successRate}%`}
                subtitle="Recovery success rate"
                icon={TrendingUp}
                gradient="from-blue-500 to-indigo-600"
              />
            </div>

            <Card className="shadow-lg border-2">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-purple-50">
                <CardTitle className="text-gray-900 font-bold">Subrogation Status Distribution</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {loading ? (
                  <Skeleton className="h-80 w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={subrogation.statusData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="status" tick={{ fontSize: 13, fill: '#1F2937', fontWeight: 500 }} stroke="#9CA3AF" />
                      <YAxis tick={{ fontSize: 13, fill: '#1F2937', fontWeight: 500 }} stroke="#9CA3AF" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#fff', border: '2px solid #8B5CF6', borderRadius: '8px', color: '#1F2937', fontWeight: 600 }}
                      />
                      <Legend wrapperStyle={{ color: '#1F2937', fontWeight: 600 }} />
                      <Bar dataKey="count" fill="#8b5cf6" name="Cases Count" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}