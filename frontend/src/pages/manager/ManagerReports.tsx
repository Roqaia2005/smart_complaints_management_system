import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import {
  Download,
  Filter,
  FileText,
  Calendar,
  Building,
  CheckCircle2,
  AlertCircle,
  Search,
  MoreVertical
} from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';

export default function ManagerReports() {
  const reports = [
    { id: 'R-402', name: 'Q1 Infrastructure Efficiency', date: '2024-04-15', status: 'ready', department: 'Facilities' },
    { id: 'R-401', name: 'Student Satisfaction Survey', date: '2024-04-10', status: 'ready', department: 'Academic' },
    { id: 'R-398', name: 'IT Response Time Audit', date: '2024-04-02', status: 'ready', department: 'IT' },
    { id: 'R-395', name: 'Monthly Escalation Summary', date: '2024-03-28', status: 'ready', department: 'All' },
  ];

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Generated Reports</h1>
          <p className="text-slate-500 font-medium">Export and analyze historical complaint data</p>
        </div>
        <Button className="gap-2 bg-blue-600 hover:bg-blue-700 font-bold h-11 px-6 shadow-lg shadow-blue-500/20">
          <FileText size={18} /> Generate New Report
        </Button>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Calendar size={14} /> Date Range
              </label>
              <Button variant="outline" className="w-full justify-between h-11 border-slate-200 dark:border-slate-800">
                Last 30 Days <Filter size={16} />
              </Button>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Building size={14} /> Department
              </label>
              <Button variant="outline" className="w-full justify-between h-11 border-slate-200 dark:border-slate-800">
                All Departments <Filter size={16} />
              </Button>
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Global Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                <Input placeholder="Search reports by name or ID..." className="pl-10 h-11" />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30">
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Report ID</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Report Name</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Department</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Created Date</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="p-4 font-mono text-sm text-slate-500 font-bold">{report.id}</td>
                    <td className="p-4">
                      <p className="font-bold text-slate-800 dark:text-slate-200">{report.name}</p>
                    </td>
                    <td className="p-4">
                      <Badge variant="secondary" className="font-bold">{report.department}</Badge>
                    </td>
                    <td className="p-4 text-xs font-medium text-slate-500">{report.date}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-emerald-600">
                        <CheckCircle2 size={16} />
                        <span className="text-xs font-bold uppercase tracking-wider">Ready</span>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" className="font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                          <Download size={16} className="mr-2" /> Export
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                          <MoreVertical size={16} />
                        </Button>
                      </div>
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
