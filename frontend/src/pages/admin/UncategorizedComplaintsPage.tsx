import { useEffect, useState } from "react";
import { FolderInput, ArrowRightLeft } from "lucide-react";
import {
  getUncategorizedComplaints,
  getCategories,
  reassignComplaint,
  createCategoryAndReassign,
  getApiErrorMessage,
  type UncategorizedComplaint,
  type AdminCategory,
} from "@/api/adminApi";
import {
  PageHeader,
  Card,
  Badge,
  EmptyState,
  LoadingState,
  Banner,
  Button,
  Modal,
  Field,
  Select,
} from "./adminUi";

export default function UncategorizedComplaintsPage() {
  const [complaints, setComplaints] = useState<UncategorizedComplaint[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [reassigningComplaint, setReassigningComplaint] = useState<UncategorizedComplaint | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  // "existing" reassigns to a category already in the list; "new" creates
  // a brand new category and reassigns to it in one step.
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [newCategorySlaHours, setNewCategorySlaHours] = useState<number | "">("");
  const [newCategoryKeywords, setNewCategoryKeywords] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const complaintsData = await getUncategorizedComplaints();
      setComplaints(complaintsData);

      const catsData = await getCategories();
      // Filter out the 'Other' category itself so we don't reassign back to Other
      setCategories(catsData.filter(c => !c.name.toLowerCase().includes("other") && c.is_active));
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load uncategorized complaints."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openReassign(complaint: UncategorizedComplaint) {
    setReassigningComplaint(complaint);
    setSelectedCategoryId(categories[0]?.id || 0);
    setMode("existing");
    setNewCategoryName("");
    setNewCategoryDescription("");
    setNewCategorySlaHours("");
    setNewCategoryKeywords("");
  }

  async function handleReassign() {
    if (!reassigningComplaint) return;

    if (mode === "existing") {
      if (!selectedCategoryId) return;
      setSaving(true);
      setError(null);
      setSuccess(null);
      try {
        const res = await reassignComplaint(reassigningComplaint.id, selectedCategoryId);
        const catName = res.new_category_name || "new category";
        setSuccess(`Complaint #${reassigningComplaint.id} successfully reassigned to "${catName}".`);
        setReassigningComplaint(null);
        await load();
      } catch (err) {
        setError(getApiErrorMessage(err, "Failed to reassign complaint."));
      } finally {
        setSaving(false);
      }
      return;
    }

    // mode === "new"
    if (!newCategoryName.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await createCategoryAndReassign(reassigningComplaint.id, {
        name: newCategoryName.trim(),
        description: newCategoryDescription.trim() || undefined,
        sla_hours: newCategorySlaHours === "" ? undefined : Number(newCategorySlaHours),
        keywords: newCategoryKeywords.trim() || undefined,
      });
      setSuccess(`Complaint #${reassigningComplaint.id} reassigned to newly created category "${res.new_category_name}".`);
      setReassigningComplaint(null);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to create category and reassign complaint."));
    } finally {
      setSaving(false);
    }
  }

  function getPriorityTone(priority: number) {
    if (priority <= 1) return "destructive";
    if (priority === 2) return "accent";
    return "default";
  }

  return (
    <div>
      <PageHeader
        title="Uncategorized Complaints"
        description="Review and reassign student complaints submitted under the general 'Other' category."
      />

      {error && <Banner tone="error" onDismiss={() => setError(null)}>{error}</Banner>}
      {success && <Banner tone="success" onDismiss={() => setSuccess(null)}>{success}</Banner>}

      <Card>
        {loading ? (
          <LoadingState label="Loading complaints…" />
        ) : complaints.length === 0 ? (
          <EmptyState title="No uncategorized complaints" description="Great job! All incoming complaints are successfully categorized." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left font-bold text-muted-foreground uppercase tracking-widest">
                  <th className="px-4 py-3 font-medium">Complaint ID</th>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Problem</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Submitted</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/40 align-top">
                    <td className="px-4 py-3 font-bold text-foreground whitespace-nowrap">
                      #{c.id}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-bold text-foreground">{c.student_name}</div>
                      <div className="text-xs text-muted-foreground">{c.student_email}</div>
                      {(c.student_department || c.student_year) && (
                        <div className="text-xs text-muted-foreground">
                          {c.student_department}
                          {c.student_department && c.student_year ? " · " : ""}
                          {c.student_year ? `Year ${c.student_year}` : ""}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate" title={c.problem}>
                      {c.problem}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={getPriorityTone(c.priority)}>P{c.priority}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={c.status === "pending" ? "default" : "success"}>{c.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button variant="secondary" size="md" onClick={() => openReassign(c)} className="!h-9 px-3">
                        <ArrowRightLeft className="size-3.5 mr-1" /> Reassign
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
        open={!!reassigningComplaint}
        onClose={() => setReassigningComplaint(null)}
        title={`Reassign Complaint #${reassigningComplaint?.id}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReassigningComplaint(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleReassign}
              loading={saving}
              disabled={mode === "existing" ? !selectedCategoryId : !newCategoryName.trim()}
            >
              {mode === "existing" ? "Confirm Reassignment" : "Create Category & Reassign"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-muted/40 p-3 rounded-lg border border-border">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Problem Description</p>
            <p className="text-sm text-foreground">{reassigningComplaint?.problem}</p>
          </div>

          <div className="flex gap-2 border-b border-border pb-3">
            <Button
              variant={mode === "existing" ? "secondary" : "ghost"}
              size="sm"
              className="!h-9 px-3 flex-1"
              onClick={() => setMode("existing")}
            >
              <ArrowRightLeft className="size-3.5 mr-1" /> Existing Category
            </Button>
            <Button
              variant={mode === "new" ? "secondary" : "ghost"}
              size="sm"
              className="!h-9 px-3 flex-1"
              onClick={() => setMode("new")}
            >
              <FolderInput className="size-3.5 mr-1" /> New Category
            </Button>
          </div>

          {mode === "existing" ? (
            <Field label="Target Category" required hint="Choose the specific department/category this complaint belongs to.">
              <Select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(Number(e.target.value) || 0)}
              >
                <option value="">Select Category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <div className="space-y-4">
              <Field label="Category Name" required hint="A new category will be created in your faculty and this complaint will be moved to it.">
                <input
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g. Library Access Issues"
                />
              </Field>

              <Field label="Description" hint="Optional — helps officers understand the scope of this category.">
                <textarea
                  className="w-full min-h-[80px] px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
                  value={newCategoryDescription}
                  onChange={(e) => setNewCategoryDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </Field>

              <Field label="SLA (hours)" hint="Optional — defaults to 48 hours if left blank.">
                <input
                  type="number"
                  min={1}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground"
                  value={newCategorySlaHours}
                  onChange={(e) => setNewCategorySlaHours(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="48"
                />
              </Field>

              <Field label="Keywords" hint="Optional, comma-separated — used to auto-classify future complaints into this category.">
                <input
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground"
                  value={newCategoryKeywords}
                  onChange={(e) => setNewCategoryKeywords(e.target.value)}
                  placeholder="e.g. library, books, study room"
                />
              </Field>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}