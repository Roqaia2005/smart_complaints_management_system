import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Search,
  ChevronRight,
} from 'lucide-react';
import { superAdminApi } from '@/api/services';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RegistrationRequest {
  id: number;
  full_name: string;
  email: string;
  faculty_name: string;
  university_name: string;
  email_domain: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  rejection_reason?: string | null;
  createdAt: string;
}

type StatusFilter = 'All' | 'Pending' | 'Approved' | 'Rejected';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_TABS: StatusFilter[] = ['All', 'Pending', 'Approved', 'Rejected'];

const STATUS_BADGE: Record<string, { variant: 'success' | 'destructive' | 'secondary' | 'warning'; label: string }> = {
  Pending:  { variant: 'warning',     label: 'Pending'  },
  Approved: { variant: 'success',     label: 'Approved' },
  Rejected: { variant: 'destructive', label: 'Rejected' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function LoadingOverlay() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="animate-spin text-primary" size={32} />
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <span>{message}</span>
      <button onClick={onRetry} className="ml-4 underline underline-offset-2 hover:no-underline">
        Retry
      </button>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <FileText size={40} className="mb-3 opacity-30" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

/** Reject reason modal */
function RejectModal({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-background p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Reject Registration Request</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Please provide a reason for rejection. This will be sent to the applicant by email.
        </p>
        <textarea
          className="mt-4 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          rows={4}
          placeholder="e.g. Invalid faculty domain, duplicate request…"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim() || loading}
            className="flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Reject Request
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RequestsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = (searchParams.get('status') as StatusFilter) || 'All';

  const [requests, setRequests]         = useState<RegistrationRequest[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [search, setSearch]             = useState('');

  // Per-row action state
  const [approvingId, setApprovingId]   = useState<number | null>(null);
  const [rejectTarget, setRejectTarget] = useState<RegistrationRequest | null>(null);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [actionError, setActionError]   = useState<string | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await superAdminApi.getAllRequests();
      setRequests(res.data.requests ?? []);
    } catch {
      setError('Failed to load registration requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  // ── Filter logic ──────────────────────────────────────────────────────────
  const handleTabChange = (tab: StatusFilter) => {
    if (tab === 'All') searchParams.delete('status');
    else searchParams.set('status', tab);
    setSearchParams(searchParams);
    setSearch('');
    setActionError(null);
  };

  const displayed = useMemo(() => {
    let list = [...requests];
    if (statusFilter !== 'All') {
      list = list.filter(r => r.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.full_name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.faculty_name.toLowerCase().includes(q) ||
        r.university_name.toLowerCase().includes(q),
      );
    }
    return list;
  }, [requests, statusFilter, search]);

  const pendingCount = requests.filter(r => r.status === 'Pending').length;

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleApprove = async (req: RegistrationRequest) => {
    setApprovingId(req.id);
    setActionError(null);
    try {
      await superAdminApi.approveRequest(req.id);
      // optimistic update
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'Approved' } : r));
    } catch (err: any) {
      setActionError(err?.response?.data?.error ?? 'Failed to approve request.');
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!rejectTarget) return;
    setRejectLoading(true);
    setActionError(null);
    try {
      await superAdminApi.rejectRequest(rejectTarget.id, { rejection_reason: reason });
      setRequests(prev =>
        prev.map(r =>
          r.id === rejectTarget.id
            ? { ...r, status: 'Rejected', rejection_reason: reason }
            : r,
        ),
      );
      setRejectTarget(null);
    } catch (err: any) {
      setActionError(err?.response?.data?.error ?? 'Failed to reject request.');
    } finally {
      setRejectLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Reject Modal */}
      {rejectTarget && (
        <RejectModal
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectTarget(null)}
          loading={rejectLoading}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Registration Requests</h1>
          <p className="text-muted-foreground">
            Review and manage admin registration requests from faculty institutions
          </p>
        </div>

        {/* Summary KPI row */}
        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total Requests',   value: requests.length,                                        icon: FileText,    color: '#3b82f6' },
              { label: 'Pending Review',   value: pendingCount,                                           icon: Clock,       color: '#f59e0b' },
              { label: 'Approved',         value: requests.filter(r => r.status === 'Approved').length,   icon: CheckCircle, color: '#10b981' },
            ].map((kpi, i) => (
              <Card key={i}>
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="p-2 rounded-lg" style={{ background: `${kpi.color}18` }}>
                    <kpi.icon size={20} style={{ color: kpi.color }} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{kpi.label}</p>
                    <p className="text-2xl font-bold">{kpi.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Tabs + Search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
            {STATUS_TABS.map(tab => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  statusFilter === tab
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab}
                {tab === 'Pending' && pendingCount > 0 && (
                  <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search requests…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Action error */}
        {actionError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {actionError}
          </div>
        )}

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <LoadingOverlay />
            ) : error ? (
              <div className="p-6">
                <ErrorBanner message={error} onRetry={fetchRequests} />
              </div>
            ) : displayed.length === 0 ? (
              <EmptyState label={search ? `No requests match "${search}".` : 'No requests found.'} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Applicant</th>
                      <th className="px-4 py-3 font-medium">Faculty / University</th>
                      <th className="px-4 py-3 font-medium">Email Domain</th>
                      <th className="px-4 py-3 font-medium">Submitted</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map(req => (
                      <tr key={req.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium">{req.full_name}</p>
                          <p className="text-xs text-muted-foreground">{req.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{req.faculty_name}</p>
                          <p className="text-xs text-muted-foreground">{req.university_name}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                          {req.email_domain}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                          {new Date(req.createdAt).toLocaleDateString('en-GB', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_BADGE[req.status]?.variant ?? 'secondary'}>
                            {STATUS_BADGE[req.status]?.label ?? req.status}
                          </Badge>
                          {req.status === 'Rejected' && req.rejection_reason && (
                            <p className="mt-1 text-xs text-muted-foreground max-w-[180px] truncate" title={req.rejection_reason}>
                              {req.rejection_reason}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {/* View detail */}
                            <button
                              onClick={() => navigate(`/superadmin/requests/${req.id}`)}
                              className="flex items-center gap-1 rounded-md border border-input px-2.5 py-1 text-xs font-medium hover:bg-muted transition-colors"
                            >
                              <Eye size={12} /> View
                            </button>

                            {/* Approve — only for Pending */}
                            {req.status === 'Pending' && (
                              <>
                                <button
                                  onClick={() => handleApprove(req)}
                                  disabled={approvingId === req.id}
                                  className="flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                >
                                  {approvingId === req.id
                                    ? <Loader2 size={12} className="animate-spin" />
                                    : <CheckCircle size={12} />}
                                  Approve
                                </button>
                                <button
                                  onClick={() => { setRejectTarget(req); setActionError(null); }}
                                  disabled={approvingId === req.id}
                                  className="flex items-center gap-1 rounded-md bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                                >
                                  <XCircle size={12} /> Reject
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}