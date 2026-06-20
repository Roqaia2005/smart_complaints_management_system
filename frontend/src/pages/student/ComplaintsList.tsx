import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Search,
  Filter,
  ChevronRight,
  Clock,
  CheckCircle2,
  MessageCircle,
  AlertTriangle
} from 'lucide-react';
import { Input } from '../../components/ui/input';
import { cn } from '../../lib/utils';
import type { ComplaintStatus } from '../../types/workflow';
import { Link } from 'react-router-dom';

const statusMap: Record<ComplaintStatus, { label: string, color: string, icon: any }> = {
  pending: { label: 'Pending', color: 'bg-slate-500/15 text-slate-500 border-slate-500/20', icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/15 text-blue-500 border-blue-500/20', icon: MessageCircle },
  resolved: { label: 'Resolved', color: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20', icon: CheckCircle2 },
  appealed: { label: 'Appealed', color: 'bg-orange-500/15 text-orange-500 border-orange-500/20', icon: AlertTriangle },
};

export default function StudentComplaints() {
  const complaints = [
    { id: '1024', subject: 'Dormitory WiFi Downtime', date: '2024-04-20', status: 'resolved' as ComplaintStatus, category: 'Technical' },
    { id: '1052', subject: 'Grade Appeal - CS301', date: '2024-04-22', status: 'in_progress' as ComplaintStatus, category: 'Academic' },
    { id: '1068', subject: 'Library Quiet Zone Noise', date: '2024-04-24', status: 'pending' as ComplaintStatus, category: 'Facilities' },
    { id: '1075', subject: 'Cafeteria Quality Issue', date: '2024-04-25', status: 'appealed' as ComplaintStatus, category: 'Services' },
  ];

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">My Complaints</h1>
          <p className="text-slate-500 font-medium">Track the status of your submitted issues</p>
        </div>
        <Link to="/student/chat">
          <Button className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20">
            <MessageCircle size={18} /> New Complaint
          </Button>
        </Link>
      </div>

      <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <Input placeholder="Search complaints..." className="pl-10 h-10" />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2"><Filter size={16} /> All Status</Button>
            <Button variant="outline" size="sm" className="gap-2">Latest First</Button>
          </div>
        </div>

        <CardContent className="p-0">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {complaints.map((complaint) => {
              const status = statusMap[complaint.status];
              return (
                <Link
                  key={complaint.id}
                  to={`/student/complaints/${complaint.id}`}
                  className="flex items-center p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                >
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mr-4 text-slate-400 font-mono text-xs">
                    #{complaint.id}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 transition-colors truncate">
                      {complaint.subject}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 font-medium">
                      <span>{complaint.category}</span>
                      <span>•</span>
                      <span>Submitted on {complaint.date}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <Badge className={cn("px-3 py-1 font-bold", status.color)}>
                      <status.icon size={12} className="mr-1.5" />
                      {status.label}
                    </Badge>
                    <ChevronRight size={20} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Pending', value: 12, color: 'bg-slate-500' },
          { label: 'In Progress', value: 5, color: 'bg-blue-500' },
          { label: 'Resolved', value: 48, color: 'bg-emerald-500' },
        ].map(stat => (
          <Card key={stat.label} className="border-none shadow-sm bg-white dark:bg-slate-800">
            <CardContent className="p-6 flex items-center gap-4">
              <div className={cn("w-2 h-12 rounded-full", stat.color)} />
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                <h4 className="text-2xl font-bold mt-1">{stat.value}</h4>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
