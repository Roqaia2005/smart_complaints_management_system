import { useEffect, useState } from "react";
import { FolderInput, ArrowRightLeft } from "lucide-react";
import {
  getUncategorizedComplaints,
  getCategories,
  reassignComplaint,
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
  }

  async function handleReassign() {
    if (!reassigningComplaint || !selectedCategoryId) return;
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
                  <th className="px-4 py-3 font-medium">AI Summary</th>
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
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate" title={c.problem}>
                      {c.problem}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate" title={c.ai_summary}>
                      {c.ai_summary}
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
                    <td className="px-4 py-3 text-right">
                      <Button variant="secondary" size="sm" onClick={() => openReassign(c)} className="!h-9 px-3">
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
            <Button onClick={handleReassign} loading={saving} disabled={!selectedCategoryId}>
              Confirm Reassignment
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-muted/40 p-3 rounded-lg border border-border">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Problem Description</p>
            <p className="text-sm text-foreground">{reassigningComplaint?.problem}</p>
          </div>

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
        </div>
      </Modal>
    </div>
  );
}
