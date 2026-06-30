import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '../../components/ui/input';
import {
  Search, AlertCircle, ChevronRight, ArrowUpRight, X, Loader2, UserCheck
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { officerApi } from '../../api/services';
import type { Complaint } from '../../types/api';

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface Officer {
  id: number;
  full_name: string;
  email: string;
  role: string;
}

// ─── Escalate Modal ───────────────────────────────────────────────────────────

interface EscalateModalProps {
  complaint: Complaint;
  onClose: () => void;
  onSuccess: (complaintId: number) => void;
}

function EscalateModal({ complaint, onClose, onSuccess }: EscalateModalProps) {
  const [officers, setOfficers]         = useState<Officer[]>([]);
  const [selectedId, setSelectedId]     = useState<number | null>(null);
  const [loading, setLoading]           = useState(true);
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [search, setSearch]             = useState('');

  // Fetch all officers on mount
  useEffect(() => {
    officerApi.getAllOfficers()
      .then(res => {
        setOfficers(res.data?.officers ?? []);
      })
      .catch(() => setError('Failed to load officers list.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = officers.filter(o =>
    o.full_name.toLowerCase().includes(search.toLowerCase()) ||
    o.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleEscalate = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    setError(null);
    try {
      // Mark complaint as in_progress to signal escalation/assignment
      // TODO: replace with a dedicated assign endpoint when available:
      // await officerApi.assignComplaint(complaint.id, selectedId)
      await officerApi.updateComplaintStatus(complaint.id, 'in_progress');
      onSuccess(complaint.id);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to escalate complaint.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <ArrowUpRight size={16} className="text-blue-500" />
              Escalate Complaint
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">
              #{complaint.id} — {complaint.problem}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Select an officer to escalate this complaint to. They will be notified to take over.
          </p>

          {/* Search officers */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm border-slate-200 dark:border-slate-700"
            />
          </div>

          {/* Officers list */}
          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={20} className="animate-spin text-slate-400" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">
                {search ? `No officers match "${search}".` : 'No officers available.'}
              </div>
            ) : (
              filtered.map(officer => (
                <button
                  key={officer.id}
                  onClick={() => setSelectedId(officer.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                    selectedId === officer.id
                      ? 'bg-blue-50 dark:bg-blue-950/40'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  )}
                >
                  {/* Avatar */}
                  <div className={cn(
                    'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    selectedId === officer.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  )}>
                    {officer.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-sm font-semibold truncate',
                      selectedId === officer.id
                        ? 'text-blue-700 dark:text-blue-400'
                        : 'text-slate-800 dark:text-slate-200'
                    )}>
                      {officer.full_name}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{officer.email}</p>
                  </div>
                  {selectedId === officer.id && (
                    <UserCheck size={15} className="text-blue-600 flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 px-3 py-2 text-xs text-rose-700 dark:text-rose-400">
              <AlertCircle size={13} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleEscalate}
            disabled={!selectedId || submitting || loading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2"
          >
            {submitting && <Loader2 size={13} className="animate-spin" />}
            <ArrowUpRight size={13} />
            Escalate
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OfficerDashboard() {
  const [filter, setFilter]         = useState('all');
  const [search, setSearch]         = useState('');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [categories, setCategories] = useState<BackendCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'all'>('all');
  const [stats, setStats]           = useState<DashboardStats | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  // Escalation modal state
  const [escalateTarget, setEscalateTarget] = useState<Complaint | null>(null);
  const [escalateSuccessId, setEscalateSuccessId] = useState<number | null>(null);

  // ── Fetch complaints + stats; category list is derived from the officer's
  // own assigned complaints (via Category join), not the global category list ──
  useEffect(() => {
    setLoading(true);
    setError(null);

    const categoryParam = selectedCategoryId === 'all' ? undefined : selectedCategoryId;

    Promise.all([
      officerApi.getComplaints(categoryParam),
      officerApi.getDashboard(categoryParam),
    ])
      .then(([complaintsRes, dashboardRes]) => {
        const fetchedComplaints: Complaint[] = complaintsRes.data.complaints || [];
        setComplaints(fetchedComplaints);

        // Derive the officer's assigned categories from the complaints'
        // own Category info — only when viewing "all" so we capture every
        // category the officer actually has access to.
        if (selectedCategoryId === 'all') {
          const seen = new Map<number, BackendCategory>();
          fetchedComplaints.forEach((c: any) => {
            const cat = c.Category;
            if (cat?.id && !seen.has(cat.id)) {
              seen.set(cat.id, { id: cat.id, name: cat.name });
            } else if (c.category_id && !seen.has(c.category_id) && cat?.name) {
              seen.set(c.category_id, { id: c.category_id, name: cat.name });
            }
          });
          if (seen.size > 0) {
            setCategories(Array.from(seen.values()));
          }
        }

        if (dashboardRes.data.success) {
          setStats(dashboardRes.data.data);
        }
      })
      .catch(err => {
        setError(err.response?.data?.error || 'Failed to load officer dashboard data.');
      })
      .finally(() => setLoading(false));
  }, [selectedCategoryId]);

  // ── Escalation success handler ───────────────────────────────────────────
  const handleEscalateSuccess = (complaintId: number) => {
    // Optimistically update the complaint status to in_progress in the list
    setComplaints(prev =>
      prev.map(c => c.id === complaintId ? { ...c, status: 'in_progress' } : c)
    );
    setEscalateSuccessId(complaintId);
    setEscalateTarget(null);
    // Clear the success flash after 3s
    setTimeout(() => setEscalateSuccessId(null), 3000);
  };

  // ── Client-side filters ──────────────────────────────────────────────────
  const filtered = complaints.filter(c => {
    const matchStatus = filter === 'all' || c.status === filter;
    const matchSearch = !search ||
      c.problem.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toString().includes(search);

    const complaintDate = c.created_at ? new Date(c.created_at) : null;
    const hasValidDate  = complaintDate && !Number.isNaN(complaintDate.getTime());
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to   = dateTo   ? new Date(`${dateTo}T23:59:59`)   : null;
    const matchDate = !hasValidDate || (
      (!from || complaintDate! >= from) &&
      (!to   || complaintDate! <= to)
    );

    return matchStatus && matchSearch && matchDate;
  });

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* Escalate Modal */}
      {escalateTarget && (
        <EscalateModal
          complaint={escalateTarget}
          onClose={() => setEscalateTarget(null)}
          onSuccess={handleEscalateSuccess}
        />
      )}

      <div className="space-y-8 animate-in">
        {/* Header */}
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
                onChange={e => {
                  const val = e.target.value;
                  setSelectedCategoryId(val === 'all' ? 'all' : parseInt(val, 10));
                }}
                className="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm focus:ring-2 focus:ring-blue-600 outline-none text-slate-800 dark:text-slate-200 font-semibold"
              >
                <option value="all">All Categories</option>
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
            { label: 'Open Complaints',     value: stats?.openComplaints    ?? 0,      color: 'text-amber-500',   bar: 'bg-amber-500'  },
            { label: 'Resolved This Month', value: stats?.resolvedThisMonth ?? 0,      color: 'text-emerald-500', bar: 'bg-emerald-500'},
            { label: 'Avg Resolution Time', value: stats?.avgResolutionTime ?? '0d',   color: 'text-blue-500',    bar: 'bg-blue-500'   },
            { label: 'SLA Compliance',      value: stats?.slaCompliance     ?? '100%', color: 'text-indigo-500',  bar: 'bg-indigo-500' },
          ].map((s, i) => (
            <Card key={i} className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className={cn('w-1.5 h-12 rounded-full', s.bar)} />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</p>
                  {loading
                    ? <Skeleton className="h-8 w-16 mt-1" />
                    : <h3 className={cn('text-2xl font-bold mt-0.5', s.color)}>{s.value}</h3>
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

        {/* Escalation success flash */}
        {escalateSuccessId && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900">
            <UserCheck className="text-emerald-600" size={18} />
            <p className="text-emerald-700 dark:text-emerald-400 font-medium text-sm">
              Complaint #{escalateSuccessId} escalated successfully.
            </p>
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
                    onClick={() => { setDateFrom(''); setDateTo(''); }}
                    className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    Clear
                  </Button>
                )}
              </div>
              {['all', 'pending', 'in_progress', 'resolved', 'appealed'].map(t => (
                <Button
                  key={t}
                  variant={filter === t ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter(t)}
                  className={cn(
                    'capitalize font-bold text-xs',
                    filter === t
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  )}
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
                    <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading
                    ? [1, 2, 3, 4].map(i => (
                        <tr key={i}>
                          <td colSpan={7} className="p-4">
                            <Skeleton className="h-10 w-full" />
                          </td>
                        </tr>
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
                          const isEscalatable = c.status === 'pending' || c.status === 'in_progress';
                          const justEscalated = escalateSuccessId === c.id;

                          return (
                            <tr
                              key={c.id}
                              className={cn(
                                'hover:bg-slate-50 dark:hover:bg-slate-800/10 transition-colors group',
                                justEscalated && 'bg-emerald-50/50 dark:bg-emerald-950/10'
                              )}
                            >
                              <td className="p-4 font-mono font-bold text-xs text-slate-500">
                                #{c.id}
                              </td>
                              <td className="p-4">
                                <Badge className={cn('font-bold px-2.5 py-0.5 text-[10px] uppercase tracking-wider border', p.color)}>
                                  {p.label}
                                </Badge>
                              </td>
                              <td className="p-4 max-w-xs">
                                <p className="font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-600 transition-colors">
                                  {c.problem}
                                </p>
                                {c.location && (
                                  <p className="text-xs text-slate-400 mt-0.5">{c.location}</p>
                                )}
                              </td>
                              <td className="p-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
                                {c.student_name || c.User?.full_name || 'Anonymous Student'}
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <div className={cn('w-1.5 h-1.5 rounded-full animate-pulse', statusDotColor[c.status] ?? 'bg-slate-400')} />
                                  <span className="text-xs font-bold capitalize text-slate-700 dark:text-slate-300">
                                    {c.status === 'in_progress' ? 'In Progress' : c.status}
                                  </span>
                                </div>
                              </td>
                              <td className="p-4 text-xs font-medium text-slate-500">
                                {new Date(c.created_at).toLocaleDateString()}
                              </td>
                              <td className="p-4">
                                <div className="flex items-center justify-end gap-2">
                                  {/* Escalate button — only for actionable statuses */}
                                  {isEscalatable && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setEscalateTarget(c)}
                                      className="font-bold text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20 gap-1"
                                    >
                                      <ArrowUpRight size={13} />
                                      Escalate
                                    </Button>
                                  )}
                                  <Link to={`/officer/complaints/${c.id}`}>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="font-bold text-blue-650 hover:text-blue-700 hover:bg-blue-50/50 gap-1"
                                    >
                                      Review <ChevronRight size={14} />
                                    </Button>
                                  </Link>
                                </div>
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
    </>
  );
}