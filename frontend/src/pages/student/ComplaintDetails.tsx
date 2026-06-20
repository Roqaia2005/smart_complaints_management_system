import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  ArrowLeft,
  MessageSquare,
  Bot,
  CheckCircle2,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { cn } from '../../lib/utils';

export default function ComplaintDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showAppealModal, setShowAppealModal] = React.useState(false);

  // Mock data based on id
  const complaint = {
    id,
    subject: 'Dormitory WiFi Downtime',
    category: 'Technical / IT',
    status: 'resolved',
    createdAt: '2024-04-20 14:30',
    originalProblem: "The WiFi in Building B has been completely down for three days. I can't finish my assignments and I have to go to the library late at night just to get internet. This is very frustrating as we pay for these services.",
    aiSummary: "The student is reporting a prolonged internet outage in Dormitory Building B (3 days). The issue is impacting academic productivity and safety (forced to travel to the library late at night). Priority is categorized as High due to academic impact.",
    resolution: "Our technical team identified a faulty switch in the Building B server room. The hardware has been replaced and the firmware updated. The network was restored on 2024-04-22 at 09:00 AM.",
    timeline: [
      { status: 'pending', date: 'April 20, 14:30', comment: 'Complaint submitted via AI Assistant' },
      { status: 'in_progress', date: 'April 20, 16:15', comment: 'Assigned to IT Maintenance Team' },
      { status: 'resolved', date: 'April 22, 09:15', comment: 'Issue resolved. Verified by technician.' },
    ]
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
        <ArrowLeft size={18} className="mr-2" /> Back to My Complaints
      </Button>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 font-mono font-bold shadow-sm">
            #{id}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white">{complaint.subject}</h1>
            <p className="text-slate-500 font-medium">Submitted on {complaint.createdAt}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={complaint.status === 'resolved' ? 'success' : 'info'} className="px-4 py-1.5 text-sm font-bold">
            {complaint.status.replace('_', ' ').toUpperCase()}
          </Badge>
          {complaint.status === 'resolved' && (
            <Button
              variant="outline"
              className="border-orange-500 text-orange-600 hover:bg-orange-50 gap-2 font-bold"
              onClick={() => setShowAppealModal(true)}
            >
              <AlertTriangle size={18} /> Appeal Resolution
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* AI Insights Section */}
          <Card className="border-blue-100 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-950/10 overflow-hidden">
            <CardHeader className="bg-blue-100/50 dark:bg-blue-900/50 border-b border-blue-100 dark:border-blue-900">
              <CardTitle className="text-sm font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2">
                <Bot size={16} /> AI Summary & Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed italic">
                "{complaint.aiSummary}"
              </p>
            </CardContent>
          </Card>

          {/* Details Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare size={20} className="text-blue-600" /> Original Submission
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">
                  {complaint.originalProblem}
                </p>
              </div>

              {complaint.resolution && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-600 font-bold">
                    <CheckCircle2 size={20} /> Official Resolution
                  </div>
                  <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-800 dark:text-emerald-400 text-sm leading-relaxed">
                    {complaint.resolution}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                {complaint.timeline.map((item, i) => (
                  <div key={i} className="flex gap-4 relative">
                    {i < complaint.timeline.length - 1 && (
                      <div className="absolute left-[11px] top-6 bottom-[-24px] w-0.5 bg-slate-100 dark:bg-slate-800" />
                    )}
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10",
                      item.status === 'resolved' ? "bg-emerald-500" : "bg-blue-500"
                    )}>
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{item.date}</p>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">{item.comment}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 text-white border-none">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-widest">
                <Sparkles size={14} /> AI Recommendation
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                Based on your history, this resolution was handled within 48 hours. If the WiFi is still unstable, we recommend choosing "Appeal".
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Appeal Modal Placeholder */}
      {showAppealModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
            <CardHeader>
              <CardTitle>Appeal Resolution</CardTitle>
              <CardDescription>Explain why you are dissatisfied with the official resolution.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                className="w-full min-h-[150px] p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-blue-600 outline-none"
                placeholder="Describe your reason for appeal..."
              />
              <div className="flex gap-3 justify-end pt-4">
                <Button variant="ghost" onClick={() => setShowAppealModal(false)}>Cancel</Button>
                <Button className="bg-orange-600 hover:bg-orange-700 font-bold px-8">Submit Appeal</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
