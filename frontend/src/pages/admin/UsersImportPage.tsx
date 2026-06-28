// =========================================================================
// UsersImportPage.tsx
// Route: /admin/users/import
// Two-step CSV bulk import: upload + role -> preview (valid/invalid rows)
// -> confirm -> imported count.
// =========================================================================

import { useRef, useState } from "react";
import { CheckCircle2, FileUp, RotateCcw, ArrowLeft } from "lucide-react";
import {
  importUsersPreview,
  confirmImportUsers,
  getApiErrorMessage,
  type UserRole,
  type ImportPreviewResult,
} from "@/api/adminApi";
import { PageHeader, Card, Button, Field, Select, Badge, Banner } from "./adminUi";

const ROLE_TEMPLATES: Record<UserRole, string> = {
  student: "full_name,email,password,student_number,department,academic_year",
  officer: "full_name,email,password,officer_title,category_ids",
  manager: "full_name,email,password,manager_title",
};

type Step = "upload" | "preview" | "done";

export default function UsersImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [role, setRole] = useState<UserRole>("student");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportPreviewResult | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("upload");
    setFile(null);
    setResult(null);
    setImportedCount(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handlePreview() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await importUsersPreview(file, role);
      setResult(res);
      setStep("preview");
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to parse CSV. Check the file headers and try again."));
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!result) return;
    setLoading(true);
    setError(null);
    try {
      const res = await confirmImportUsers(result.import_id);
      setImportedCount(res.imported_count);
      setStep("done");
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to confirm import. The session may have expired — try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Bulk import users"
        description="Upload a CSV of students, officers, or managers — review errors before anything is created."
        action={
          <Button variant="ghost" onClick={() => (window.location.href = "/admin/users")}>
            <ArrowLeft className="size-4" /> Back to users
          </Button>
        }
      />

      {error && <Banner tone="error" onDismiss={() => setError(null)}>{error}</Banner>}

      {step === "upload" && (
        <Card className="p-6 max-w-xl">
          <div className="space-y-4">
            <Field label="Role" required hint="Determines which columns the CSV must contain.">
              <Select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                <option value="student">Student</option>
                <option value="officer">Officer</option>
                <option value="manager">Manager</option>
              </Select>
            </Field>

            <div className="rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground font-mono break-all">
              {ROLE_TEMPLATES[role]}
            </div>

            <Field label="CSV file" required>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground"
              />
            </Field>

            <Button onClick={handlePreview} disabled={!file} loading={loading}>
              <FileUp className="size-4" /> Preview import
            </Button>
          </div>
        </Card>
      )}

      {step === "preview" && result && (
        <div className="space-y-4">
          <Card className="p-4 flex flex-wrap gap-6">
            <Stat label="Total rows" value={result.preview.total_records} />
            <Stat label="Valid" value={result.preview.valid_records} tone="success" />
            <Stat label="Invalid" value={result.preview.invalid_records} tone="destructive" />
          </Card>

          {result.preview.errors.length > 0 && (
            <Card>
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-medium text-foreground">Rows with errors</h3>
                <p className="text-xs text-muted-foreground">These rows will be skipped. Fix and re-upload.</p>
              </div>
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                      <th className="px-4 py-2 font-medium">Row</th>
                      <th className="px-4 py-2 font-medium">Email</th>
                      <th className="px-4 py-2 font-medium">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.preview.errors.map((row) => (
                      <tr key={row.row} className="border-b border-border last:border-0">
                        <td className="px-4 py-2 text-muted-foreground">#{row.row}</td>
                        <td className="px-4 py-2 text-foreground">{row.data.email || "—"}</td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-1">
                            {row.errors.map((e, i) => (
                              <Badge key={i} tone="destructive">
                                {e}
                              </Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <div className="flex gap-2">
            <Button variant="ghost" onClick={reset}>
              <RotateCcw className="size-4" /> Start over
            </Button>
            <Button onClick={handleConfirm} loading={loading} disabled={result.preview.valid_records === 0}>
              Confirm import of {result.preview.valid_records} user{result.preview.valid_records === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      )}

      {step === "done" && (
        <Card className="p-8 max-w-md text-center">
          <CheckCircle2 className="size-10 text-primary mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-foreground">Import complete</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {importedCount} {role}
            {importedCount === 1 ? "" : "s"} created successfully.
          </p>
          <div className="flex justify-center gap-2 mt-5">
            <Button variant="secondary" onClick={reset}>
              Import another file
            </Button>
            <Button onClick={() => (window.location.href = "/admin/users")}>Go to users</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" | "destructive" }) {
  const color = tone === "success" ? "text-primary" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}