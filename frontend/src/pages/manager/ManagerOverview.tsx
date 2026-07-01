import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Activity, CheckCircle, Clock, Users, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { managerApi } from '../../api/services';
import type { ManagerDashboardResponse } from '../../types/api';

const statCards = [
  { key: 'totalComplaints', label: 'Total Complaints', icon: Activity, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { key: 'pending', label: 'Pending', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { key: 'resolved', label: 'Resolved', icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { key: 'appealed', label: 'Appealed', icon: Users, color: 'text-violet-500', bg: 'bg-violet-500/10' },
] as const;

export default function ManagerOverview() {
  const [data, setData] = useState<ManagerDashboardResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await managerApi.getOverview();
      const payload = response.data as ManagerDashboardResponse;
      setData(payload.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load manager overview.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const breakdown = data?.statusBreakdown ?? { pending: 0, in_progress: 0, resolved: 0, appealed: 0 };
  const stats = data ? [
    { label: 'Total Complaints', value: data.totalComplaints, icon: Activity, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Pending', value: breakdown.pending, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: 'Resolved', value: breakdown.resolved, icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Appealed', value: breakdown.appealed, icon: Users, color: 'text-violet-500', bg: 'bg-violet-500/10' },
  ] : [];

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Executive Overview</h1>
          <p className="text-slate-500 font-medium">Latest manager metrics from the backend dashboard endpoint.</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={loadData} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-700">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <Card key={i} className="border-none shadow-sm">
            <CardContent className="p-6">
              <div className="mb-4 flex items-start justify-between">
                <div className={`rounded-xl p-2.5 ${stat.bg}`}>
                  <stat.icon className={stat.color} size={20} />
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{stat.label}</p>
                <h3 className="mt-1 text-3xl font-bold">{stat.value}</h3>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b dark:border-slate-800">
          <div>
            <CardTitle className="text-lg">Operational Snapshot</CardTitle>
            <p className="text-xs font-medium text-slate-500">Resolution rate, SLA risk, and appeal rate from the manager dashboard.</p>
          </div>
          <Badge variant="outline" className="h-8">Live</Badge>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3 p-6">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Resolution rate</p>
            <p className="mt-2 text-2xl font-bold">{data?.resolutionRate ?? '0%'}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Late Response Rate</p>
            <p className="mt-2 text-2xl font-bold">{data?.slaBreachRate ?? '0%'}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Appeal rate</p>
            <p className="mt-2 text-2xl font-bold">{data?.appealRate ?? '0%'}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b dark:border-slate-800">
          <CardTitle className="text-lg">Officer Performance</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b bg-slate-50 dark:border-slate-800">
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Officer</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Resolved</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Avg. resolution</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">SLA</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {(data?.officerPerformance ?? []).map((officer) => (
                  <tr key={officer.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">{officer.full_name}</td>
                    <td className="p-4">{officer.totalResolved}</td>
                    <td className="p-4">{officer.avgResolutionTime}</td>
                    <td className="p-4">{officer.slaCompliance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
