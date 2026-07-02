import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Sparkles, Brain, CheckCircle2, XCircle, TrendingUp,
  Lightbulb, AlertTriangle, Clock, RefreshCw, MapPin,
  Hash, BarChart2, ChevronDown, Shield, Target, Zap,
  Activity, FileText, Search, Volume2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { useRecommendationStore } from '../../store/recommendationStore';
import recommendationService, {
  type DssBundle,
  type RiskRankingItem,
  type CategoryInsight,
  type SmartAlert,
  type RiskLevel,
} from '../../api/recommendationService';
import type { Recommendation } from '../../types/recommendation';
import { ExecutiveBriefingPanel } from '../../components/briefing';

// ── Config ────────────────────────────────────────────────────────────────

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

const RISK_STYLES: Record<RiskLevel, { badge: string; bar: string; text: string }> = {
  Low:    { badge: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20', bar: '#22c55e', text: 'text-emerald-600' },
  Medium: { badge: 'bg-amber-500/15 text-amber-600 border-amber-500/20',     bar: '#f59e0b', text: 'text-amber-600' },
  High:   { badge: 'bg-rose-500/15 text-rose-600 border-rose-500/20',         bar: '#ef4444', text: 'text-rose-600' },
};

const ALERT_STYLES: Record<string, string> = {
  high:   'border-rose-200 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-900/50',
  medium: 'border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-900/50',
  low:    'border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-900/50',
};

const RISK_BAR_COLORS = (level: RiskLevel) => RISK_STYLES[level]?.bar ?? '#94a3b8';

// ── Toast ─────────────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={cn(
      'fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-white font-bold text-sm animate-in slide-in-from-bottom-4',
      type === 'success' ? 'bg-emerald-600' : 'bg-rose-600',
    )}>
      {type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
      {message}
    </div>
  );
}

// ── Risk badge ────────────────────────────────────────────────────────────

