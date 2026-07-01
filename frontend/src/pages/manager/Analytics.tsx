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
  AreaChart,
  Area,
  Legend,
  Cell,
  PieChart,
  Pie,
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
  Tag,
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

const STATUS_COLORS: Record<string, string> = {
  pending:     '#f59e0b',
  in_progress: '#3b82f6',
  resolved:    '#10b981',
  appealed:    '#ef4444',
};

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

/** Horizontal bar chart — handles many labels cleanly */
function HorizontalBarChart({
  data,
  dataKey,
  labelKey,
  color,
  height,
}: {
  data: { [key: string]: any }[];
  dataKey: string;
  labelKey: string;
  color: string;
  height?: number;
}) {
  const chartHeight = Math.max(data.length * 40, 200);
  return (
    <ResponsiveContainer width="100%" height={height ?? chartHeight}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
        <XAxis
          type="number"
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#64748b', fontSize: 11 }}
        />
        <YAxis
          type="category"
          dataKey={labelKey}
          axisLine={false}
          tickLine={false}
          width={110}
          tick={{ fill: '#64748b', fontSize: 11 }}
        />
        <Tooltip
          contentStyle={{
            borderRadius: '12px',
            border: 'none',
            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
          }}
          cursor={{ fill: 'rgba(59,130,246,0.05)' }}
        />
        <Bar dataKey={dataKey} fill={color} radius={[0, 4, 4, 0]} barSize={16} />
      </BarChart>
    </ResponsiveContainer>
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

  // heatmap slices
  const [heatmapCategory, setHeatmapCategory] = useState<HeatmapItem[]>([]);
  const [heatmapTime, setHeatmapTime]         = useState<HeatmapItem[]>([]);
  const [heatmapDept, setHeatmapDept]         = useState<HeatmapItem[]>([]);
  const [topIssues, setTopIssues]             = useState<{ id: number; title: string; count: number }[]>([]);

  // loading / error
  const [loadingDashboard,   setLoadingDashboard]   = useState(false);
  const [loadingDept,        setLoadingDept]         = useState(false);
  const [loadingHeatmapCat,  setLoadingHeatmapCat]  = useState(false);
  const [loadingHeatmapTime, setLoadingHeatmapTime] = useState(false);
  const [loadingHeatmapDept, setLoadingHeatmapDept] = useState(false);
  const [loadingTopIssues,   setLoadingTopIssues]   = useState(false);
  const [loadingCategories,  setLoadingCategories]  = useState(false);

  const [errorDashboard,   setErrorDashboard]   = useState<string | null>(null);
  const [errorDept,        setErrorDept]         = useState<string | null>(null);
  const [errorHeatmapCat,  setErrorHeatmapCat]  = useState<string | null>(null);
  const [errorHeatmapTime, setErrorHeatmapTime] = useState<string | null>(null);
  const [errorHeatmapDept, setErrorHeatmapDept] = useState<string | null>(null);
  const [errorTopIssues,   setErrorTopIssues]   = useState<string | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const res = await studentApi.getCategories();
      setCategories(res.data.categories ?? []);
    } catch {
      /* non-critical */
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
      setDashboard(res.data.data);
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

  const fetchHeatmapCategory = useCallback(async () => {
    setLoadingHeatmapCat(true);
    setErrorHeatmapCat(null);
    try {
      const res = await managerApi.getHeatmap('category');
      // sort descending so the longest bar is on top
      const sorted = [...(res.data?.heatmap ?? [])].sort((a, b) => b.count - a.count);
      setHeatmapCategory(sorted);
    } catch {
      setErrorHeatmapCat('Failed to load category volume.');
    } finally {
      setLoadingHeatmapCat(false);
    }
  }, []);

  const fetchHeatmapTime = useCallback(async () => {
    setLoadingHeatmapTime(true);
    setErrorHeatmapTime(null);
    try {
      const res = await managerApi.getHeatmap('time');
      setHeatmapTime(res.data?.heatmap ?? []);
    } catch {
      setErrorHeatmapTime('Failed to load complaint trend.');
    } finally {
      setLoadingHeatmapTime(false);
    }
  }, []);

  const fetchHeatmapDept = useCallback(async () => {
    setLoadingHeatmapDept(true);
    setErrorHeatmapDept(null);
    try {
      const res = await managerApi.getHeatmap('department');
      const sorted = [...(res.data?.heatmap ?? [])].sort((a, b) => b.count - a.count);
      setHeatmapDept(sorted);
    } catch {
      setErrorHeatmapDept('Failed to load department load data.');
    } finally {
      setLoadingHeatmapDept(false);
    }
  }, []);

  const fetchTopIssues = useCallback(async () => {
    setLoadingTopIssues(true);
    setErrorTopIssues(null);
    try {
            const param = categoryId !== 'all' ? categoryId : null;

      const res = await managerApi.getTopIssues(param);
      setTopIssues(res.data?.top_issues ?? []);
    } catch {
      setErrorTopIssues('Failed to load top issues.');
    } finally {
      setLoadingTopIssues(false);
    }
  }, [categoryId]);

  useEffect(() => {
    fetchCategories();
    fetchDepartments();
    fetchHeatmapCategory();
    fetchHeatmapTime();
    fetchHeatmapDept();
  }, [fetchCategories, fetchDepartments, fetchHeatmapCategory, fetchHeatmapTime, fetchHeatmapDept]);

  useEffect(() => {
    fetchDashboard();
    fetchTopIssues();
  }, [fetchDashboard, fetchTopIssues]);

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

  // ── Derived ────────────────────────────────────────────────────────────────

  const selectedCategoryName =
    categoryId === 'all'
      ? null
      : categories.find((c) => String(c.id) === categoryId)?.name ?? null;

  const kpis = dashboard
    ? [
        { label: 'Total Complaints', value: dashboard.totalComplaints.toLocaleString(), icon: FileText,     trend: 'neutral' as const },
        { label: 'Resolution Rate',  value: dashboard.resolutionRate,                   icon: CheckCircle,   trend: 'up'      as const },
        { label: 'Late Response Rate',  value: dashboard.slaBreachRate,                    icon: AlertTriangle, trend: 'down'    as const },
        { label: 'Appeal Rate',      value: dashboard.appealRate,                       icon: Users,         trend: 'neutral' as const },
      ]
    : [];

  const statusPieData = dashboard
    ? Object.entries(dashboard.statusBreakdown).map(([key, val]) => ({
        name: key.replace('_', ' '),
        value: val,
        fill: STATUS_COLORS[key] ?? '#94a3b8',
      }))
    : [];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">

      {/* ── Header + Filter ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Insights</h1>
          <p className="text-muted-foreground">Monitor performance metrics and workflow health</p>
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
              <option key={c.id} value={String(c.id)}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
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
                    <Badge variant={kpi.trend === 'up' ? 'success' : 'destructive'} className="gap-1">
                      {kpi.trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
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

      {/* ── Row 1: Complaint Trend (time) + Status Breakdown ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Monthly Complaint Trend — Area Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Complaint Trend</CardTitle>
            <CardDescription>Monthly volume over time</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {loadingHeatmapTime ? (
              <LoadingOverlay />
            ) : errorHeatmapTime ? (
              <ErrorBanner message={errorHeatmapTime} />
            ) : heatmapTime.length === 0 ? (
              <EmptyState label="No trend data available." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={heatmapTime} margin={{ left: -10, right: 8 }}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(v: number) => [v, 'Complaints']}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#trendGrad)"
                    dot={{ r: 3, fill: '#3b82f6' }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Status Breakdown — Donut Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Status Breakdown</CardTitle>
            <CardDescription>
              Percentage share of each complaint status
              {selectedCategoryName && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  <Tag size={10} /> {selectedCategoryName}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {loadingDashboard ? (
              <LoadingOverlay />
            ) : statusPieData.length === 0 ? (
              <EmptyState label="No status data." />
            ) : (
              <>
                <ResponsiveContainer width="100%" height="80%">
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                    >
                      {statusPieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number, name: string) => [`${v}%`, name]}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-4">
                  {statusPieData.map((entry, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.fill }} />
                      <span className="text-xs font-medium capitalize">{entry.name} ({entry.value}%)</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: Category Volume + Department Load ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Requests by Category — Horizontal Bar (replaces pie) */}
        <Card>
          <CardHeader>
            <CardTitle>Requests by Category</CardTitle>
            <CardDescription>Complaint volume per category, ranked highest first</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingHeatmapCat ? (
              <LoadingOverlay />
            ) : errorHeatmapCat ? (
              <ErrorBanner message={errorHeatmapCat} />
            ) : heatmapCategory.length === 0 ? (
              <EmptyState label="No category data available." />
            ) : (
              <HorizontalBarChart
                data={heatmapCategory}
                dataKey="count"
                labelKey="label"
                color="#3b82f6"
              />
            )}
          </CardContent>
        </Card>

        {/* Complaint Load by Department — Horizontal Bar */}
        <Card>
          <CardHeader>
            <CardTitle>Complaint Load by Department</CardTitle>
            <CardDescription>Which departments generate the most complaints</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingHeatmapDept ? (
              <LoadingOverlay />
            ) : errorHeatmapDept ? (
              <ErrorBanner message={errorHeatmapDept} />
            ) : heatmapDept.length === 0 ? (
              <EmptyState label="No department load data available." />
            ) : (
              <HorizontalBarChart
                data={heatmapDept}
                dataKey="count"
                labelKey="label"
                color="#f59e0b"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: Department Performance (total vs resolved + avg hours) ─── */}
      <Card>
        <CardHeader>
          <CardTitle>Department Performance</CardTitle>
          <CardDescription>Total vs resolved complaints and average resolution hours per department</CardDescription>
        </CardHeader>
        <CardContent className="h-[320px]">
          {loadingDept ? (
            <LoadingOverlay />
          ) : errorDept ? (
            <ErrorBanner message={errorDept} />
          ) : departments.length === 0 ? (
            <EmptyState label="No department data available." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departments} margin={{ left: -10, right: 8 }}>
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
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: 'rgba(59,130,246,0.05)' }}
                  formatter={(value: number, name: string) => [
                    name === 'avg_hours' ? `${value}h` : value,
                    name === 'total' ? 'Total' : name === 'resolved' ? 'Resolved' : 'Avg Hours',
                  ]}
                />
                <Legend formatter={(val) => val === 'total' ? 'Total' : val === 'resolved' ? 'Resolved' : 'Avg Hours Resolution time'} />
                <Bar dataKey="total"     fill="#3b82f6" radius={[4,4,0,0]} barSize={18} />
                <Bar dataKey="resolved"  fill="#10b981" radius={[4,4,0,0]} barSize={18} />
                <Bar dataKey="avg_hours" fill="#f59e0b" radius={[4,4,0,0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Row 4: Officer Performance + Top Issues ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Officer Performance — filtered by selected category */}
        <Card>
          <CardHeader>
            <CardTitle>Officer Performance</CardTitle>
            <CardDescription>
              Resolution stats per officer
              {selectedCategoryName ? (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  <Tag size={10} /> {selectedCategoryName}
                </span>
              ) : (
                <span className="ml-1 text-xs text-muted-foreground">— select a category to filter</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingDashboard ? (
              <LoadingOverlay />
            ) : !dashboard || dashboard.officerPerformance.length === 0 ? (
              <EmptyState label={selectedCategoryName ? `No officers assigned to ${selectedCategoryName}.` : 'No officer data available.'} />
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
                        <td className="py-2 pr-4 text-center text-muted-foreground">{officer.avgResolutionTime}</td>
                        <td className="py-2 text-center">
                          <Badge variant={parseInt(officer.slaCompliance) >= 90 ? 'success' : 'destructive'}>
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

        {/* Top Issues — only meaningful when a category is selected */}
        <Card>
          <CardHeader>
            <CardTitle>Top Recurring Issues</CardTitle>
            <CardDescription>
              {selectedCategoryName
                ? `Most common issues in ${selectedCategoryName}`
                : 'Top recurring issues across all categories'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTopIssues ? (
              <LoadingOverlay />
            ) : errorTopIssues ? (
              <ErrorBanner message={errorTopIssues} />
            ) : topIssues.length === 0 ? (
              <EmptyState label="No recurring issues found for this category." />
            ) : (
              <ol className="space-y-2">
                {topIssues.map((issue) => (
                  <li key={issue.id} className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {issue.id}
                    </span>
                    <span className="flex-1 leading-snug">{issue.title}</span>
                    <Badge variant="secondary" className="ml-auto flex-shrink-0">
                      {issue.count}×
                    </Badge>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}