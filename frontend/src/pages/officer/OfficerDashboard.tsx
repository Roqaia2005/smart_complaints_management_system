import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '../../components/ui/input';
import {
  Search, AlertCircle, CheckCircle2, Clock, ChevronRight, Brain
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { officerApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import type { Complaint } from '../../types/api';

const priorityMap: Record<number, { label: string; color: string }> = {
  5: { label: 'Critical', color: 'bg-rose-500 text-white' },
  4: { label: 'High',     color: 'bg-orange-500 text-white' },
  3: { label: 'Medium',   color: 'bg-blue-500 text-white' },
  2: { label: 'Low',      color: 'bg-slate-500 text-white' },
  1: { label: 'Info',     color: 'bg-slate-400 text-white' },
};

const statusDotColor: Record<string, string> = {
  pending:     'bg-amber-500',
  in_progress: 'bg-blue-500',
  resolved:    'bg-emerald-500',
  appealed:    'bg-orange-500',
};

export default function OfficerDashboard() {
  const [filter, setFilter]         = useState('all');
  const [search, setSearch]         = useState('');
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  // The officer's category_id - in a real app this comes from the auth token/profile
  // Here we use 1 as a sensible default; the backend requires category_id
  const CATEGORY_ID = 1;

  useEffect(() => {
    officerApi.getComplaints(CATEGORY_ID)
      .then(res => setComplaints(res.data.complaints ?? res.data ?? []))
      .catch(err => setError(err.response?.data?.error ?? err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = complaints.filter(c => {
    const matchStatus = filter === 'all' || c.status === filter;
    const matchSearch = !search || c.problem.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const counts = {
    all:         complaints.length,
    pending:     complaints.filter(c => c.status === 'pending').length,
    in_progress: complaints.filter(c => c.status === 'in_progress').length,
    resolved:    complaints.filter(c => c.status === 'resolved').length,
  };

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Officer Inbox</h1>
          <p className="text-slate-500 font-medium">Complaints assigned to your department</p>
        </div>
        <Badge variant="outline" className="h-9 px-4 gap-2 border-blue-200 text-blue-700 bg-blue-50 dark:bg-blue-900/20">
          <Brain size={16} /> AI Sorting Active
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total',       value: counts.all,         color: 'text-slate-500',   bg: 'bg-slate-500/10' },
          { label: 'Pending',     value: counts.pending,     color: 'text-amber-500',   bg: 'bg-amber-500/10' },
          { label: 'In Progress', value: counts.in_progress, color: 'text-blue-500',    bg: 'bg-blue-500/10' },
          { label: 'Resolved',    value: counts.resolved,    color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        ].map((s, i) => (
          <Card key={i} className="border-none shadow-sm">
            <CardContent className="p-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{s.label}</p>
              {loading
                ? <Skeleton className="h-8 w-16 mt-1" />
                : <h3 className={cn("text-2xl font-bold mt-1", s.color)}>{s.value}</h3>
              }
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200">
          <AlertCircle className="text-rose-600" size={18} />
          <p className="text-rose-700 font-medium text-sm">{error}</p>
        </div>
      )}

      {/* Table card */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-800 flex flex-col md:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <Input
              placeholder="Search complaints..."
              className="pl-10 h-10 border-slate-200 dark:border-slate-800"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {['all', 'pending', 'in_progress', 'resolved', 'appealed'].map(t => (
              <Button
                key={t}
                id={`filter-${t}`}
                variant={filter === t ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFilter(t)}
                className={cn("capitalize font-bold", filter === t && "bg-blue-600 hover:bg-blue-700")}
              >
                {t.replace('_', ' ')}
              </Button>
            ))}
          </div>
        </div>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30">
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Priority</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Problem</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Submitted</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {loading
                  ? [1,2,3,4].map(i => (
                    <tr key={i}><td colSpan={6} className="p-4"><Skeleton className="h-10 w-full" /></td></tr>
                  ))
                  : filtered.length === 0
                    ? (
                      <tr>
                        <td colSpan={6} className="p-10 text-center text-slate-400">
                          No complaints found
                        </td>
                      </tr>
                    )
                    : filtered.map(c => {
                      const p = priorityMap[c.priority ?? 3] ?? priorityMap[3];
                      return (
                        <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                          <td className="p-4">
                            <Badge className={cn("font-bold px-2.5 py-0.5 text-[10px] uppercase tracking-wider", p.color)}>
                              {p.label}
                            </Badge>
                          </td>
                          <td className="p-4 max-w-xs">
                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-600 transition-colors">
                              {c.problem}
                            </p>
                            {c.location && <p className="text-xs text-slate-400">{c.location}</p>}
                          </td>
                          <td className="p-4 text-xs font-medium text-slate-600 dark:text-slate-400">
                            {c.Category?.name ?? '—'}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className={cn("w-1.5 h-1.5 rounded-full", statusDotColor[c.status] ?? 'bg-slate-400')} />
                              <span className="text-xs font-bold capitalize text-slate-700 dark:text-slate-300">
                                {c.status.replace('_', ' ')}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 text-xs font-medium text-slate-500">
                            {new Date(c.createdAt).toLocaleDateString()}
                          </td>
                          <td className="p-4 text-right">
                            <Link to={`/officer/complaints/${c.id}`}>
                              <Button variant="ghost" size="sm" className="font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50">
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
