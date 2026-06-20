import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import {
  TrendingUp, Users, Clock, CheckCircle,
  ArrowUpRight, ArrowDownRight, Activity, AlertTriangle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { managerApi } from '../../api/services';
import type { OverviewData, DepartmentPerformance } from '../../types/api';

export default function ManagerOverview() {
  const [overview, setOverview]   = useState<OverviewData | null>(null);
  const [depts, setDepts]         = useState<DepartmentPerformance[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      managerApi.getOverview(),
      managerApi.getDepartmentPerformance(),
    ])
      .then(([ovRes, dpRes]) => {
        setOverview(ovRes.data.overviewData ?? ovRes.data);
        setDepts(dpRes.data.departments ?? []);
      })
      .catch(err => setError(err.message || 'Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  const stats = overview ? [
    { label: 'Total Complaints', value: String(overview.total),     icon: Activity,     color: 'text-blue-500',    bg: 'bg-blue-500/10' },
    { label: 'Pending',          value: String(overview.pending),   icon: Clock,        color: 'text-amber-500',   bg: 'bg-amber-500/10' },
    { label: 'Resolved',         value: String(overview.resolved),  icon: CheckCircle,  color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Appealed',         value: String(overview.appealed),  icon: AlertTriangle,color: 'text-rose-500',    bg: 'bg-rose-500/10' },
  ] : [];

  if (error) return (
    <div className="flex items-center gap-3 p-6 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200">
      <AlertTriangle className="text-rose-600" size={20} />
      <p className="text-rose-700 font-medium">{error}</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-in">
      <div>
        <h1 className="text-3xl font-bold">Executive Overview</h1>
        <p className="text-slate-500 font-medium">Real-time performance metrics across all university departments</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading
          ? [1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)
          : stats.map((stat, i) => (
            <Card key={i} className="border-none shadow-sm">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className={cn("p-2.5 rounded-xl", stat.bg)}>
                    <stat.icon className={stat.color} size={20} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                  <h3 className="text-3xl font-bold mt-1">{stat.value}</h3>
                </div>
              </CardContent>
            </Card>
          ))
        }
      </div>

      {/* Department performance table */}
      <Card>
        <div className="flex flex-row items-center justify-between border-b dark:border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold">Department Performance</h2>
            <p className="text-xs text-slate-500 font-medium">Efficiency by student department</p>
          </div>
          <Badge variant="outline" className="h-8">Live Data</Badge>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/30 border-b dark:border-slate-800">
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Department</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resolved</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Efficiency</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Avg. Res. Time</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {loading
                  ? [1,2,3].map(i => (
                    <tr key={i}><td colSpan={5} className="p-4"><Skeleton className="h-8 w-full" /></td></tr>
                  ))
                  : depts.length === 0
                    ? (
                      <tr><td colSpan={5} className="p-8 text-center text-slate-400 text-sm">No department data available</td></tr>
                    )
                    : depts.map((dept, i) => {
                      const efficiency = dept.total > 0
                        ? Math.round((dept.resolved / dept.total) * 100)
                        : 0;
                      return (
                        <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="p-4">
                            <p className="font-bold text-slate-800 dark:text-slate-200">{dept.name}</p>
                          </td>
                          <td className="p-4 font-mono font-bold text-slate-600 dark:text-slate-400">{dept.total}</td>
                          <td className="p-4">
                            <span className="font-mono font-bold text-emerald-600">{dept.resolved}</span>
                          </td>
                          <td className="p-4 w-48">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-600 rounded-full" style={{ width: `${efficiency}%` }} />
                              </div>
                              <span className="text-[10px] font-bold text-slate-500">{efficiency}%</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="font-mono font-bold text-slate-600 dark:text-slate-400">
                              {dept.avg_hours}h
                            </span>
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
