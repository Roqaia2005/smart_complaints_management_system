import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../../components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Badge } from '../../components/ui/badge';
import {
  Loader2,
  FileText,
  AlertTriangle,
  TrendingUp,
  Hash,
  LayoutList,
  Tag,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from 'lucide-react';
import { managerApi, studentApi } from '../../api/services';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopIssue {
  id: number;
  title: string;
  count: number;
}

interface Category {
  id: number;
  name: string;
}

type SortField = 'id' | 'title' | 'count';
type SortDir   = 'asc' | 'desc';

// ─── Constants ────────────────────────────────────────────────────────────────

// Generate a gradient of blues so each bar has a distinct shade
const BAR_COLORS = [
  '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa',
  '#93c5fd', '#bfdbfe', '#dbeafe', '#eff6ff',
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function LoadingOverlay() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="animate-spin text-primary" size={32} />
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <span>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="ml-4 underline underline-offset-2 hover:no-underline"
        >
          Retry
        </button>
      )}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <LayoutList size={40} className="mb-3 opacity-30" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div
            className="p-2 rounded-lg"
            style={{ background: accent ? `${accent}18` : undefined }}
          >
            <Icon size={20} style={{ color: accent ?? 'currentColor' }} className={accent ? '' : 'text-primary'} />
          </div>
        </div>
        <div className="mt-4">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <h3 className="text-2xl font-bold truncate">{value}</h3>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground truncate">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

