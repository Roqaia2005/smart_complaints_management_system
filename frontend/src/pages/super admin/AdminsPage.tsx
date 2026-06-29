import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
  Search,
  Users,
  Building2,
  ShieldOff,
  UserCheck,
  UserX,
  GraduationCap,
  Globe,
  AlertTriangle,
} from 'lucide-react';
import { superAdminApi } from '@/api/services';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Faculty {
  id: number;
  name: string;
  email_domain: string;
  University?: {
    id: number;
    name: string;
  };
}

interface Admin {
  id: number;
  full_name: string;
  email: string;
  is_active: boolean;
  faculty_id: number;
  createdAt: string;
  Faculty?: Faculty;
}

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
      <Users size={40} className="mb-3 opacity-30" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

/** Deactivate confirmation modal */
function ConfirmModal({
  admin,
  onConfirm,
  onCancel,
  loading,
}: {
  admin: Admin;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-background p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-destructive/10">
            <AlertTriangle size={20} className="text-destructive" />
          </div>
          <h2 className="text-base font-semibold">Deactivate Admin</h2>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Are you sure you want to deactivate{' '}
          <span className="font-medium text-foreground">{admin.full_name}</span>?
          They will no longer be able to log in. This action can be reversed by reapproving their request.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Deactivate
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Admin Card (mobile-friendly tile) ───────────────────────────────────────

function AdminCard({
  admin,
  onDeactivate,
  deactivatingId,
}: {
  admin: Admin;
  onDeactivate: (admin: Admin) => void;
  deactivatingId: number | null;
}) {
  const isDeactivating = deactivatingId === admin.id;

  return (
    <Card className={`transition-opacity ${!admin.is_active ? 'opacity-60' : ''}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          {/* Avatar + name */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {admin.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold leading-tight">{admin.full_name}</p>
              <p className="text-xs text-muted-foreground">{admin.email}</p>
            </div>
          </div>

          {/* Status badge */}
          <Badge variant={admin.is_active ? 'success' : 'secondary'} className="flex-shrink-0">
            {admin.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        {/* Faculty / University info */}
        <div className="mt-4 space-y-1.5">
          {admin.Faculty && (
            <>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <GraduationCap size={12} className="flex-shrink-0" />
                <span className="truncate">{admin.Faculty.name}</span>
              </div>
              {admin.Faculty.University && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Building2 size={12} className="flex-shrink-0" />
                  <span className="truncate">{admin.Faculty.University.name}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                <Globe size={12} className="flex-shrink-0" />
                <span>{admin.Faculty.email_domain}</span>
              </div>
            </>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Joined {new Date(admin.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>

        {/* Deactivate button */}
        {admin.is_active && (
          <button
            onClick={() => onDeactivate(admin)}
            disabled={isDeactivating}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
          >
            {isDeactivating
              ? <Loader2 size={12} className="animate-spin" />
              : <ShieldOff size={12} />}
            Deactivate Admin
          </button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminsPage() {
  const [admins,       setAdmins]       = useState<Admin[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [search,       setSearch]       = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [confirmTarget,  setConfirmTarget]  = useState<Admin | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<number | null>(null);
  const [actionError,    setActionError]    = useState<string | null>(null);
  const [actionSuccess,  setActionSuccess]  = useState<string | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await superAdminApi.getAllAdmins();
      console.log('Fetched admins:', res);
      setAdmins(res.data.admins ?? []);
    } catch {
      setError('Failed to load admins.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  // ── Filter ────────────────────────────────────────────────────────────────
  const displayed = useMemo(() => {
    let list = [...admins];
    if (activeFilter === 'active')   list = list.filter(a => a.is_active);
    if (activeFilter === 'inactive') list = list.filter(a => !a.is_active);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.full_name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.Faculty?.name.toLowerCase().includes(q) ||
        a.Faculty?.University?.name.toLowerCase().includes(q),
      );
    }
    return list;
  }, [admins, activeFilter, search]);

  // ── Deactivate ────────────────────────────────────────────────────────────
  const handleDeactivateConfirm = async () => {
    if (!confirmTarget) return;
    setDeactivatingId(confirmTarget.id);
    setActionError(null);
    try {
      await superAdminApi.deleteAdmin(confirmTarget.id);
      setAdmins(prev => prev.map(a => a.id === confirmTarget.id ? { ...a, is_active: false } : a));
      setActionSuccess(`${confirmTarget.full_name} has been deactivated.`);
      setConfirmTarget(null);
    } catch (err: any) {
      setActionError(err?.response?.data?.error ?? 'Failed to deactivate admin.');
    } finally {
      setDeactivatingId(null);
    }
  };

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const activeCount   = admins.filter(a => a.is_active).length;
  const inactiveCount = admins.filter(a => !a.is_active).length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {confirmTarget && (
        <ConfirmModal
          admin={confirmTarget}
          onConfirm={handleDeactivateConfirm}
          onCancel={() => setConfirmTarget(null)}
          loading={deactivatingId === confirmTarget.id}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Admin Management</h1>
          <p className="text-muted-foreground">
            View and manage approved faculty administrators across all institutions
          </p>
        </div>

        {/* KPI row */}
        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total Admins',    value: admins.length,  icon: Users,      color: '#3b82f6' },
              { label: 'Active',          value: activeCount,    icon: UserCheck,  color: '#10b981' },
              { label: 'Inactive',        value: inactiveCount,  icon: UserX,      color: '#ef4444' },
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

        {/* Filters + Search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
            {(['all', 'active', 'inactive'] as const).map(f => (
              <button
                key={f}
                onClick={() => { setActiveFilter(f); setActionError(null); setActionSuccess(null); }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                  activeFilter === f
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search admins…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Feedback banners */}
        {actionSuccess && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <UserX size={15} className="flex-shrink-0" />
            {actionSuccess}
          </div>
        )}
        {actionError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {actionError}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <LoadingOverlay />
        ) : error ? (
          <ErrorBanner message={error} onRetry={fetchAdmins} />
        ) : displayed.length === 0 ? (
          <EmptyState
            label={
              search
                ? `No admins match "${search}".`
                : activeFilter !== 'all'
                  ? `No ${activeFilter} admins found.`
                  : 'No admins found.'
            }
          />
        ) : (
          <>
            {/* Result count */}
            <p className="text-sm text-muted-foreground">
              Showing {displayed.length} admin{displayed.length !== 1 ? 's' : ''}
              {search && ` matching "${search}"`}
            </p>

            {/* Card grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {displayed.map(admin => (
                <AdminCard
                  key={admin.id}
                  admin={admin}
                  onDeactivate={a => { setConfirmTarget(a); setActionError(null); setActionSuccess(null); }}
                  deactivatingId={deactivatingId}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
