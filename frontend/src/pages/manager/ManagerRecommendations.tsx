import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Sparkles, Brain, CheckCircle2, XCircle, TrendingUp,
  Lightbulb, AlertTriangle, Clock, RefreshCw, MapPin,
  Hash, BarChart2, ChevronDown
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useRecommendationStore } from '../../store/recommendationStore';
import type { Recommendation } from '../../types/recommendation';

// ── Toast helper ──────────────────────────────────────────────────────────
function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={cn(
      "fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-white font-bold text-sm animate-in slide-in-from-bottom-4",
      type === 'success' ? "bg-emerald-600" : "bg-rose-600"
    )}>
      {type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
      {message}
    </div>
  );
}

// ── Status badge config ───────────────────────────────────────────────────
const urgencyConfig: Record<string, { label: string; color: string }> = {
  high:   { label: 'High Urgency',   color: 'bg-rose-500 text-white' },
  medium: { label: 'Med Urgency',    color: 'bg-orange-500 text-white' },
  low:    { label: 'Low Urgency',    color: 'bg-blue-500 text-white' },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  pending:     { label: 'Pending',     color: 'bg-amber-500/15 text-amber-600 border-amber-500/20' },
  implemented: { label: 'Implemented', color: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20' },
  ignored:     { label: 'Ignored',     color: 'bg-slate-500/15 text-slate-500 border-slate-500/20' },
};

// ── Skeleton card ─────────────────────────────────────────────────────────
function RecSkeleton() {
  return (
    <Card className="overflow-hidden border-none shadow-lg bg-white dark:bg-slate-800">
      <div className="flex flex-col lg:flex-row">
        <div className="p-8 flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-5 w-32 rounded-full" />
          </div>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-4 pt-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
        <div className="lg:w-80 p-8 space-y-3">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </Card>
  );
}

// ── Recommendation card ───────────────────────────────────────────────────
interface RecCardProps {
  rec: Recommendation;
  onUpdateStatus: (id: number, status: 'implemented' | 'ignored') => void;
  updating: number | null;
}

function RecCard({ rec, onUpdateStatus, updating }: RecCardProps) {
  const urgency = urgencyConfig[rec.urgency ?? 'low'] ?? urgencyConfig.low;
  const status  = statusConfig[rec.status   ?? 'pending'] ?? statusConfig.pending;

  return (
    <Card className="overflow-hidden border-none shadow-lg shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-800">
      <div className="flex flex-col lg:flex-row">
        {/* ── Main content ── */}
        <div className="p-8 flex-1 space-y-6">
          {/* Header row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn("font-bold px-3 py-1 text-[10px] uppercase tracking-widest", urgency.color)}>
                {urgency.label}
              </Badge>
              <Badge className={cn("font-bold px-3 py-1 text-[10px] uppercase tracking-widest border", status.color)}>
                {status.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
              <Brain size={14} />
              {rec.category_name ?? `Category #${rec.category_id}`}
            </div>
          </div>

          {/* Pattern */}
          {rec.pattern_detected && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2">
                <TrendingUp size={14} /> Detected Pattern
              </p>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white leading-tight">
                {rec.pattern_detected}
              </h3>
            </div>
          )}

          {/* Recommendation box */}
          {rec.recommendation && (
            <div className="p-5 rounded-2xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/50">
              <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Lightbulb size={14} /> Proposed Recommendation
              </p>
              <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                {rec.recommendation}
              </p>
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {rec.complaint_count != null && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <Hash size={10} /> Complaints
                </p>
                <p className="font-bold text-slate-800 dark:text-slate-100">{rec.complaint_count}</p>
              </div>
            )}
            {rec.avg_resolution_h != null && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <Clock size={10} /> Avg. Resolution
                </p>
                <p className="font-bold text-slate-800 dark:text-slate-100">{rec.avg_resolution_h}h</p>
              </div>
            )}
            {rec.appeal_rate_pct != null && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <BarChart2 size={10} /> Appeal Rate
                </p>
                <p className="font-bold text-slate-800 dark:text-slate-100">{rec.appeal_rate_pct}%</p>
              </div>
            )}
            {rec.location && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <MapPin size={10} /> Location
                </p>
                <p className="font-bold text-slate-800 dark:text-slate-100 truncate text-sm">{rec.location}</p>
              </div>
            )}
          </div>

          {/* Root cause / impact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t dark:border-slate-700">
            {rec.root_cause && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Root Cause</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 italic">"{rec.root_cause}"</p>
              </div>
            )}
            {rec.estimated_impact && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Projected Impact</p>
                <p className="text-sm font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 size={14} /> {rec.estimated_impact}
                </p>
              </div>
            )}
          </div>

          {/* Keywords */}
          {rec.top_keywords && (
            <div className="flex flex-wrap gap-2">
              {rec.top_keywords.split(',').map((kw, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  {kw.trim()}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Action sidebar ── */}
        <div className="lg:w-72 bg-slate-50 dark:bg-slate-900/30 p-8 flex flex-col justify-center gap-4 border-l dark:border-slate-700">
          {rec.status !== 'implemented' && (
            <Button
              id={`implement-btn-${rec.id}`}
              disabled={updating === rec.id}
              onClick={() => onUpdateStatus(rec.id, 'implemented')}
              className="w-full h-12 gap-2 font-bold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20"
            >
              <CheckCircle2 size={18} />
              {updating === rec.id ? 'Updating…' : 'Mark Implemented'}
            </Button>
          )}
          {rec.status !== 'ignored' && rec.status !== 'implemented' && (
            <Button
              id={`ignore-btn-${rec.id}`}
              variant="outline"
              disabled={updating === rec.id}
              onClick={() => onUpdateStatus(rec.id, 'ignored')}
              className="w-full h-12 gap-2 font-bold border-slate-200 dark:border-slate-700"
            >
              <XCircle size={18} /> Ignore
            </Button>
          )}
          {rec.generated_at && (
            <p className="text-[10px] text-slate-400 text-center">
              Generated: {new Date(rec.generated_at).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
const STATUS_FILTERS = ['all', 'pending', 'implemented', 'ignored'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

export default function ManagerRecommendations() {
  const {
    recommendations, loading, generating, error,
    lastGeneratedTime, fetchRecommendations, updateStatus, checkAndAutoGenerate,
  } = useRecommendationStore();

  const [statusFilter, setStatusFilter]     = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<number | undefined>();
  const [updating, setUpdating]             = useState<number | null>(null);
  const [toast, setToast]                   = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // ── Auto-generate on mount ────────────────────────────────────────────
  useEffect(() => {
    checkAndAutoGenerate();
  }, []);

  // ── Apply filters whenever they change ───────────────────────────────
  useEffect(() => {
    fetchRecommendations({
      status: statusFilter !== 'all' ? statusFilter : undefined,
      category_id: categoryFilter,
    });
  }, [statusFilter, categoryFilter]);

  // ── Collect unique categories from loaded recs ───────────────────────
  const categories = React.useMemo(() => {
    const seen = new Map<number, string>();
    recommendations.forEach(r => {
      if (!seen.has(r.category_id)) seen.set(r.category_id, r.category_name ?? `Category #${r.category_id}`);
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [recommendations]);

  // ── Handle status update ─────────────────────────────────────────────
  const handleUpdate = useCallback(async (id: number, status: 'implemented' | 'ignored') => {
    setUpdating(id);
    try {
      await updateStatus(id, status);
      showToast(`Recommendation marked as ${status}!`, 'success');
    } catch {
      showToast('Failed to update. Please try again.', 'error');
    } finally {
      setUpdating(null);
    }
  }, [updateStatus]);

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Last gen time label ───────────────────────────────────────────────
  const lastGenLabel = lastGeneratedTime
    ? new Date(lastGeneratedTime).toLocaleString()
    : 'Never';

  return (
    <div className="space-y-8 animate-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="text-blue-600" size={24} />
            <h1 className="text-3xl font-bold">AI Recommendations</h1>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-slate-500 font-medium">Data-driven suggestions to improve university services</p>
            {generating && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full">
                <RefreshCw size={12} className="animate-spin" /> Generating…
              </span>
            )}
          </div>
        </div>
        <div className="text-right hidden md:block">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last Generated</p>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-400">{lastGenLabel}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Status filter */}
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map(s => (
            <Button
              key={s}
              id={`status-filter-${s}`}
              size="sm"
              variant={statusFilter === s ? 'default' : 'outline'}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "capitalize font-bold h-9",
                statusFilter === s && "bg-blue-600 hover:bg-blue-700"
              )}
            >
              {s}
            </Button>
          ))}
        </div>

        {/* Category filter */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              id="category-filter-select"
              value={categoryFilter ?? ''}
              onChange={e => setCategoryFilter(e.target.value ? Number(e.target.value) : undefined)}
              className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && !loading && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900">
          <AlertTriangle className="text-rose-600 shrink-0" size={20} />
          <p className="text-rose-700 dark:text-rose-400 font-medium text-sm">{error}</p>
          <Button size="sm" variant="outline" onClick={() => fetchRecommendations()} className="ml-auto">
            Retry
          </Button>
        </div>
      )}

      {/* Loading skeletons */}
      {(loading || generating) && (
        <div className="grid grid-cols-1 gap-8">
          {[1, 2, 3].map(i => <RecSkeleton key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && !generating && !error && recommendations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-3xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-6">
            <Brain size={40} className="text-blue-400" />
          </div>
          <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">No recommendations found</h3>
          <p className="text-slate-500 font-medium max-w-sm">
            {statusFilter !== 'all'
              ? `No ${statusFilter} recommendations. Try changing the filter.`
              : 'Recommendations will appear after the first auto-generation cycle (every 48 hours).'}
          </p>
        </div>
      )}

      {/* Recommendation cards */}
      {!loading && !generating && recommendations.length > 0 && (
        <div className="grid grid-cols-1 gap-8">
          <AnimatePresence>
            {recommendations.map((rec, i) => (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: i * 0.07 }}
              >
                <RecCard rec={rec} onUpdateStatus={handleUpdate} updating={updating} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <Toast message={toast.msg} type={toast.type} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
