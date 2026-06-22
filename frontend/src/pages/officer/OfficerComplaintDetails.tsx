import React, { useEffect, useState } from 'react';
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
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Calendar,
  MapPin
} from 'lucide-react';
import { officerApi } from '../../api/services';
import { cn } from '../../lib/utils';

const priorityMap: Record<number, { label: string; color: string }> = {
  5: { label: 'Critical', color: 'bg-rose-500/15 text-rose-500 border-rose-500/20' },
  4: { label: 'High',     color: 'bg-orange-500/15 text-orange-500 border-orange-500/20' },
  3: { label: 'Medium',   color: 'bg-blue-500/15 text-blue-500 border-blue-500/20' },
  2: { label: 'Low',      color: 'bg-slate-500/15 text-slate-500 border-slate-500/20' },
  1: { label: 'Info',     color: 'bg-slate-400/15 text-slate-400 border-slate-400/20' },
};

const statusInfoMap: Record<string, { label: string; color: string }> = {
  pending:     { label: 'Pending', color: 'bg-amber-500/15 text-amber-500 border-amber-500/20' },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/15 text-blue-500 border-blue-500/20' },
  resolved:    { label: 'Resolved', color: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20' },
  appealed:    { label: 'Appealed', color: 'bg-orange-500/15 text-orange-500 border-orange-500/20' },
};

interface StudentData {
  name: string;
  department: string;
  academic_year: string;
}

interface ComplaintDetail {
  id: number;
  user_id: number;
  category_id: number;
  problem: string;
  location?: string;
  since?: string;
  ai_summary?: string;
  priority?: number;
  status: string;
  resolution_text?: string;
  resolved_at?: string;
  createdAt: string;
  Category?: { id: number; name: string };
  Appeal?: { id: number; reason: string; status: string } | null;
  ComplaintHistories?: { id: number; status: string; changed_at: string }[];
}

export default function OfficerComplaintDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [complaint, setComplaint] = useState<ComplaintDetail | null>(null);
  const [student, setStudent] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form States
  const [status, setStatus] = useState('pending');
  const [resolution, setResolution] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const fetchDetails = React.useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await officerApi.getComplaintDetails(id);
      const data = res.data;
      setComplaint(data.complaint);
      setStudent(data.student);
      
      // Initialize form fields
      if (data.complaint) {
        setStatus(data.complaint.status);
        setResolution(data.complaint.resolution_text || '');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to load complaint details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (status === 'resolved' && !resolution.trim()) {
      setUpdateError('Resolution notes are required when resolving.');
      return;
    }

    setUpdating(true);
    setUpdateError(null);
    try {
      await officerApi.updateComplaintStatus(id, status, resolution);
      // Refresh page details instead of navigating away directly
      await fetchDetails();
      // Show success briefly, then navigate back
      navigate('/officer/dashboards');
    } catch (err: any) {
      console.error(err);
      setUpdateError(err.response?.data?.error || 'Failed to update record.');
    } finally {
      setUpdating(false);
    }
  };

  const handleReviewAppeal = async () => {
    if (!complaint?.Appeal?.id) return;
    setUpdating(true);
    try {
      await officerApi.markAppealReviewed(complaint.Appeal.id);
      await fetchDetails();
    } catch (err: any) {
      console.error(err);
      setUpdateError(err.response?.data?.error || 'Failed to review appeal.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium mt-4">Loading complaint details...</p>
      </div>
    );
  }

  if (error || !complaint) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Error Loading Details</h2>
        <p className="text-slate-500">{error || 'Complaint not found.'}</p>
        <Button onClick={() => navigate('/officer/dashboards')} variant="outline">
          <ArrowLeft size={16} className="mr-2" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  const p = priorityMap[complaint.priority ?? 3] ?? priorityMap[3];
  const sInfo = statusInfoMap[complaint.status] || { label: complaint.status, color: 'bg-slate-500/10 text-slate-500' };
  const subject = complaint.problem.split('\n')[0].substring(0, 80) || 'Complaint Detail';

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in">
      <Button variant="ghost" onClick={() => navigate('/officer/dashboards')} className="mb-4">
        <ArrowLeft size={18} className="mr-2" /> Back to Dashboard
      </Button>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Badge className={cn("font-bold px-3 py-1 uppercase tracking-wider text-[10px] border", p.color)}>
                {p.label}
              </Badge>
              <Badge className={cn("font-bold px-3 py-1 uppercase tracking-wider text-[10px] border", sInfo.color)}>
                {sInfo.label}
              </Badge>
              <span className="text-sm font-mono text-slate-400">#{complaint.id}</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-850 dark:text-white">{subject}</h1>
            <p className="text-slate-500 font-medium">Submitted on {new Date(complaint.createdAt).toLocaleString()}</p>
          </div>

          <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/40">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-lg flex items-center gap-2">
                <UserIcon size={20} className="text-slate-400" /> Student Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Full Name</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">{student?.name || 'Anonymous Student'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Academic Year</p>
                  <p className="font-semibold font-mono text-slate-800 dark:text-slate-200">{student?.academic_year || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Department</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">{student?.department || '—'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-lg">Detailed Description</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-850 text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {complaint.problem}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-500 font-medium">
                {complaint.location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin size={14} className="text-slate-400" />
                    <span>Location: <strong>{complaint.location}</strong></span>
                  </div>
                )}
                {complaint.since && (
                  <div className="flex items-center gap-1.5">
                    <Calendar size={14} className="text-slate-400" />
                    <span>Happened Since: <strong>{new Date(complaint.since).toLocaleString()}</strong></span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {complaint.ai_summary && (
            <Card className="border-blue-100 dark:border-blue-900 bg-blue-50/20 dark:bg-blue-955/10">
              <CardHeader className="flex flex-row items-center gap-2 border-b border-blue-100 dark:border-blue-900">
                <Brain size={20} className="text-blue-600" />
                <CardTitle className="text-sm font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest">
                  AI Diagnostic Report
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div>
                  <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">Context Summary</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 italic">"{complaint.ai_summary}"</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Appeal details */}
          {complaint.Appeal && (
            <Card className="border-orange-200 dark:border-orange-900 bg-orange-50/15 dark:bg-orange-955/10">
              <CardHeader className="flex flex-row items-center justify-between border-b border-orange-100 dark:border-orange-900">
                <CardTitle className="text-sm font-bold text-orange-700 dark:text-orange-400 uppercase tracking-widest flex items-center gap-2">
                  <AlertTriangle size={16} /> Student Appeal Received
                </CardTitle>
                <Badge variant={complaint.Appeal.status === 'pending' ? 'warning' : 'success'}>
                  {complaint.Appeal.status}
                </Badge>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <p className="text-sm text-slate-700 dark:text-slate-300 italic">
                  "{complaint.Appeal.reason}"
                </p>

                {complaint.Appeal.status === 'pending' && (
                  <Button 
                    onClick={handleReviewAppeal}
                    disabled={updating}
                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold h-10 px-6"
                  >
                    Mark Appeal as Reviewed
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="w-full lg:w-[400px] space-y-8">
          <Card className="border-2 border-blue-600 shadow-xl shadow-blue-500/10">
            <CardHeader className="bg-blue-600 text-white">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck size={20} /> Action Center
              </CardTitle>
              <CardDescription className="text-blue-100">Update status and resolve the issue</CardDescription>
            </CardHeader>
            <form onSubmit={handleUpdate}>
              <CardContent className="p-6 space-y-6">
                {updateError && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-650 dark:text-red-400 text-xs flex items-center gap-2">
                    <AlertTriangle size={16} />
                    <span>{updateError}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Update Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    disabled={complaint.status === 'resolved' || complaint.status === 'appealed'}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-semibold focus:ring-2 focus:ring-blue-600 outline-none text-slate-800 dark:text-slate-200"
                  >
                    <option value="pending">Mark as Pending</option>
                    <option value="in_progress">Set to In Progress</option>
                    <option value="resolved">Mark as Resolved</option>
                  </select>
                </div>

                {(status === 'resolved' || complaint.status === 'resolved' || complaint.status === 'appealed') && (
                  <div className="space-y-2 animate-in slide-in-from-top-4">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Resolution Notes</label>
                    <textarea
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      disabled={complaint.status === 'resolved' || complaint.status === 'appealed'}
                      placeholder="Describe how the issue was resolved..."
                      className="w-full h-32 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-blue-600 outline-none text-slate-800 dark:text-slate-200 resize-none"
                      required
                    />
                  </div>
                )}

                {complaint.status !== 'resolved' && complaint.status !== 'appealed' && (
                  <Button type="submit" disabled={updating} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/20">
                    {updating ? <Loader2 className="animate-spin h-5 w-5 mx-auto" /> : 'Update Record'}
                  </Button>
                )}
              </CardContent>
            </form>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-lg flex items-center gap-2">
                <History size={18} className="text-slate-400" /> Recent History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {complaint.ComplaintHistories && complaint.ComplaintHistories.length > 0 ? (
                <div className="space-y-4">
                  {complaint.ComplaintHistories.map((item, i) => (
                    <div key={item.id || i} className="flex gap-3 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5" />
                      <div>
                        <p className="font-bold capitalize">{item.status === 'in_progress' ? 'Assigned' : item.status}</p>
                        <p className="text-slate-500 text-xs">{new Date(item.changed_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center">No history logs recorded.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
