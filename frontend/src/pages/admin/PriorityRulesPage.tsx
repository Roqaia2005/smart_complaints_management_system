// =========================================================================
// PriorityRulesPage.tsx
// Route: /admin/priority-rules
// List existing rules + a single save form that creates or edits, since
// the backend upserts by priority_level.
// =========================================================================

import { useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { getPriorityRules, savePriorityRule, getApiErrorMessage, type PriorityRule } from "@/api/adminApi";
import {
  PageHeader,
  Card,
  Button,
  Field,
  TextInput,
  TextArea,
  TagInput,
  Modal,
  Badge,
  EmptyState,
  LoadingState,
  Banner,
} from "./adminUi";

const emptyForm = { priority_level: 1, description: "", examples: [] as string[] };

export default function PriorityRulesPage() {
  const [rules, setRules] = useState<PriorityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getPriorityRules();
      setRules(data.sort((a, b) => a.priority_level - b.priority_level));
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load priority rules."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditingLevel(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(rule: PriorityRule) {
    setEditingLevel(rule.priority_level);
    setForm({ priority_level: rule.priority_level, description: rule.description, examples: rule.examples ?? [] });
    setFormOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await savePriorityRule(form);
      setSuccess(`Priority level ${form.priority_level} saved.`);
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to save priority rule."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Priority rules"
        description="Define how incoming tickets are scored by urgency level."
        action={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> New rule
          </Button>
        }
      />

      {error && <Banner tone="error" onDismiss={() => setError(null)}>{error}</Banner>}
      {success && <Banner tone="success" onDismiss={() => setSuccess(null)}>{success}</Banner>}

      {loading ? (
        <Card>
          <LoadingState label="Loading priority rules…" />
        </Card>
      ) : rules.length === 0 ? (
        <Card>
          <EmptyState title="No priority rules yet" description="Define level 1 as your highest urgency to start." />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rules.map((rule) => (
            <Card key={rule.priority_level} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <Badge tone="accent">Priority {rule.priority_level}</Badge>
                <Button variant="ghost" size="sm" onClick={() => openEdit(rule)}>
                  <Pencil className="size-3.5" />
                </Button>
              </div>
              <p className="font-bold text-foreground mb-3">{rule.description}</p>
              {rule.examples?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {rule.examples.map((ex, i) => (
                    <Badge key={i}>{ex}</Badge>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingLevel !== null ? `Edit priority ${editingLevel}` : "New priority rule"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.description}>
              Save rule
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Priority level" required hint="Saving an existing level overwrites that rule.">
            <TextInput
              type="number"
              min={1}
              value={form.priority_level}
              onChange={(e) => setForm({ ...form, priority_level: Number(e.target.value) || 1 })}
              disabled={editingLevel !== null}
            />
          </Field>
          <Field label="Description" required>
            <TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Examples" hint="Press Enter or comma to add an example.">
            <TagInput values={form.examples} onChange={(examples) => setForm({ ...form, examples })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
