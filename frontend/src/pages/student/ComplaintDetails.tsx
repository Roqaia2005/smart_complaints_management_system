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
  Sparkles,
  Loader2,
  Calendar,
  User,
  History,
  X
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import { studentApi } from '../../api/services';

const statusMap: Record<string, { label: string, color: string, icon: any }> = {
  pending: { label: 'Pending', color: 'bg-slate-500/15 text-slate-500 border-slate-500/20 dark:text-slate-400', icon: ClockIcon },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/15 text-blue-500 border-blue-500/20 dark:text-blue-400', icon: MessageSquare },
  resolved: { label: 'Resolved', color: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20 dark:text-emerald-400', icon: CheckCircle2 },
  appealed: { label: 'Appealed', color: 'bg-orange-500/15 text-orange-500 border-orange-500/20 dark:text-orange-400', icon: AlertTriangle },
};

function ClockIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

interface TimelineItem {
  id: number;
  complaint_id: number;
  status: string;
  changed_by: number;
  changed_at: string;
}

interface BackendAppeal {
  id: number;
  complaint_id: number;
  reason: string;
  status: string;
}

interface ComplaintDetailData {
  id: number;
  user_id: number;
  category_id: number;
  problem: string;
  location: string;
  since: string;
  ai_summary: string;
  priority: number;
  status: string;
  resolution_text: string | null;
  resolved_at: string | null;
  sla_deadline: string | null;
  createdAt: string;
  updatedAt: string;
  Category?: {
    name: string;
    sla_hours: number;
  };
  Appeal?: BackendAppeal | null;
  ComplaintHistories?: TimelineItem[];
}

export default function ComplaintDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [data, setData] = React.useState<ComplaintDetailData | null>(null);
  const [facultyName, setFacultyName] = React.useState<string>('N/A');
  const [historyItems, setHistoryItems] = React.useState<TimelineItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Appeal Modal State
  const [showAppealModal, setShowAppealModal] = React.useState(false);
  const [appealReason, setAppealReason] = React.useState('');
  const [isSubmittingAppeal, setIsSubmittingAppeal] = React.useState(false);
  const [appealError, setAppealError] = React.useState<string | null>(null);

  // studentController.js uses `{ error: err.message }` for 500s and only
  // `{ message: ... }` for the 404 in getDetails — check both keys.
  const extractApiError = (err: any, fallback: string) =>
    err?.response?.data?.message || err?.response?.data?.error || fallback;

  const fetchComplaintDetails = React.useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await studentApi.getComplaintDetails(id);
      setData(res.data.complaint);
      setFacultyName(res.data.faculty || 'N/A');
      setHistoryItems(res.data.history || []);
    } catch (err: any) {
      console.error(err);
      setError(extractApiError(err, 'Failed to fetch complaint details. It might have been deleted or you do not have permission.'));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    fetchComplaintDetails();
  }, [fetchComplaintDetails]);

  const handleAppealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !user?.id || !appealReason.trim()) return;

    setIsSubmittingAppeal(true);
    setAppealError(null);

    try {
      const studentUserId = typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;
      await studentApi.submitAppeal(id, appealReason, studentUserId);
      setShowAppealModal(false);
      setAppealReason('');
      fetchComplaintDetails();
    } catch (err: any) {
      console.error(err);
      setAppealError(extractApiError(err, 'Failed to submit appeal. Please try again.'));
    } finally {
      setIsSubmittingAppeal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium mt-4">Loading complaint details...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Error Loading Details</h2>
        <p className="text-slate-500">{error || 'Complaint not found.'}</p>
        <Button onClick={() => navigate('/student/complaints')} variant="outline">
          <ArrowLeft size={16} className="mr-2" /> Back to My Complaints
        </Button>
      </div>
    );
  }

  const statusInfo = statusMap[data.status] || { label: data.status, color: 'bg-slate-500/10 text-slate-500', icon: ClockIcon };
  const subject = data.problem.split('\n')[0].substring(0, 80) || 'Complaint Detail';

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in">
      <Button variant="ghost" onClick={() => navigate('/student/complaints')} className="mb-4">
        <ArrowLeft size={18} className="mr-2" /> Back to My Complaints
      </Button>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 font-mono font-bold shadow-sm border border-slate-200/50 dark:border-slate-700/50">
            #{data.id}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white truncate max-w-xl">{subject}</h1>
            <p className="text-slate-500 font-medium">Submitted on {new Date(data.createdAt).toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={cn("px-4 py-1.5 text-sm font-bold flex items-center gap-1.5 border", statusInfo.color)}>
            <statusInfo.icon size={14} />
            {statusInfo.label.toUpperCase()}
          </Badge>
          
          {data.status === 'resolved' && !data.Appeal && (
            <Button
              variant="outline"
              className="border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20 gap-2 font-bold"
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
          {data.ai_summary && (
            <Card className="border-blue-100 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-950/10 overflow-hidden">
              <CardHeader className="bg-blue-100/50 dark:bg-blue-900/50 border-b border-blue-100 dark:border-blue-900">
                <CardTitle className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2">
                  <Bot size={16} /> AI Summary & Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed italic">
                  "{data.ai_summary}"
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <span>Priority Level:</span>
                  <Badge variant={data.priority >= 4 ? 'destructive' : data.priority === 3 ? 'warning' : 'secondary'}>
                    {data.priority >= 4 ? 'High' : data.priority === 3 ? 'Medium' : 'Low'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Details Section */}
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-lg flex items-center gap-2 text-slate-800 dark:text-white">
                <MessageSquare size={20} className="text-blue-600" /> Original Submission
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {data.problem}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-slate-400" />
                  <span>Happened Since: <strong>{data.since}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <User size={16} className="text-slate-400" />
                  <span>Faculty Department: <strong>{facultyName}</strong></span>
                </div>
              </div>

              {data.resolution_text && (
                <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                    <CheckCircle2 size={20} /> Official Resolution
                  </div>
                  <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-sm leading-relaxed">
                    {data.resolution_text}
                  </div>
                  {data.resolved_at && (
                    <p className="text-xs text-slate-400 font-medium">Resolved at: {new Date(data.resolved_at).toLocaleString()}</p>
                  )}
                </div>
              )}

              {data.Appeal && (
                <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 font-bold">
                    <AlertTriangle size={20} /> Submitted Appeal
                  </div>
                  <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/20 text-orange-800 dark:text-orange-300 text-sm leading-relaxed">
                    <p className="font-semibold">Reason for Appeal:</p>
                    <p className="mt-1 italic">"{data.Appeal.reason}"</p>
                  </div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    Appeal Status: 
                    <Badge variant={data.Appeal.status === 'pending' ? 'warning' : 'success'}>
                      {data.Appeal.status.toUpperCase()}
                    </Badge>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-lg flex items-center gap-2">
                <History size={18} className="text-slate-400" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {historyItems.length === 0 ? (
                <p className="text-sm text-slate-400 text-center">No history recorded.</p>
              ) : (
                <div className="space-y-6">
                  {historyItems.map((item, i) => {
                    const stepStatus = item.status;
                    const isResolved = stepStatus === 'resolved';
                    const isAppealed = stepStatus === 'appealed';
                    const isPending = stepStatus === 'pending';

                    return (
                      <div key={item.id} className="flex gap-4 relative">
                        {i < historyItems.length - 1 && (
                          <div className="absolute left-[11px] top-6 bottom-[-24px] w-0.5 bg-slate-100 dark:bg-slate-800" />
                        )}
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 border shadow-sm",
                          isResolved ? "bg-emerald-500 border-emerald-600" :
                          isAppealed ? "bg-orange-500 border-orange-600" :
                          isPending ? "bg-slate-400 border-slate-500" :
                          "bg-blue-500 border-blue-600"
                        )}>
                          <div className="w-1.5 h-1.5 bg-white rounded-full" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(item.changed_at).toLocaleString()}</p>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1 capitalize">
                            {stepStatus === 'in_progress' ? 'Assigned to Officer' : stepStatus}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {isPending ? 'Complaint submitted successfully' :
                             isResolved ? 'Marked as resolved by officer' :
                             isAppealed ? 'Appeal filed against resolution' :
                             'Status changed to processing'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* <Card className="bg-slate-950 text-white border-slate-850">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-widest">
                <Sparkles size={14} /> AI Recommendation
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                {data.status === 'resolved' 
                  ? 'The complaint is marked as resolved. If the resolution provided by the department does not satisfy your issue, you can appeal within the regulatory grace period.'
                  : 'Your complaint is currently being processed by our support system. The assigned department will respond as soon as possible.'
                }
              </p>
            </CardContent>
          </Card> */}
        </div>
      </div>

      {/* Appeal Modal */}
      {showAppealModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <CardHeader className="flex flex-row items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <CardTitle className="text-xl font-bold text-slate-800 dark:text-white">Appeal Resolution</CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400 mt-1">Explain why you are dissatisfied with the official resolution.</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowAppealModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </Button>
            </CardHeader>
            <form onSubmit={handleAppealSubmit}>
              <CardContent className="space-y-4 pt-6">
                {appealError && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-650 dark:text-red-400 text-xs flex items-center gap-2">
                    <AlertTriangle size={16} />
                    <span>{appealError}</span>
                  </div>
                )}
                
                <textarea
                  value={appealReason}
                  onChange={e => setAppealReason(e.target.value)}
                  required
                  rows={6}
                  className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm focus:ring-2 focus:ring-blue-600 outline-none text-slate-800 dark:text-slate-200 resize-none"
                  placeholder="Describe your reason for appeal in detail..."
                />
                
                <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                  <Button type="button" variant="ghost" onClick={() => setShowAppealModal(false)}>Cancel</Button>
                  <Button 
                    type="submit" 
                    disabled={isSubmittingAppeal || !appealReason.trim()}
                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-8 shadow-lg shadow-orange-500/20"
                  >
                    {isSubmittingAppeal ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting Appeal...
                      </>
                    ) : (
                      'Submit Appeal'
                    )}
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}