import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { Input } from '../../components/ui/input';
import {
  Download, Filter, FileText, Calendar, Building,
  CheckCircle2, AlertCircle, Search, ChevronDown
} from 'lucide-react';
import { managerApi } from '../../api/services';
import { adminApi } from '../../api/services';
import type { Complaint, Category } from '../../types/api';
import { cn } from '../../lib/utils';

const STATUS_OPTIONS = ['', 'pending', 'in_progress', 'resolved', 'appealed'];

export default function ManagerReports() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  // Filters
  const [from, setFrom]             = useState('');
  const [to, setTo]                 = useState('');
  const [status, setStatus]         = useState('');
  const [categoryId, setCategoryId] = useState('');

  const fetchReports = () => {
    setLoading(true);
    setError(null);
    managerApi.getReports({
      from: from || undefined,
      to: to || undefined,
      status: status || undefined,
      category_id: categoryId ? Number(categoryId) : undefined,
    })
      .then(res => {
        setComplaints(res.data.complaints ?? []);
        setTotal(res.data.total_count ?? 0);
      })
      .catch(err => setError(err.message || 'Failed to load reports'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // Load categories for filter dropdown
    adminApi.getCategories()
      .then(res => setCategories(res.data.categories ?? []))
      .catch(() => {});
    fetchReports();
  }, []);

  const statusColor: Record<string, string> = {
    pending:     'bg-amber-500/15 text-amber-600',
    in_progress: 'bg-blue-500/15 text-blue-600',
    resolved:    'bg-emerald-500/15 text-emerald-600',
    appealed:    'bg-orange-500/15 text-orange-600',
  };

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Complaints Report</h1>
          <p className="text-slate-500 font-medium">Filter and analyze complaint data across all departments</p>
        </div>
        <Badge variant="outline" className="h-9 px-4 text-sm font-bold self-start md:self-auto">
          {total} total results
        </Badge>
      </div>

      {/* Filters */}
      <Card className="border-none shadow-sm">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Calendar size={12} /> From
              </label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Calendar size={12} /> To
              </label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Building size={12} /> Category
              </label>
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="h-10 w-full px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Filter size={12} /> Status
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="h-10 w-full px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s ? s.replace('_', ' ') : 'All Status'}</option>
                ))}
              </select>
            </div>
          </div>
          <Button onClick={fetchReports} className="gap-2 bg-blue-600 hover:bg-blue-700 font-bold">
            <Search size={16} /> Apply Filters
          </Button>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200">
          <AlertCircle className="text-rose-600" size={18} />
          <p className="text-rose-700 font-medium text-sm">{error}</p>
        </div>
      )}

      {/* Table */}
      <Card className="border-none shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30">
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Problem</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Priority</th>
                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {loading
                ? [1,2,3,4,5].map(i => (
                  <tr key={i}><td colSpan={6} className="p-4"><Skeleton className="h-8 w-full" /></td></tr>
                ))
                : complaints.length === 0
                  ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-slate-400">
                        <FileText size={40} className="mx-auto mb-3 text-slate-300" />
                        <p className="font-medium">No complaints match the selected filters.</p>
                      </td>
                    </tr>
                  )
                  : complaints.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-4 font-mono text-sm font-bold text-slate-500">#{c.id}</td>
                      <td className="p-4 max-w-xs">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{c.problem}</p>
                      </td>
                      <td className="p-4 text-sm text-slate-600 dark:text-slate-400">{c.Category?.name ?? '—'}</td>
                      <td className="p-4">
                        <Badge className={cn("font-bold text-[10px] uppercase tracking-wider", statusColor[c.status] ?? '')}>
                          {c.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-600 dark:text-slate-400">{c.priority ?? '—'}</td>
                      <td className="p-4 text-xs font-medium text-slate-500">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
