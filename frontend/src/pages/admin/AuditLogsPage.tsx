// =========================================================================
// AuditLogsPage.tsx
// Route: /admin/audit-logs
// Read-only filterable table — filters: user_id, entity_type, date range.
// Pure GET with query params, no create/edit/delete.
// =========================================================================

import { useEffect, useState } from "react";
import { Filter, RotateCcw } from "lucide-react";
import { getAuditLogs, getApiErrorMessage, type AuditLogEntry, type AuditLogFilters } from "@/api/adminApi";
import { PageHeader, Card, Button, Field, TextInput, Select, Badge, EmptyState, LoadingState, Banner } from "./adminUi";

const ENTITY_TYPES = ["category", "user", "regulation", "priority_rule", "ticket"];

const emptyFilters: AuditLogFilters = { user_id: "", entity_type: "", from: "", to: "" };

const ACTION_TONE: Record<string, "success" | "destructive" | "default"> = {
  create: "success",
  delete: "destructive",
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AuditLogFilters>(emptyFilters);

  async function load(activeFilters: AuditLogFilters = filters) {
    setLoading(true);
    setError(null);
    try {
      const cleaned = Object.fromEntries(
        Object.entries(activeFilters).filter(([, v]) => v !== "" && v !== undefined)
      ) as AuditLogFilters;
      setLogs(await getAuditLogs(cleaned));
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load audit logs."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(emptyFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleReset() {
    setFilters(emptyFilters);
    load(emptyFilters);
  }

  return (
    <div>
      <PageHeader title="Audit logs" description="A read-only trail of admin and system actions, newest first." />

      {error && <Banner tone="error" onDismiss={() => setError(null)}>{error}</Banner>}

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-5 sm:items-end">
          <Field label="User ID">
            <TextInput
              placeholder="e.g. 14"
              value={filters.user_id ?? ""}
              onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
            />
          </Field>
          <Field label="Entity type">
            <Select
              value={filters.entity_type ?? ""}
              onChange={(e) => setFilters({ ...filters, entity_type: e.target.value })}
            >
              <option value="">All</option>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="From">
            <TextInput
              type="date"
              value={filters.from ?? ""}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            />
          </Field>
          <Field label="To">
            <TextInput
              type="date"
              value={filters.to ?? ""}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            />
          </Field>
          <div className="flex gap-2">
            <Button onClick={() => load()} className="flex-1">
              <Filter className="size-4" /> Apply
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw className="size-4" />
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        {loading ? (
          <LoadingState label="Loading audit logs…" />
        ) : logs.length === 0 ? (
          <EmptyState title="No matching log entries" description="Try widening your filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left  font-bold text-muted-foreground uppercase tracking-widest">
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Entity</th>
                  <th className="px-4 py-3 font-medium">Entity ID</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={i} className="border-b border-border  last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap ">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-bold text-foreground">{log.user_name}</td>
                    <td className="px-4 py-3">
                      <Badge tone={ACTION_TONE[log.action] ?? "default"}>{log.action}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{log.entity_type}</td>
                    <td className="px-4 py-3 text-muted-foreground">#{log.entity_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}