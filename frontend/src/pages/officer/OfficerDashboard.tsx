import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '../../components/ui/input';
import {
  Search, AlertCircle, CheckCircle2, Clock, ChevronRight, Brain, Filter, ShieldAlert
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { officerApi, studentApi } from '../../api/services';
import type { Complaint } from '../../types/api';

const priorityMap: Record<number, { label: string; color: string }> = {
  5: { label: 'Critical', color: 'bg-rose-500/15 text-rose-500 border-rose-500/20 dark:text-rose-400' },
  4: { label: 'High',     color: 'bg-orange-500/15 text-orange-500 border-orange-500/20 dark:text-orange-400' },
  3: { label: 'Medium',   color: 'bg-blue-500/15 text-blue-500 border-blue-500/20 dark:text-blue-400' },
  2: { label: 'Low',      color: 'bg-slate-500/15 text-slate-500 border-slate-500/20 dark:text-slate-400' },
  1: { label: 'Info',     color: 'bg-slate-400/15 text-slate-400 border-slate-400/20 dark:text-slate-300' },
};

const statusDotColor: Record<string, string> = {
  pending:     'bg-amber-500',
  in_progress: 'bg-blue-500',
  resolved:    'bg-emerald-500',
  appealed:    'bg-orange-500',
};

interface BackendCategory {
  id: number;
  name: string;
}

interface DashboardStats {
  openComplaints: number;
  resolvedThisMonth: number;
  avgResolutionTime: string;
  slaCompliance: string;
}

export default function OfficerDashboard() {
  const [filter, setFilter]         = useState('all');
  const [search, setSearch]         = useState('');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [categories, setCategories] = useState<BackendCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(1);
  const [stats, setStats]           = useState<DashboardStats | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);


  // Fetch Categories on Mount
  useEffect(() => {
    studentApi.getCategories()
      .then(res => {
        const cats = res.data.categories || [];
        setCategories(cats);
        if (cats.length > 0) {
          // If category 1 is in the list, keep it, otherwise default to the first category
          const hasCat1 = cats.some((c: any) => c.id === 1);
          if (!hasCat1) {
            setSelectedCategoryId(cats[0].id);
          }
        }
      })
      .catch(err => {
        console.error('Failed to load categories', err);
      });
  }, []);

  // Fetch Complaints and Stats when Selected Category changes
  useEffect(() => {
    setLoading(true);
    setError(null);
    
    Promise.all([
      officerApi.getComplaints(selectedCategoryId),
      officerApi.getDashboard(selectedCategoryId)
    ])
      .then(([complaintsRes, dashboardRes]) => {
        setComplaints(complaintsRes.data.complaints || []);
        if (dashboardRes.data.success) {
          console.log('Dashboard data:', dashboardRes.data.data);
          setStats(dashboardRes.data.data);
        }
      })
      .catch(err => {
        console.error(err);
        setError(err.response?.data?.error || 'Failed to load officer dashboard data.');
      })
      .finally(() => setLoading(false));
  }, [selectedCategoryId]);

  const filtered = complaints.filter(c => {
    const matchStatus = filter === 'all' || c.status === filter;
    const matchSearch = !search || c.problem.toLowerCase().includes(search.toLowerCase()) || c.id.toString().includes(search);

    const complaintDate = c.created_at ? new Date(c.created_at) : null;
    const hasValidComplaintDate = complaintDate && !Number.isNaN(complaintDate.getTime());

    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

    const matchDate = !hasValidComplaintDate || (
      (!from || complaintDate! >= from) &&
      (!to || complaintDate! <= to)
    );

    return matchStatus && matchSearch && matchDate;
  });

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Officer Inbox</h1>
          <p className="text-slate-500 font-medium">Complaints assigned to your department</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Department:</span>
            <select
              value={selectedCategoryId}
              onChange={e => setSelectedCategoryId(parseInt(e.target.value, 10))}
              className="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm focus:ring-2 focus:ring-blue-600 outline-none text-slate-800 dark:text-slate-200 font-semibold"
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

        
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Open Complaints', value: stats?.openComplaints ?? 0,         color: 'text-amber-500',   bg: 'bg-amber-500/10' },
          { label: 'Resolved This Month',     value: stats?.resolvedThisMonth ?? 0,     color: 'text-emerald-500',   bg: 'bg-emerald-500/10' },
          { label: 'Avg Resolution Time', value: stats?.avgResolutionTime ?? '0d', color: 'text-blue-500',    bg: 'bg-blue-500/10' },
          { label: 'SLA Compliance',    value: stats?.slaCompliance ?? '100%',    color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
        ].map((s, i) => (
          <Card key={i} className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 shadow-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={cn("w-1.5 h-12 rounded-full", i === 0 ? "bg-amber-500" : i === 1 ? "bg-emerald-500" : i === 2 ? "bg-blue-500" : "bg-indigo-500")} />
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</p>
                {loading
                  ? <Skeleton className="h-8 w-16 mt-1" />
                  : <h3 className={cn("text-2xl font-bold mt-0.5", s.color)}>{s.value}</h3>
                }
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900">
          <AlertCircle className="text-rose-600" size={18} />
          <p className="text-rose-700 dark:text-rose-400 font-medium text-sm">{error}</p>
        </div>
      )}

      {/* Table card */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white/50 dark:bg-slate-900/30 backdrop-blur-xl">
        {/* Toolbar */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <Input
              placeholder="Search complaints by ID or text..."
              className="pl-10 h-10 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="h-10 w-36 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                aria-label="Filter from date"
              />
              <span className="text-xs text-slate-400">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="h-10 w-36 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                aria-label="Filter to date"
              />
              {(dateFrom || dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDateFrom('');
                    setDateTo('');
                  }}
                  className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  Clear
                </Button>
              )}
            </div>
            {['all', 'pending', 'in_progress', 'resolved', 'appealed'].map(t => (
              <Button
                key={t}
                id={`filter-${t}`}
                variant={filter === t ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFilter(t)}
                className={cn("capitalize font-bold text-xs", filter === t ? "bg-blue-600 hover:bg-blue-700 text-white" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200")}
              >
                {t === 'in_progress' ? 'In Progress' : t}
              </Button>
            ))}
          </div>
        </div>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Priority</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Problem</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Student</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Submitted</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading
                  ? [1,2,3,4].map(i => (
                    <tr key={i}><td colSpan={7} className="p-4"><Skeleton className="h-10 w-full" /></td></tr>
                  ))
                  : filtered.length === 0
                    ? (
                      <tr>
                        <td colSpan={7} className="p-10 text-center text-slate-400">
                          No complaints found
                        </td>
                      </tr>
                    )
                    : filtered.map(c => {
                      const p = priorityMap[c.priority ?? 3] ?? priorityMap[3];
                      return (
                        <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/10 transition-colors group">
                          <td className="p-4 font-mono font-bold text-xs text-slate-500">
                            #{c.id}
                          </td>
                          <td className="p-4">
                            <Badge className={cn("font-bold px-2.5 py-0.5 text-[10px] uppercase tracking-wider border", p.color)}>
                              {p.label}
                            </Badge>
                          </td>
                          <td className="p-4 max-w-xs">
                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-600 transition-colors">
                              {c.problem}
                            </p>
                            {c.location && <p className="text-xs text-slate-400 mt-0.5">{c.location}</p>}
                          </td>
                          <td className="p-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {c.student_name || c.User?.full_name || 'Anonymous Student'}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", statusDotColor[c.status] ?? 'bg-slate-400')} />
                              <span className="text-xs font-bold capitalize text-slate-700 dark:text-slate-300">
                                {c.status === 'in_progress' ? 'In Progress' : c.status}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 text-xs font-medium text-slate-500">
                            {new Date(c.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-4 text-right">
                            <Link to={`/officer/complaints/${c.id}`}>
                              <Button variant="ghost" size="sm" className="font-bold text-blue-650 hover:text-blue-700 hover:bg-blue-50/50">
                                Review <ChevronRight size={14} className="ml-1" />
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                }
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
