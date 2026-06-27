import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Badge } from '../../components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { managerApi, studentApi } from '../../api/services';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatusBreakdown {
  pending: number;
  in_progress: number;
  resolved: number;
  appealed: number;
}

interface OfficerPerformance {
  id: number;
  full_name: string;
  totalResolved: number;
  avgResolutionTime: string;
  slaCompliance: string;
}

interface DashboardData {
  totalComplaints: number;
  resolutionRate: string;
  slaBreachRate: string;
  appealRate: string;
  statusBreakdown: StatusBreakdown;
  officerPerformance: OfficerPerformance[];
}

interface Department {
  name: string;
  total: number;
  resolved: number;
  avg_hours: number;
}

interface HeatmapItem {
  label: string;
  count: number;
}

interface Category {
  id: number;
  name: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

// ─── Sub-components ───────────────────────────────────────────────────────────

function LoadingOverlay() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="animate-spin text-primary" size={32} />
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <FileText size={36} className="mb-2 opacity-40" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryId = searchParams.get('category_id') || 'all';

  // ── State ──────────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<Category[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapItem[]>([]);

  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [loadingDept, setLoadingDept] = useState(false);
  const [loadingHeatmap, setLoadingHeatmap] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);

  const [errorDashboard, setErrorDashboard] = useState<string | null>(null);
  const [errorDept, setErrorDept] = useState<string | null>(null);
  const [errorHeatmap, setErrorHeatmap] = useState<string | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const res = await studentApi.getCategories();
      setCategories(res.data ?? []);
    } catch {
      // non-critical — silently fail, filter still works with "all"
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    setErrorDashboard(null);
    try {
      const param = categoryId !== 'all' ? categoryId : undefined;
      const res = await managerApi.getOverview(param);
      setDashboard(res.data);
    } catch {
      setErrorDashboard('Failed to load dashboard stats. Please try again.');
    } finally {
      setLoadingDashboard(false);
    }
  }, [categoryId]);

  const fetchDepartments = useCallback(async () => {
    setLoadingDept(true);
    setErrorDept(null);
    try {
      const res = await managerApi.getDepartmentPerformance();
      setDepartments(res.data?.departments ?? []);
    } catch {
      setErrorDept('Failed to load department performance.');
    } finally {
      setLoadingDept(false);
    }
  }, []);

  const fetchHeatmap = useCallback(async () => {
    setLoadingHeatmap(true);
    setErrorHeatmap(null);
    try {
      const res = await managerApi.getHeatmap('category');
      setHeatmap(res.data?.heatmap ?? []);
    } catch {
      setErrorHeatmap('Failed to load category distribution.');
    } finally {
      setLoadingHeatmap(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchDepartments();
    fetchHeatmap();
  }, [fetchCategories, fetchDepartments, fetchHeatmap]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'all') {
      searchParams.delete('category_id');
    } else {
      searchParams.set('category_id', val);
    }
    setSearchParams(searchParams);
  };

  // ── Derived KPIs ───────────────────────────────────────────────────────────

  const kpis = dashboard
    ? [
        {
          label: 'Total Complaints',
          value: dashboard.totalComplaints.toLocaleString(),
          change: null,
          icon: FileText,
          trend: 'neutral' as const,
        },
        {
          label: 'Resolution Rate',
          value: dashboard.resolutionRate,
          change: null,
          icon: CheckCircle,
          trend: 'up' as const,
        },
        {
          label: 'SLA Breach Rate',
          value: dashboard.slaBreachRate,
          change: null,
          icon: AlertTriangle,
          trend: 'down' as const,
        },
        {
          label: 'Appeal Rate',
          value: dashboard.appealRate,
          change: null,
          icon: Users,
          trend: 'neutral' as const,
        },
      ]
    : [];

  // Status breakdown → pie-ready array
  const statusPieData = dashboard
    ? Object.entries(dashboard.statusBreakdown).map(([key, val]) => ({
        name: key.replace('_', ' '),
        value: val,
      }))
    : [];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Header + Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Insights</h1>
          <p className="text-muted-foreground">
            Monitor performance metrics and workflow health
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="category-filter" className="text-sm font-medium text-muted-foreground">
            Category
          </label>
          <select
            id="category-filter"
            value={categoryId}
            onChange={handleCategoryChange}
            disabled={loadingCategories}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      {errorDashboard && <ErrorBanner message={errorDashboard} />}

      {loadingDashboard ? (
        <LoadingOverlay />
      ) : dashboard ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {kpis.map((kpi, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <kpi.icon size={20} />
                  </div>
                  {kpi.trend !== 'neutral' && (
                    <Badge
                      variant={kpi.trend === 'up' ? 'success' : 'destructive'}
                      className="gap-1"
                    >
                      {kpi.trend === 'up' ? (
                        <TrendingUp size={12} />
                      ) : (
                        <TrendingDown size={12} />
                      )}
                    </Badge>
                  )}
                </div>
                <div className="mt-4">
                  <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
                  <h3 className="text-2xl font-bold">{kpi.value}</h3>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Department Performance — Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Department Performance</CardTitle>
            <CardDescription>Total vs resolved complaints per department</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            {loadingDept ? (
              <LoadingOverlay />
            ) : errorDept ? (
              <ErrorBanner message={errorDept} />
            ) : departments.length === 0 ? (
              <EmptyState label="No department data available." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departments} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    }}
                    cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                    formatter={(value: number, name: string) => [
                      value,
                      name === 'total' ? 'Total' : 'Resolved',
                    ]}
                  />
                  <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="resolved" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Category Distribution — Donut Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Requests by Category</CardTitle>
            <CardDescription>Distribution of complaints across categories</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
            {loadingHeatmap ? (
              <LoadingOverlay />
            ) : errorHeatmap ? (
              <ErrorBanner message={errorHeatmap} />
            ) : heatmap.length === 0 ? (
              <EmptyState label="No category data available." />
            ) : (
              <>
                <ResponsiveContainer width="100%" height="85%">
                  <PieChart>
                    <Pie
                      data={heatmap}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="count"
                      nameKey="label"
                    >
                      {heatmap.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [value, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-4">
                  {heatmap.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <span className="text-xs font-medium">{entry.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown — Donut (only when dashboard loaded) */}
      {dashboard && statusPieData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Status Breakdown</CardTitle>
              <CardDescription>Percentage share of each complaint status</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="80%">
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    nameKey="name"
                  >
                    {statusPieData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string) => [`${value}%`, name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-4">
                {statusPieData.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="text-xs font-medium capitalize">
                      {entry.name} ({entry.value}%)
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Officer Performance — Table */}
          <Card>
            <CardHeader>
              <CardTitle>Officer Performance</CardTitle>
              <CardDescription>Resolution stats per officer</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard.officerPerformance.length === 0 ? (
                <EmptyState label="No officer data for this filter." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Officer</th>
                        <th className="pb-2 pr-4 font-medium text-center">Resolved</th>
                        <th className="pb-2 pr-4 font-medium text-center">Avg. Time</th>
                        <th className="pb-2 font-medium text-center">SLA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.officerPerformance.map((officer) => (
                        <tr key={officer.id} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-medium">{officer.full_name}</td>
                          <td className="py-2 pr-4 text-center">{officer.totalResolved}</td>
                          <td className="py-2 pr-4 text-center text-muted-foreground">
                            {officer.avgResolutionTime}
                          </td>
                          <td className="py-2 text-center">
                            <Badge
                              variant={
                                parseInt(officer.slaCompliance) >= 90
                                  ? 'success'
                                  : 'destructive'
                              }
                            >
                              {officer.slaCompliance}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}