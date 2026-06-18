import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  ArrowLeft,
  Brain,
  MessageSquare,
  User as UserIcon,
  History,
  ShieldCheck,
} from 'lucide-react';

export default function OfficerComplaintDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = React.useState('pending');
  const [resolution, setResolution] = React.useState('');

  const complaint = {
    id,
    subject: 'Total Lab Power Failure',
    student: 'Ahmed Ali',
    universityId: '202100854',
    category: 'Facilities / Infrastructure',
    priority: 'critical',
    createdAt: '2024-04-25 10:15',
    originalProblem: "The entire Engineering Lab A has no power. All computers are off and students are sitting in the dark. We have a deadline in 2 hours and we can't work on our projects. This needs immediate attention.",
    aiAnalysis: {
      urgency: 'Critical',
      impact: 'High (Multiple students affected, imminent deadline)',
      category_suggestion: 'Facilities - Electrical',
      summary: 'Power outage in Engineering Lab A impacting student deadlines.'
    }
  };

  const handleUpdate = () => {
    // API logic here
    console.log({ status, resolution });
    navigate('/officer/dashboards');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
        <ArrowLeft size={18} className="mr-2" /> Back to Dashboard
      </Button>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Badge className="bg-rose-500 text-white font-bold px-3 py-1 uppercase tracking-wider text-[10px]">
                  {complaint.priority}
                </Badge>
                <span className="text-sm font-mono text-slate-400">#{id}</span>
              </div>
              <h1 className="text-3xl font-bold">{complaint.subject}</h1>
            </div>
          </div>

          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b dark:border-slate-800">
              <CardTitle className="text-lg flex items-center gap-2">
                <UserIcon size={20} className="text-slate-400" /> Student Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Full Name</p>
                  <p className="font-semibold">{complaint.student}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">University ID</p>
                  <p className="font-semibold font-mono">{complaint.universityId}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Category</p>
                  <p className="font-semibold">{complaint.category}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Detailed Description</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-800 text-slate-700 dark:text-slate-300 leading-relaxed">
                {complaint.originalProblem}
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-100 dark:border-blue-900 bg-blue-50/20 dark:bg-blue-950/10">
            <CardHeader className="flex flex-row items-center gap-2 border-b border-blue-100 dark:border-blue-900">
              <Brain size={20} className="text-blue-600" />
              <CardTitle className="text-sm font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest">
                AI Diagnostic Report
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 border border-blue-100 dark:border-blue-900">
                  <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">Urgency Level</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-white">{complaint.aiAnalysis.urgency}</p>
                </div>
                <div className="p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 border border-blue-100 dark:border-blue-900">
                  <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">Impact Analysis</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-white">{complaint.aiAnalysis.impact}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">Context Summary</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 italic">"{complaint.aiAnalysis.summary}"</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="w-full lg:w-[400px] space-y-8">
          <Card className="border-2 border-blue-600 shadow-xl shadow-blue-500/10">
            <CardHeader className="bg-blue-600 text-white">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck size={20} /> Action Center
              </CardTitle>
              <CardDescription className="text-blue-100">Update status and resolve the issue</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Update Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-semibold focus:ring-blue-600"
                >
                  <option value="pending">Mark as Pending</option>
                  <option value="in_progress">Set to In Progress</option>
                  <option value="resolved">Mark as Resolved</option>
                </select>
              </div>

              {status === 'resolved' && (
                <div className="space-y-2 animate-in slide-in-from-top-4">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Resolution Notes</label>
                  <textarea
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    placeholder="Describe how the issue was resolved..."
                    className="w-full h-32 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-blue-600"
                    required
                  />
                </div>
              )}

              <Button onClick={handleUpdate} className="w-full h-12 bg-blue-600 hover:bg-blue-700 font-bold shadow-lg shadow-blue-500/20">
                Update Record
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History size={18} className="text-slate-400" /> Recent History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {[
                  { user: 'AI Assistant', action: 'Classified as Critical', time: '10:15 AM' },
                  { user: 'Ahmed Ali', action: 'Submitted complaint', time: '10:15 AM' },
                ].map((item, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5" />
                    <div>
                      <p className="font-bold">{item.user}</p>
                      <p className="text-slate-500 text-xs">{item.action} • {item.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
