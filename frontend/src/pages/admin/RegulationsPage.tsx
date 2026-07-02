// =========================================================================
// RegulationsPage.tsx
// Route: /admin/regulations
// List + add (article number, content, type, faculty_id) + hard delete.
// =========================================================================

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { getRegulations, addRegulation, deleteRegulation, uploadRegulationPdf, getApiErrorMessage, type Regulation } from "@/api/adminApi";
import {
  PageHeader,
  Card,
  Button,
  Field,
  TextInput,
  TextArea,
  Select,
  Modal,
  Badge,
  EmptyState,
  LoadingState,
  Banner,
} from "./adminUi";

const REGULATION_TYPES = ["academic", "disciplinary", "financial", "administrative", "other"];

const emptyForm = { article_number: "", content: "", type: REGULATION_TYPES[0], faculty_id: undefined as number | undefined };

export default function RegulationsPage() {
  const [regulations, setRegulations] = useState<Regulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [deletingReg, setDeletingReg] = useState<Regulation | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPdf(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await uploadRegulationPdf(file);
      setSuccess(`PDF regulation uploaded and parsed successfully. Chunk count: ${res.parsed_chunks_count || 0}`);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to upload regulation PDF."));
    } finally {
      setUploadingPdf(false);
      e.target.value = "";
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setRegulations(await getRegulations());
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load regulations."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      await addRegulation(form);
      setSuccess(`Regulation ${form.article_number} added.`);
      setCreateOpen(false);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to add regulation."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingReg) return;
    setSaving(true);
    setError(null);
    try {
      await deleteRegulation(deletingReg.id);
      setSuccess(`Regulation ${deletingReg.article_number} deleted.`);
      setDeletingReg(null);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to delete regulation."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Regulations"
        description="University regulations referenced by category and ticket routing."
        action={
          <div className="flex gap-2">
            <label className="inline-flex items-center justify-center gap-2 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed h-11 px-6 text-sm bg-secondary text-secondary-foreground hover:opacity-85 cursor-pointer">
              {uploadingPdf ? "Uploading..." : "Upload PDF"}
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handlePdfUpload}
                disabled={uploadingPdf}
              />
            </label>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> New regulation
            </Button>
          </div>
        }
      />

      {error && <Banner tone="error" onDismiss={() => setError(null)}>{error}</Banner>}
      {success && <Banner tone="success" onDismiss={() => setSuccess(null)}>{success}</Banner>}

      <Card>
        {loading ? (
          <LoadingState label="Loading regulations…" />
        ) : regulations.length === 0 ? (
          <EmptyState title="No regulations yet" description="Add the first regulation to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left  font-bold text-muted-foreground uppercase tracking-widest">
                  <th className="px-4 py-3 font-medium">Article</th>
                  <th className="px-4 py-3 font-medium">Content</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {regulations.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/40 align-top">
                    <td className="px-4 py-3 font-bold text-foreground whitespace-nowrap">{r.article_number}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xl">{r.content}</td>
                    <td className="px-4 py-3">
                      <Badge>{r.type}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setDeletingReg(r)}>
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New regulation"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={saving} disabled={!form.article_number || !form.content}>
              Add regulation
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Article number" required>
            <TextInput
              placeholder="e.g. Art. 42"
              value={form.article_number}
              onChange={(e) => setForm({ ...form, article_number: e.target.value })}
            />
          </Field>
          <Field label="Content" required>
            <TextArea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          </Field>
          <Field label="Type" required>
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {REGULATION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Faculty ID" hint="Defaults to the platform's default faculty if left blank.">
            <TextInput
              type="number"
              value={form.faculty_id ?? ""}
              onChange={(e) => setForm({ ...form, faculty_id: Number(e.target.value) || undefined })}
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={!!deletingReg}
        onClose={() => setDeletingReg(null)}
        title="Delete regulation"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeletingReg(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} loading={saving}>
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          This permanently deletes <strong className="text-foreground">{deletingReg?.article_number}</strong>. This
          cannot be undone.
        </p>
      </Modal>
    </div>
  );
}