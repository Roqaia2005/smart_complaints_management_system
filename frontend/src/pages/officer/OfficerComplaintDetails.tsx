import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  ArrowLeft,
  Brain,
  User as UserIcon,
  History,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Calendar,
  MapPin,
  ArrowUpRight,
  Search,
  X,
  UserCheck
} from 'lucide-react';
import { officerApi } from '../../api/services';
import { cn } from '../../lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const priorityMap: Record<number, { label: string; color: string }> = {
  5: { label: 'Critical', color: 'bg-rose-500/15 text-rose-500 border-rose-500/20' },
  4: { label: 'High',     color: 'bg-orange-500/15 text-orange-500 border-orange-500/20' },
  3: { label: 'Medium',   color: 'bg-blue-500/15 text-blue-500 border-blue-500/20' },
  2: { label: 'Low',      color: 'bg-slate-500/15 text-slate-500 border-slate-500/20' },
  1: { label: 'Info',     color: 'bg-slate-400/15 text-slate-400 border-slate-400/20' },
};

const statusInfoMap: Record<string, { label: string; color: string }> = {
  pending:     { label: 'Pending',     color: 'bg-amber-500/15 text-amber-500 border-amber-500/20' },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/15 text-blue-500 border-blue-500/20' },
  resolved:    { label: 'Resolved',    color: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20' },
  appealed:    { label: 'Appealed',    color: 'bg-orange-500/15 text-orange-500 border-orange-500/20' },
};

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface Officer {
  id: number;
  full_name: string;
  email: string;
  role: string;
}

// ─── Escalate Modal ───────────────────────────────────────────────────────────

interface EscalateModalProps {
  complaintId: number;
  complaintProblem: string;
  onClose: () => void;
  onSuccess: () => void;
}

function EscalateModal({ complaintId, complaintProblem, onClose, onSuccess }: EscalateModalProps) {
  const [officers, setOfficers]     = useState<Officer[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [search, setSearch]         = useState('');

  useEffect(() => {
    officerApi.getAllOfficers()
      .then(res =>{
        console.log(res)
        setOfficers(res.data.data?.officers ?? [])} )
      .catch(() => setError('Failed to load officers list.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = officers.filter(o =>
    o.full_name.toLowerCase().includes(search.toLowerCase()) ||
    o.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleEscalate = async () => {
  if (!selectedId) return;
  setSubmitting(true);
  setError(null);
  try {
    await officerApi.escalateComplaint(complaintId, selectedId);
    onSuccess();
  } catch (err: any) {
    setError(err?.response?.data?.error ?? 'Failed to escalate complaint.');
    setSubmitting(false);
  }
};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <ArrowUpRight size={16} className="text-blue-500" />
              Escalate Complaint
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">
              #{complaintId} — {complaintProblem}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Select an officer to escalate this complaint to. They will be notified to take over.
          </p>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm border-slate-200 dark:border-slate-700"
            />
          </div>

          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={20} className="animate-spin text-slate-400" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">
                {search ? `No officers match "${search}".` : 'No officers available.'}
              </div>
            ) : (
              filtered.map(officer => (
                <button
                  key={officer.id}
                  onClick={() => setSelectedId(officer.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                    selectedId === officer.id
                      ? 'bg-blue-50 dark:bg-blue-950/40'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  )}
                >
                  <div className={cn(
                    'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    selectedId === officer.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  )}>
                    {officer.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-sm font-semibold truncate',
                      selectedId === officer.id
                        ? 'text-blue-700 dark:text-blue-400'
                        : 'text-slate-800 dark:text-slate-200'
                    )}>
                      {officer.full_name}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{officer.email}</p>
                  </div>
                  {selectedId === officer.id && (
                    <UserCheck size={15} className="text-blue-600 flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 px-3 py-2 text-xs text-rose-700 dark:text-rose-400">
              <AlertTriangle size={13} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleEscalate}
            disabled={!selectedId || submitting || loading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2"
          >
            {submitting && <Loader2 size={13} className="animate-spin" />}
            <ArrowUpRight size={13} />
            Escalate
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

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

  // Escalation state
  const [showEscalate, setShowEscalate] = useState(false);
  const [escalateSuccess, setEscalateSuccess] = useState(false);

  const fetchDetails = React.useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await officerApi.getComplaintDetails(id);
      const data = res.data;
      setComplaint(data.complaint);
      setStudent(data.student);

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
      await fetchDetails();
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

  const handleEscalateSuccess = async () => {
    setShowEscalate(false);
    setEscalateSuccess(true);
    await fetchDetails();
    setTimeout(() => setEscalateSuccess(false), 3000);
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
  const isEscalatable = complaint.status === 'pending' || complaint.status === 'in_progress';

  return (
    <>
      {showEscalate && (
        <EscalateModal
          complaintId={complaint.id}
          complaintProblem={complaint.problem}
          onClose={() => setShowEscalate(false)}
          onSuccess={handleEscalateSuccess}
        />
      )}

      <div className="max-w-6xl mx-auto space-y-8 animate-in">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/officer/dashboards')}>
            <ArrowLeft size={18} className="mr-2" /> Back to Dashboard
          </Button>

          {/* Escalate action — only for actionable statuses */}
          {isEscalatable && (
            <Button
              variant="outline"
              onClick={() => setShowEscalate(true)}
              className="font-bold text-amber-600 border-amber-300 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-900 dark:hover:bg-amber-950/20 gap-2"
            >
              <ArrowUpRight size={16} />
              Escalate to Officer
            </Button>
          )}
        </div>

        {/* Escalation success flash */}
        {escalateSuccess && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900">
            <UserCheck className="text-emerald-600" size={18} />
            <p className="text-emerald-700 dark:text-emerald-400 font-medium text-sm">
              Complaint escalated successfully.
            </p>
          </div>
        )}

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

            {complaint.ai_summary && (
              <Card className="border-blue-100 dark:border-blue-900 ">
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
                      <span>Happened Since: <strong>{complaint.since}  </strong></span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

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
    </>
  );
}