import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import {
  TrendingUp,
  Users,
  Clock,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  MoreHorizontal
} from 'lucide-react';
import { cn } from '../../lib/utils';

export default function ManagerOverview() {
  const stats = [
    { label: 'Total Complaints', value: '1,284', change: '+12%', trend: 'up', icon: Activity, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Active Students', value: '842', change: '+5%', trend: 'up', icon: Users, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: 'Avg. Response', value: '2.4h', change: '-15%', trend: 'up', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: 'Resolution Rate', value: '92%', change: '+3%', trend: 'up', icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  ];

  const departments = [
    { name: 'IT Infrastructure', head: 'Dr. Sarah Wilson', resolved: 452, pending: 12, rating: 4.8 },
    { name: 'Student Records', head: 'Prof. James Bond', resolved: 310, pending: 28, rating: 4.2 },
    { name: 'Facilities Management', head: 'Eng. Mike Ross', resolved: 284, pending: 45, rating: 3.9 },
    { name: 'Academic Affairs', head: 'Dr. Rachel Zane', resolved: 156, pending: 8, rating: 4.9 },
  ];

  return (
    <div className="space-y-8 animate-in">
      <div>
        <h1 className="text-3xl font-bold">Executive Overview</h1>
        <p className="text-slate-500 font-medium">Real-time performance metrics across all university departments</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <Card key={i} className="border-none shadow-sm">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className={cn("p-2.5 rounded-xl", stat.bg)}>
                  <stat.icon className={stat.color} size={20} />
                </div>
                <div className={cn(
                  "flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full",
                  stat.trend === 'up' ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                )}>
                  {stat.trend === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {stat.change}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <h3 className="text-3xl font-bold mt-1">{stat.value}</h3>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b dark:border-slate-800">
          <div>
            <CardTitle className="text-lg">Department Performance</CardTitle>
            <p className="text-xs text-slate-500 font-medium">Monthly efficiency and student satisfaction ranking</p>
          </div>
          <Badge variant="outline" className="h-8">Last 30 Days</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/30 border-b dark:border-slate-800">
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Department</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resolved</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Efficiency</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Satisfaction</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {departments.map((dept, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="p-4">
                      <p className="font-bold text-slate-800 dark:text-slate-200">{dept.name}</p>
                      <p className="text-xs text-slate-500">Lead: {dept.head}</p>
                    </td>
                    <td className="p-4">
                      <span className="font-mono font-bold text-emerald-600">{dept.resolved}</span>
                    </td>
                    <td className="p-4">
                      <span className="font-mono font-bold text-amber-600">{dept.pending}</span>
                    </td>
                    <td className="p-4 w-48">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full"
                            style={{ width: `${(dept.resolved / (dept.resolved + dept.pending)) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-500">
                          {Math.round((dept.resolved / (dept.resolved + dept.pending)) * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center text-amber-500">
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <svg key={idx} className={cn("w-3 h-3 fill-current", idx >= Math.floor(dept.rating) && "text-slate-200 dark:text-slate-700")} viewBox="0 0 24 24">
                              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                            </svg>
                          ))}
                        </div>
                        <span className="text-xs font-bold">{dept.rating}</span>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <button className="text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors">
                        <MoreHorizontal size={20} />
                      </button>
                    </td>
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
