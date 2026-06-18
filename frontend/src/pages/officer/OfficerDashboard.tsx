import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Search,
  ArrowUpRight,
  Clock,
  AlertCircle,
  CheckCircle2,
  Brain,
  MoreVertical,
  ChevronRight
} from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

export default function OfficerDashboard() {
  const [filter, setFilter] = React.useState('all');

  const complaints = [
    { id: '2045', subject: 'Total Lab Power Failure', student: 'Ahmed Ali', priority: 'critical', status: 'pending', time: '12 mins ago', category: 'Facilities' },
    { id: '2042', subject: 'WiFi Down in Building C', student: 'Sarah Smith', priority: 'high', status: 'in_progress', time: '45 mins ago', category: 'IT Support' },
    { id: '2038', subject: 'Registration Portal Error', student: 'Mona Khan', priority: 'medium', status: 'pending', time: '2 hours ago', category: 'Student Records' },
    { id: '2035', subject: 'Library Book Lost Record', student: 'John Doe', priority: 'low', status: 'resolved', time: '5 hours ago', category: 'Library' },
  ];

  const priorityMap: Record<string, { label: string, color: string }> = {
    critical: { label: 'Critical', color: 'bg-rose-500 text-white' },
    high: { label: 'High', color: 'bg-orange-500 text-white' },
    medium: { label: 'Medium', color: 'bg-blue-500 text-white' },
    low: { label: 'Low', color: 'bg-slate-500 text-white' },
  };

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Officer Inbox</h1>
          <p className="text-slate-500 font-medium">Prioritized complaints sorted by AI urgency</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="h-9 px-4 gap-2 border-blue-200 text-blue-700 bg-blue-50 dark:bg-blue-900/20">
            <Brain size={16} /> AI Sorting Active
          </Badge>
          <Button variant="outline" size="icon" className="h-9 w-9"><MoreVertical size={18} /></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Unassigned', value: '14', icon: AlertCircle, color: 'text-rose-500' },
          { label: 'In Progress', value: '8', icon: Clock, color: 'text-blue-500' },
          { label: 'Pending Feedback', value: '4', icon: ArrowUpRight, color: 'text-orange-500' },
          { label: 'Resolved Today', value: '32', icon: CheckCircle2, color: 'text-emerald-500' },
        ].map((stat, i) => (
          <Card key={i} className="border-none shadow-sm">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                  <h3 className="text-2xl font-bold mt-1">{stat.value}</h3>
                </div>
                <stat.icon className={stat.color} size={20} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <Input placeholder="Search records..." className="pl-10 h-10 border-slate-200 dark:border-slate-800" />
          </div>
          <div className="flex items-center gap-2">
            {['all', 'pending', 'in_progress', 'resolved'].map(t => (
              <Button
                key={t}
                variant={filter === t ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setFilter(t)}
                className="capitalize font-bold"
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
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Issue / Student</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Received</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {complaints.filter(c => filter === 'all' || c.status === filter).map((complaint) => {
                  const priority = priorityMap[complaint.priority];
                  return (
                    <tr key={complaint.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                      <td className="p-4">
                        <Badge className={cn("font-bold px-2.5 py-0.5 rounded-md text-[10px] uppercase tracking-wider", priority.color)}>
                          {priority.label}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 transition-colors">{complaint.subject}</p>
                        <p className="text-xs text-slate-500 font-medium">{complaint.student}</p>
                      </td>
                      <td className="p-4 text-xs font-medium text-slate-600 dark:text-slate-400">{complaint.category}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            complaint.status === 'pending' ? "bg-amber-500" : complaint.status === 'in_progress' ? "bg-blue-500" : "bg-emerald-500"
                          )} />
                          <span className="text-xs font-bold capitalize text-slate-700 dark:text-slate-300">
                            {complaint.status.replace('_', ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-xs font-medium text-slate-500">{complaint.time}</td>
                      <td className="p-4 text-right">
                        <Link to={`/officer/complaints/${complaint.id}`}>
                          <Button variant="ghost" size="sm" className="font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 group-hover:translate-x-1 transition-all">
                            Review <ChevronRight size={14} className="ml-1" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
