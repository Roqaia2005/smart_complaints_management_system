import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  ArrowLeft,
  User,
  Mail,
  Building2,
  GraduationCap,
  Globe,
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
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
  updatedAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  Pending:  { variant: 'warning'     as const, icon: AlertTriangle, color: '#f59e0b' },
  Approved: { variant: 'success'     as const, icon: CheckCircle,   color: '#10b981' },
  Rejected: { variant: 'destructive' as const, icon: XCircle,       color: '#ef4444' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0">
      <div className="mt-0.5 p-1.5 rounded-md bg-muted">
        <Icon size={14} className="text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="mt-0.5 text-sm font-medium break-all">{value}</p>
      </div>
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
          Provide a reason for rejection. This will be emailed to the applicant.
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
            Confirm Rejection
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [request, setRequest]         = useState<RegistrationRequest | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState(false);
  const [showReject, setShowReject]   = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchRequest = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await superAdminApi.getRequest(Number(id));
      setRequest(res.data.request);
    } catch {
      setError('Failed to load request details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchRequest(); }, [fetchRequest]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!request) return;
    setApprovingId(true);
    setActionError(null);
    try {
      await superAdminApi.approveRequest(request.id);
      setRequest(prev => prev ? { ...prev, status: 'Approved' } : prev);
      setActionSuccess('Request approved successfully. A confirmation email has been sent.');
    } catch (err: any) {
      setActionError(err?.response?.data?.error ?? 'Failed to approve request.');
    } finally {
      setApprovingId(false);
    }
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!request) return;
    setRejectLoading(true);
    setActionError(null);
    try {
      await superAdminApi.rejectRequest(request.id, { rejection_reason: reason });
      setRequest(prev =>
        prev ? { ...prev, status: 'Rejected', rejection_reason: reason } : prev,
      );
      setShowReject(false);
      setActionSuccess('Request rejected. The applicant has been notified by email.');
    } catch (err: any) {
      setActionError(err?.response?.data?.error ?? 'Failed to reject request.');
    } finally {
      setRejectLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const statusStyle = request ? STATUS_STYLES[request.status] : null;

  return (
    <>
      {showReject && (
        <RejectModal
          onConfirm={handleRejectConfirm}
          onCancel={() => setShowReject(false)}
          loading={rejectLoading}
        />
      )}

      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Back */}
        <button
          onClick={() => navigate('/superadmin/requests')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} /> Back to Requests
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : request ? (
          <>
            {/* Header card */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl">{request.full_name}</CardTitle>
                    <CardDescription className="mt-0.5">{request.email}</CardDescription>
                  </div>
                  {statusStyle && (
                    <Badge variant={statusStyle.variant} className="gap-1.5 px-3 py-1 text-sm flex-shrink-0">
                      <statusStyle.icon size={13} />
                      {request.status}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-0">
                <InfoRow icon={User}          label="Full Name"         value={request.full_name} />
                <InfoRow icon={Mail}          label="Email Address"     value={request.email} />
                <InfoRow icon={GraduationCap} label="Faculty"           value={request.faculty_name} />
                <InfoRow icon={Building2}     label="University"        value={request.university_name} />
                <InfoRow icon={Globe}         label="Email Domain"      value={`${request.email_domain}`} />
                <InfoRow
                  icon={Calendar}
                  label="Submitted"
                  value={new Date(request.createdAt).toLocaleDateString('en-GB', {
                    day: '2-digit', month: 'long', year: 'numeric',
                  })}
                />
                {request.status !== 'Pending' && (
                  <InfoRow
                    icon={Calendar}
                    label="Last Updated"
                    value={new Date(request.updatedAt).toLocaleDateString('en-GB', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })}
                  />
                )}
              </CardContent>
            </Card>

            {/* Rejection reason card */}
            {request.status === 'Rejected' && request.rejection_reason && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="p-5 flex gap-3">
                  <XCircle size={18} className="text-destructive mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-destructive">Rejection Reason</p>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      {request.rejection_reason}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Feedback banners */}
            {actionSuccess && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <CheckCircle size={16} className="flex-shrink-0" />
                {actionSuccess}
              </div>
            )}
            {actionError && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {actionError}
              </div>
            )}

            {/* Action buttons — only for Pending */}
            {request.status === 'Pending' && (
              <div className="flex gap-3">
                <button
                  onClick={handleApprove}
                  disabled={approvingId}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {approvingId
                    ? <Loader2 size={16} className="animate-spin" />
                    : <CheckCircle size={16} />}
                  Approve Request
                </button>
                <button
                  onClick={() => { setShowReject(true); setActionError(null); }}
                  disabled={approvingId}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-destructive bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
                >
                  <XCircle size={16} />
                  Reject Request
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </>
  );
}
