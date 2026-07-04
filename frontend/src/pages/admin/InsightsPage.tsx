// =========================================================================
// InsightsPage.tsx
// Route: /admin/insights
// No dedicated backend endpoint exists for this yet — this page aggregates
// data already exposed by /admin/categories, /admin/users,
// /admin/priority-rules, and /admin/audit-logs. If this view grows beyond
// simple counts, ask the backend team for a real analytics endpoint
// instead of pulling full tables down on every load.
// =========================================================================

import { useEffect, useMemo, useState } from "react";
import { Users, FolderKanban, ListChecks, AlertTriangle } from "lucide-react";
import {
  getUsers,
  getCategories,
  getPriorityRules,
  getAuditLogs,
  getApiErrorMessage,
  type AdminUser,
  type AdminCategory,
  type PriorityRule,
  type AuditLogEntry,
} from "@/api/adminApi";
import { PageHeader, Card, Badge, LoadingState, Banner, EmptyState } from "./adminUi";

export default function InsightsPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [rules, setRules] = useState<PriorityRule[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [u, c, r, l] = await Promise.all([
          getUsers(),
          getCategories(),
          getPriorityRules(),
          getAuditLogs(),
        ]);
        setUsers(u);
        setCategories(c);
        setRules(r);
        setRecentLogs(l.slice(0, 8));
      } catch (err) {
        setError(getApiErrorMessage(err, "Failed to load insights."));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const userStats = useMemo(() => {
    const active = users.filter((u) => u.is_active).length;
    const byRole = { student: 0, officer: 0, manager: 0 };
    for (const u of users) byRole[u.role]++;
    return { total: users.length, active, inactive: users.length - active, byRole };
  }, [users]);

  const categoryStats = useMemo(() => {
    const active = categories.filter((c) => c.is_active).length;
    const unstaffed = categories.filter((c) => !c.officers || c.officers.length === 0);
    return { total: categories.length, active, inactive: categories.length - active, unstaffed };
  }, [categories]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Insights" description="A quick read on the health of the helpdesk system." />
        <Card>
          <LoadingState label="Aggregating data…" />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Insights" description="A quick read on the health of the helpdesk system." />

      {error && <Banner tone="error" onDismiss={() => setError(null)}>{error}</Banner>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard icon={Users} label="Total users" value={userStats.total} sub={`${userStats.active} active`} />
        <StatCard
          icon={FolderKanban}
          label="Categories"
          value={categoryStats.total}
          sub={`${categoryStats.active} active`}
        />
        <StatCard icon={ListChecks} label="Priority rules" value={rules.length} />
        <StatCard
          icon={AlertTriangle}
          label="Unstaffed categories"
          value={categoryStats.unstaffed.length}
          tone={categoryStats.unstaffed.length > 0 ? "destructive" : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Users by role</h3>
          <div className="space-y-3">
            <RoleBar label="Students" value={userStats.byRole.student} total={userStats.total} />
            <RoleBar label="Officers" value={userStats.byRole.officer} total={userStats.total} />
            <RoleBar label="Managers" value={userStats.byRole.manager} total={userStats.total} />
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Categories needing an officer</h3>
          {categoryStats.unstaffed.length === 0 ? (
            <EmptyState title="Every category is staffed" />
          ) : (
            <ul className="space-y-2">
              {categoryStats.unstaffed.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{c.name}</span>
                  <Badge tone="destructive">No officers</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

     
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  sub?: string;
  tone?: "destructive";
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
        <Icon className={`size-4 ${tone === "destructive" ? "text-destructive" : "text-muted-foreground"}`} />
      </div>
      <p className={`text-2xl font-semibold ${tone === "destructive" ? "text-destructive" : "text-foreground"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </Card>
  );
}

function RoleBar({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-foreground font-medium">{label}</span>
        <span className="text-muted-foreground">
          {value} ({pct}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