/** Sort icon helper */
function SortIcon({ field, active, dir }: { field: SortField; active: SortField; dir: SortDir }) {
  if (field !== active) return <ChevronsUpDown size={13} className="text-muted-foreground/40" />;
  return dir === 'asc'
    ? <ChevronUp size={13} className="text-primary" />
    : <ChevronDown size={13} className="text-primary" />;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TopIssuesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryId = searchParams.get('category_id') || 'all';

  // ── State ──────────────────────────────────────────────────────────────────
  const [categories,   setCategories]   = useState<Category[]>([]);
  const [issues,       setIssues]       = useState<TopIssue[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [loadingCats,  setLoadingCats]  = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const [sortField, setSortField] = useState<SortField>('count');
  const [sortDir,   setSortDir]   = useState<SortDir>('desc');
  const [search,    setSearch]    = useState('');

  // ── Fetch categories ───────────────────────────────────────────────────────
  const fetchCategories = useCallback(async () => {
    setLoadingCats(true);
    try {
      const res = await studentApi.getCategories();
      setCategories(res.data.categories ?? []);
    } catch {
      /* non-critical */
    } finally {
      setLoadingCats(false);
    }
  }, []);

  // ── Fetch top issues ───────────────────────────────────────────────────────
  const fetchIssues = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const param = categoryId !== 'all' ? categoryId : undefined;
      const res = await managerApi.getTopIssues(param);
      setIssues(res.data?.top_issues ?? []);
    } catch {
      setError('Failed to load top issues. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { fetchIssues();     }, [fetchIssues]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleCategoryChange = (val: string) => {
    if (val === 'all') {
      searchParams.delete('category_id');
    } else {
      searchParams.set('category_id', val);
    }
    setSearchParams(searchParams);
    setSearch('');
  };

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'count' ? 'desc' : 'asc');
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const selectedCategoryName =
    categoryId === 'all'
      ? null
      : categories.find(c => String(c.id) === categoryId)?.name ?? null;

  const filteredIssues = useMemo(() => {
    let result = [...issues];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(i => i.title.toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'id')    cmp = a.id    - b.id;
      if (sortField === 'count') cmp = a.count - b.count;
      if (sortField === 'title') cmp = a.title.localeCompare(b.title);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [issues, search, sortField, sortDir]);

  // Chart data: top 8 by count for readability, sorted desc
  const chartData = useMemo(
    () =>
      [...issues]
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)
        .map(i => ({ title: i.title.length > 28 ? i.title.slice(0, 26) + '…' : i.title, count: i.count })),
    [issues],
  );

  // KPI derivations
  const totalIssues   = issues.length;
  const totalReports  = issues.reduce((s, i) => s + i.count, 0);
  const topIssue      = issues.length > 0 ? [...issues].sort((a, b) => b.count - a.count)[0] : null;
  const avgRepetition = totalIssues > 0 ? (totalReports / totalIssues).toFixed(1) : '0';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Top Recurring Issues</h1>
          <p className="text-muted-foreground">
            Identify the most repeated complaint patterns to drive policy decisions
          </p>
        </div>

        {/* Category filter dropdown */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <label htmlFor="cat-filter" className="text-sm font-medium text-muted-foreground">
            Category
          </label>
          <select
            id="cat-filter"
            value={categoryId}
            onChange={e => handleCategoryChange(e.target.value)}
            disabled={loadingCats}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          >
            <option value="all">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={String(c.id)}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Category pill tabs ──────────────────────────────────────────────── */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleCategoryChange('all')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              categoryId === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            All
          </button>
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => handleCategoryChange(String(c.id))}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                categoryId === String(c.id)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && <ErrorBanner message={error} onRetry={fetchIssues} />}

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      {!loading && !error && issues.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiCard
            label="Unique Issue Types"
            value={totalIssues}
            sub={selectedCategoryName ? `in ${selectedCategoryName}` : 'across all categories'}
            icon={Hash}
            accent="#3b82f6"
          />
          <KpiCard
            label="Total Reports"
            value={totalReports.toLocaleString()}
            sub="Sum of all repetitions"
            icon={FileText}
            accent="#6366f1"
          />
          <KpiCard
            label="Most Reported Issue"
            value={`${topIssue?.count ?? 0}×`}
            sub={topIssue?.title ?? '—'}
            icon={AlertTriangle}
            accent="#ef4444"
          />
          <KpiCard
            label="Avg. Repetitions"
            value={avgRepetition}
            sub="Per issue type"
            icon={TrendingUp}
            accent="#10b981"
          />
        </div>
      )}

      {/* ── Main content ───────────────────────────────────────────────────── */}
      {loading ? (
        <LoadingOverlay />
      ) : !error && issues.length === 0 ? (
        <EmptyState label="No recurring issues found." />
      ) : !error ? (
        <>
          {/* ── Bar Chart ────────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Issue Frequency</CardTitle>
              <CardDescription>
                Top {Math.min(chartData.length, 8)} most repeated issues
                {selectedCategoryName && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    <Tag size={10} /> {selectedCategoryName}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(chartData.length * 48, 220)}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ left: 8, right: 40, top: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="title"
                    axisLine={false}
                    tickLine={false}
                    width={160}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    }}
                    formatter={(v: number) => [v, 'Reports']}
                    cursor={{ fill: 'rgba(59,130,246,0.05)' }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* ── Full ranked table ─────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>All Issues</CardTitle>
                  <CardDescription>
                    {filteredIssues.length} issue{filteredIssues.length !== 1 ? 's' : ''}
                    {search && ` matching "${search}"`}
                  </CardDescription>
                </div>
                {/* Search */}
                <input
                  type="text"
                  placeholder="Search issues…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full sm:w-56 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </CardHeader>
            <CardContent>
              {filteredIssues.length === 0 ? (
                <EmptyState label={`No issues match "${search}".`} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        {/* Rank */}
                        <th className="pb-3 pr-3 font-medium w-10">#</th>

                        {/* Title — sortable */}
                        <th className="pb-3 pr-4 font-medium">
                          <button
                            onClick={() => handleSort('title')}
                            className="flex items-center gap-1 hover:text-foreground transition-colors"
                          >
                            Issue
                            <SortIcon field="title" active={sortField} dir={sortDir} />
                          </button>
                        </th>

                        {/* Count — sortable */}
                        <th className="pb-3 font-medium w-32 text-right">
                          <button
                            onClick={() => handleSort('count')}
                            className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                          >
                            Reports
                            <SortIcon field="count" active={sortField} dir={sortDir} />
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredIssues.map((issue, idx) => {
                        // visual intensity: top item gets strongest badge
                        const rank = idx + 1;
                        const isTop3 = rank <= 3;
                        return (
                          <tr
                            key={issue.id}
                            className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                          >
                            {/* Rank badge */}
                            <td className="py-3 pr-3">
                              <span
                                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                                  isTop3
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                {rank}
                              </span>
                            </td>

                            {/* Issue title */}
                            <td className="py-3 pr-4 font-medium leading-snug max-w-xs">
                              {issue.title}
                            </td>

                            {/* Count */}
                            <td className="py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {/* Mini progress bar */}
                                <div className="hidden sm:block w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-primary"
                                    style={{
                                      width: `${Math.round((issue.count / (topIssue?.count ?? 1)) * 100)}%`,
                                    }}
                                  />
                                </div>
                                <Badge
                                  variant={isTop3 ? 'destructive' : 'secondary'}
                                  className="tabular-nums"
                                >
                                  {issue.count}×
                                </Badge>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}