function RiskBadge({ score, level }: { score: number; level: RiskLevel }) {
  const style = RISK_STYLES[level];
  return (
    <Badge className={cn('font-bold px-3 py-1 text-[10px] uppercase tracking-widest border', style.badge)}>
      <Shield size={10} className="mr-1 inline" />
      Risk {score} · {level}
    </Badge>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <Card className="border-none shadow-sm">
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-3">
          <div className={cn('p-2 rounded-xl', accent)}>
            <Icon size={18} />
          </div>
        </div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-2xl font-bold mt-1 text-slate-800 dark:text-white">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-1 font-medium">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ── DSS dashboard section ─────────────────────────────────────────────────

function DssDashboard({ bundle, loading }: { bundle: DssBundle | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }
  if (!bundle) return null;

  const { dashboard, executiveSummary, riskRanking } = bundle;
  const riskStyle = RISK_STYLES[dashboard.overall_risk_level];
  const resolvedPct = dashboard.total_complaints > 0
    ? Math.round((dashboard.resolved_complaints / dashboard.total_complaints) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Executive summary */}
      <Card className="border-none shadow-lg bg-gradient-to-br from-slate-900 to-slate-800 text-white overflow-hidden">
        <CardContent className="p-8">
          <div className="flex flex-col lg:flex-row lg:items-start gap-6">
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-blue-400" />
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Executive Summary</p>
              </div>
              <p className="text-lg font-medium leading-relaxed text-slate-200">{executiveSummary.summary}</p>
              {executiveSummary.key_findings.length > 0 && (
                <ul className="space-y-2 pt-2">
                  {executiveSummary.key_findings.map((finding, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <Target size={14} className="text-blue-400 shrink-0 mt-0.5" />
                      {finding}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="lg:w-48 shrink-0 text-center lg:text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Overall Risk</p>
              <p className={cn('text-5xl font-black', riskStyle.text.replace('text-', 'text-').replace('600', '400'))}>
                {dashboard.overall_risk_score}
              </p>
              <Badge className={cn('mt-2 font-bold border', riskStyle.badge)}>
                {dashboard.overall_risk_level}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          label="Total Complaints"
          value={dashboard.total_complaints}
          sub={`${dashboard.categories_analyzed} categories`}
          icon={Activity}
          accent="bg-blue-500/10 text-blue-500"
        />
        <KpiCard
          label="Unresolved"
          value={dashboard.unresolved_complaints}
          sub={`${100 - resolvedPct}% still open`}
          icon={Clock}
          accent="bg-amber-500/10 text-amber-500"
        />
        <KpiCard
          label="Resolved"
          value={dashboard.resolved_complaints}
          sub={`${resolvedPct}% resolved`}
          icon={CheckCircle2}
          accent="bg-emerald-500/10 text-emerald-500"
        />
        <KpiCard
          label="High Priority Open"
          value={dashboard.high_priority_unresolved}
          sub="Priority ≥ 4"
          icon={Zap}
          accent="bg-rose-500/10 text-rose-500"
        />
        <KpiCard
          label="Appeal Rate"
          value={`${dashboard.avg_appeal_rate_pct}%`}
          sub="Across all cases"
          icon={BarChart2}
          accent="bg-orange-500/10 text-orange-500"
        />
        <KpiCard
          label="Top Hotspot"
          value={dashboard.top_hotspot_location}
          sub="Most reported location"
          icon={MapPin}
          accent="bg-violet-500/10 text-violet-500"
        />
      </div>

      {/* Risk ranking chart */}
      {riskRanking.length > 0 && (
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <BarChart2 size={20} className="text-blue-600" />
                  Category Risk Ranking
                </h2>
                <p className="text-sm text-slate-500 font-medium">Operational risk by category (unresolved cases weighted)</p>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskRanking} layout="vertical" margin={{ left: 20, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-slate-200 dark:stroke-slate-700" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="category_name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload as RiskRankingItem;
                      return (
                        <div className="bg-white dark:bg-slate-800 border rounded-xl shadow-lg p-3 text-sm">
                          <p className="font-bold">{d.category_name}</p>
                          <p>Risk: {d.risk_score} ({d.risk_level})</p>
                          <p>Open: {d.unresolved_count} / {d.complaint_count}</p>
                          <p>Appeals: {d.appeal_rate_pct}%</p>
                          {d.hotspot_location && (
                            <p>Hotspot: {d.hotspot_location} ({d.hotspot_share_pct}%)</p>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="risk_score" radius={[0, 6, 6, 0]} barSize={18}>
                    {riskRanking.map((entry) => (
                      <Cell key={entry.category_id} fill={RISK_BAR_COLORS(entry.risk_level)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Compact ranking table */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b dark:border-slate-700">
                    <th className="pb-3 pr-4">#</th>
                    <th className="pb-3 pr-4">Category</th>
                    <th className="pb-3 pr-4">Risk</th>
                    <th className="pb-3 pr-4">Open</th>
                    <th className="pb-3 pr-4">Appeal %</th>
                    <th className="pb-3">Hotspot</th>
                  </tr>
                </thead>
                <tbody>
                  {riskRanking.map(row => (
                    <tr key={row.category_id} className="border-b dark:border-slate-800 last:border-0">
                      <td className="py-3 pr-4 font-bold text-slate-400">{row.rank}</td>
                      <td className="py-3 pr-4 font-bold text-slate-800 dark:text-slate-200">{row.category_name}</td>
                      <td className="py-3 pr-4">
                        <span className={cn('font-bold', RISK_STYLES[row.risk_level].text)}>
                          {row.risk_score} · {row.risk_level}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">
                        {row.unresolved_count}/{row.complaint_count}
                      </td>
                      <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">{row.appeal_rate_pct}%</td>
                      <td className="py-3 text-slate-600 dark:text-slate-400">
                        {row.hotspot_location
                          ? `${row.hotspot_location} (${row.hotspot_share_pct}%)`
                          : row.dominant_location}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Alerts panel ──────────────────────────────────────────────────────────

function AlertsPanel({ alerts }: { alerts: SmartAlert[] }) {
  if (alerts.length === 0) return null;

  return (
    <Card className="border-none shadow-sm">
      <CardContent className="p-6">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
          <AlertTriangle size={20} className="text-amber-500" />
          Smart Alerts
          <Badge className="bg-rose-500/15 text-rose-600 border-rose-500/20 text-[10px]">
            {alerts.filter(a => a.severity === 'high').length} high
          </Badge>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {alerts.map((alert, i) => (
            <div
              key={`${alert.category_id}-${alert.alert_type}-${i}`}
              className={cn(
                'flex items-start gap-3 p-4 rounded-xl border',
                ALERT_STYLES[alert.severity] ?? ALERT_STYLES.low,
              )}
            >
              <AlertTriangle
                size={16}
                className={cn(
                  'shrink-0 mt-0.5',
                  alert.severity === 'high' ? 'text-rose-600' : alert.severity === 'medium' ? 'text-amber-600' : 'text-blue-600',
                )}
              />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">
                  {alert.category_name} · {alert.alert_type.replace(/_/g, ' ')}
                </p>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{alert.message}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────

function RecSkeleton() {
  return (
    <Card className="overflow-hidden border-none shadow-lg bg-white dark:bg-slate-800">
      <div className="flex flex-col lg:flex-row">
        <div className="p-8 flex-1 space-y-4">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
        <div className="lg:w-80 p-8 space-y-3">
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </Card>
  );
}

// ── Recommendation card ───────────────────────────────────────────────────

interface RecCardProps {
  rec: Recommendation;
  risk?: RiskRankingItem;
  onUpdateStatus: (id: number, status: 'implemented' | 'ignored') => void;
  updating: number | null;
}

function RecCard({ rec, risk, onUpdateStatus, updating }: RecCardProps) {
  const urgency = urgencyConfig[rec.urgency ?? 'low'] ?? urgencyConfig.low;
  const status  = statusConfig[rec.status   ?? 'pending'] ?? statusConfig.pending;

  const [expanded, setExpanded] = useState(false);
  const [insight, setInsight] = useState<CategoryInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  const loadInsight = useCallback(async () => {
    if (insight || insightLoading) return;
    setInsightLoading(true);
    try {
      const data = await recommendationService.getCategoryInsight(rec.category_id);
      setInsight(data);
    } catch {
      setInsight(null);
    } finally {
      setInsightLoading(false);
    }
  }, [rec.category_id, insight, insightLoading]);

  const toggleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) loadInsight();
  };

  return (
    <Card className="overflow-hidden border-none shadow-lg shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-800">
      <div className="flex flex-col lg:flex-row">
        <div className="p-8 flex-1 space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn('font-bold px-3 py-1 text-[10px] uppercase tracking-widest', urgency.color)}>
                {urgency.label}
              </Badge>
              <Badge className={cn('font-bold px-3 py-1 text-[10px] uppercase tracking-widest border', status.color)}>
                {status.label}
              </Badge>
              {risk && <RiskBadge score={risk.risk_score} level={risk.risk_level} />}
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

          {/* Recommendation */}
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
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {rec.complaint_count != null && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <Hash size={10} /> Complaints
                </p>
                <p className="font-bold text-slate-800 dark:text-slate-100">{rec.complaint_count}</p>
              </div>
            )}
            {risk && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <Shield size={10} /> Open Cases
                </p>
                <p className="font-bold text-slate-800 dark:text-slate-100">
                  {risk.unresolved_count}
                </p>
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
                <p className={cn('font-bold', (rec.appeal_rate_pct ?? 0) >= 20 ? 'text-rose-600' : 'text-slate-800 dark:text-slate-100')}>
                  {rec.appeal_rate_pct}%
                </p>
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
              <div className="p-4 rounded-xl bg-violet-50/50 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-900/30">
                <p className="text-[10px] font-bold text-violet-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                  <Search size={12} /> Data-Confirmed Root Cause
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">{rec.root_cause}</p>
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

          {/* Expandable analytical insights */}
          <button
            type="button"
            onClick={toggleExpand}
            className="flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
          >
            <ChevronDown size={16} className={cn('transition-transform', expanded && 'rotate-180')} />
            {expanded ? 'Hide' : 'Show'} analytical insights
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border dark:border-slate-700 space-y-4">
                  {insightLoading && (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  )}
                  {!insightLoading && insight && (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Risk Score</p>
                          <p className={cn('font-bold text-lg', RISK_STYLES[insight.risk_level].text)}>
                            {insight.risk_score}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Open / Total</p>
                          <p className="font-bold text-lg">{insight.unresolved_count}/{insight.complaint_count}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">High Priority</p>
                          <p className="font-bold text-lg">{insight.high_priority_pct}%</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Appeal Rate</p>
                          <p className="font-bold text-lg">{insight.appeal_rate_pct}%</p>
                        </div>
                      </div>

                      {insight.confident_root_cause && (
                        <div className="p-3 rounded-xl bg-violet-100/50 dark:bg-violet-900/20">
                          <p className="text-[10px] font-bold text-violet-600 uppercase mb-1">Verified Root Cause</p>
                          <p className="text-sm font-medium">{insight.confident_root_cause}</p>
                        </div>
                      )}

                      {insight.findings.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Analytical Findings</p>
                          <ul className="space-y-1.5">
                            {insight.findings.map((f, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                                <span className="text-blue-500 font-bold">•</span>
                                {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {insight.dominant_keywords.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {insight.dominant_keywords.map((kw, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-[10px] font-bold text-blue-600">
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {!insightLoading && !insight && (
                    <p className="text-sm text-slate-500">No detailed insights available for this category.</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action sidebar */}
        <div className="lg:w-72 bg-slate-50 dark:bg-slate-900/30 p-8 flex flex-col justify-center gap-4 border-l dark:border-slate-700">
          {rec.status !== 'implemented' && (
            <Button
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

  const [dssBundle, setDssBundle]   = useState<DssBundle | null>(null);
  const [dssLoading, setDssLoading] = useState(true);
  const [dssError, setDssError]     = useState<string | null>(null);
  const [showBriefing, setShowBriefing] = useState(false);

  const fetchDss = useCallback(async () => {
    setDssLoading(true);
    setDssError(null);
    try {
      const bundle = await recommendationService.getDssBundle();
      setDssBundle(bundle);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load DSS insights';
      setDssError(msg);
    } finally {
      setDssLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAndAutoGenerate();
    fetchDss();
  }, []);

  useEffect(() => {
    fetchRecommendations({
      status: statusFilter !== 'all' ? statusFilter : undefined,
      category_id: categoryFilter,
    });
  }, [statusFilter, categoryFilter]);

  const riskByCategory = useMemo(() => {
    const map = new Map<number, RiskRankingItem>();
    dssBundle?.riskRanking.forEach(r => map.set(r.category_id, r));
    return map;
  }, [dssBundle]);

  const categories = useMemo(() => {
    const seen = new Map<number, string>();
    dssBundle?.riskRanking.forEach(r => seen.set(r.category_id, r.category_name));
    recommendations.forEach(r => {
      if (!seen.has(r.category_id)) seen.set(r.category_id, r.category_name ?? `Category #${r.category_id}`);
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [recommendations, dssBundle]);

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

  const lastGenLabel = lastGeneratedTime
    ? new Date(lastGeneratedTime).toLocaleString()
    : 'Never';

  const showRecSkeletons = loading && recommendations.length === 0;

  return (
    <div className="space-y-8 animate-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="text-blue-600" size={24} />
            <h1 className="text-3xl font-bold">Decision Support</h1>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-slate-500 font-medium">
              Analytics, risk insights, and AI-powered recommendations
            </p>
            {generating && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full">
                <RefreshCw size={12} className="animate-spin" /> Generating…
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowBriefing(true)}
            className="gap-2 font-bold"
            size="sm"
            variant="default"
          >
            <Volume2 size={14} />
            Executive Briefing
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDss}
            disabled={dssLoading}
            className="gap-2 font-bold"
          >
            <RefreshCw size={14} className={cn(dssLoading && 'animate-spin')} />
            Refresh Insights
          </Button>
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last Generated</p>
            <p className="text-sm font-bold text-slate-600 dark:text-slate-400">{lastGenLabel}</p>
          </div>
        </div>
      </div>

      {/* DSS error */}
      {dssError && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200">
          <AlertTriangle className="text-amber-600 shrink-0" size={20} />
          <p className="text-amber-700 dark:text-amber-400 font-medium text-sm">{dssError}</p>
          <Button size="sm" variant="outline" onClick={fetchDss} className="ml-auto">Retry</Button>
        </div>
      )}

      {/* DSS dashboard */}
      <DssDashboard bundle={dssBundle} loading={dssLoading} />

      {/* Smart alerts */}
      {dssBundle && <AlertsPanel alerts={dssBundle.alerts} />}

      {/* Section divider */}
      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Brain size={16} /> AI Recommendations
        </h2>
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map(s => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? 'default' : 'outline'}
              onClick={() => setStatusFilter(s)}
              className={cn('capitalize font-bold h-9', statusFilter === s && 'bg-blue-600 hover:bg-blue-700')}
            >
              {s}
            </Button>
          ))}
        </div>
        {categories.length > 0 && (
          <select
            value={categoryFilter ?? ''}
            onChange={e => setCategoryFilter(e.target.value ? Number(e.target.value) : undefined)}
            className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Recommendation errors */}
      {error && !loading && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200">
          <AlertTriangle className="text-rose-600 shrink-0" size={20} />
          <p className="text-rose-700 dark:text-rose-400 font-medium text-sm">{error}</p>
          <Button size="sm" variant="outline" onClick={() => fetchRecommendations()} className="ml-auto">Retry</Button>
        </div>
      )}

      {/* Loading */}
      {showRecSkeletons && (
        <div className="grid grid-cols-1 gap-8">
          {[1, 2].map(i => <RecSkeleton key={i} />)}
        </div>
      )}

      {/* Empty */}
      {!loading && !generating && !error && recommendations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-3xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-6">
            <Brain size={40} className="text-blue-400" />
          </div>
          <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">No recommendations found</h3>
          <p className="text-slate-500 font-medium max-w-sm">
            {statusFilter !== 'all'
              ? `No ${statusFilter} recommendations. Try changing the filter.`
              : 'Recommendations appear after the first generation cycle. DSS insights above are still live.'}
          </p>
        </div>
      )}

      {/* Recommendation cards */}
      {recommendations.length > 0 && (
        <div className="grid grid-cols-1 gap-8">
          <AnimatePresence>
            {recommendations.map((rec, i) => (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: i * 0.05 }}
              >
                <RecCard
                  rec={rec}
                  risk={riskByCategory.get(rec.category_id)}
                  onUpdateStatus={handleUpdate}
                  updating={updating}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div key="toast" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
            <Toast message={toast.msg} type={toast.type} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Executive Briefing Panel */}
      <ExecutiveBriefingPanel
        isOpen={showBriefing}
        onClose={() => setShowBriefing(false)}
      />
    </div>
  );
}
