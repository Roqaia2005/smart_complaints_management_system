// =========================================================================
// UsersPage.tsx
// Route: /admin/users
// Table of all users + create user (role-driven extra fields) + inline
// activate/deactivate + edit + soft delete + officer "also manager" flag.
// =========================================================================

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, ShieldCheck, Upload } from "lucide-react";
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  setOfficerManagerFlag,
  getCategories,
  getApiErrorMessage,
  type AdminUser,
  type AdminCategory,
  type UserRole,
  type CreateUserPayload,
} from "@/api/adminApi";
import {
  PageHeader,
  Card,
  Button,
  Field,
  TextInput,
  Select,
  Toggle,
  MultiCheckList,
  Modal,
  Badge,
  EmptyState,
  LoadingState,
  Banner,
} from "./adminUi";
import { toast } from "react-toastify";

const ROLE_LABEL: Record<UserRole, string> = {
  student: "Student",
  officer: "Officer",
  manager: "Manager",
};

const emptyForm: CreateUserPayload = {
  role: "student",
  full_name: "",
  email: "",
  password: "",
  student_number: "",
  department: "",
  academic_year: undefined,
  category_ids: [],
  officer_title: "",
  is_also_manager: false,
  manager_title: "",
};

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [search, setSearch] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateUserPayload>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState<Partial<AdminUser>>({});

  const [managerFlagUser, setManagerFlagUser] = useState<AdminUser | null>(null);
  const [managerFlagDraft, setManagerFlagDraft] = useState({ is_also_manager: false, manager_title: "" });

  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [u, c] = await Promise.all([getUsers(), getCategories()]);
      setUsers(u);
      setCategories(c);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load users."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Officers don't carry category_ids on the /admin/users payload, so we
  // derive "which categories does this officer manage" from the category
  // list's officers[] relation instead.
  const officerCategoryMap = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const cat of categories) {
      for (const officer of cat.officers ?? []) {
        const list = map.get(officer.id) ?? [];
        list.push(cat.name);
        map.set(officer.id, list);
      }
    }
    return map;
  }, [categories]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      }
      return true;
    });
  }, [users, roleFilter, search]);

  function resetCreateForm() {
    setForm(emptyForm);
  }

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      const payload: CreateUserPayload = { ...form };
      if (payload.role !== "student") {
        delete payload.student_number;
        delete payload.department;
        delete payload.academic_year;
      }
      if (payload.role !== "officer") {
        delete payload.category_ids;
        delete payload.officer_title;
        if (payload.role !== "manager") {
          delete payload.is_also_manager;
        }
      }
      if (payload.role === "manager" || (payload.role === "officer" && payload.is_also_manager)) {
        // manager_title stays
      } else if (payload.role === "officer" && !payload.is_also_manager) {
        delete payload.manager_title;
      }

      await createUser(payload);
      setSuccess(`${ROLE_LABEL[form.role]} "${form.full_name}" created.`);
      setCreateOpen(false);
      resetCreateForm();
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to create user."));
      setError(getApiErrorMessage(err, "Failed to create user."));
    } finally {
      setSaving(false);
    }
  }

  function openEdit(user: AdminUser) {
    setEditingUser(user);
    setEditForm({
      full_name: user.full_name,
      email: user.email,
      officer_title: user.officer_title,
      manager_title: user.manager_title,
    });
  }

  async function handleSaveEdit() {
    if (!editingUser) return;
    setSaving(true);
    setError(null);
    try {
      await updateUser(editingUser.id, editForm as any);
      setSuccess(`Updated ${editingUser.full_name}.`);
      setEditingUser(null);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to update user."));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: AdminUser) {
    setError(null);
    try {
      await updateUser(user.id, { is_active: !user.is_active });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_active: !u.is_active } : u)));
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to change user status."));
    }
  }

  function openManagerFlag(user: AdminUser) {
    setManagerFlagUser(user);
    setManagerFlagDraft({
      is_also_manager: !!user.is_also_manager,
      manager_title: user.manager_title ?? "",
    });
  }

  async function handleSaveManagerFlag() {
    if (!managerFlagUser) return;
    setSaving(true);
    setError(null);
    try {
      await setOfficerManagerFlag(
        managerFlagUser.id,
        managerFlagDraft.is_also_manager,
        managerFlagDraft.is_also_manager ? managerFlagDraft.manager_title : null
      );
      setSuccess(`Updated manager access for ${managerFlagUser.full_name}.`);
      setManagerFlagUser(null);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to update manager flag."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingUser) return;
    setSaving(true);
    setError(null);
    try {
      await deleteUser(deletingUser.id);
      setSuccess(`Deactivated ${deletingUser.full_name}.`);
      setDeletingUser(null);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to delete user."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Users"
        description="Create and manage students, officers, and managers."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => (window.location.href = "/admin/users/import")}>
              <Upload className="size-4" /> Bulk import
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> New user
            </Button>
          </div>
        }
      />

      {error && <Banner tone="error" onDismiss={() => setError(null)}>{error}</Banner>}
      {success && <Banner tone="success" onDismiss={() => setSuccess(null)}>{success}</Banner>}

      <Card className="mb-4 p-3 flex flex-wrap gap-2 items-center">
        <Select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as UserRole | "all")}
          className="w-auto"
        >
          <option value="all">All roles</option>
          <option value="student">Students</option>
          <option value="officer">Officers</option>
          <option value="manager">Managers</option>
        </Select>
        <TextInput
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-auto flex-1 min-w-48"
        />
      </Card>

      <Card>
        {loading ? (
          <LoadingState label="Loading users…" />
        ) : filteredUsers.length === 0 ? (
          <EmptyState title="No users match this view" description="Try a different role filter or search term." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Title / Categories</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3 font-bold text-foreground">{u.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge tone={u.role === "manager" ? "accent" : "default"}>{ROLE_LABEL[u.role]}</Badge>
                      {u.role === "officer" && u.is_also_manager && (
                        <Badge tone="success">+ Manager</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.role === "officer" && (
                        <span>
                          {u.officer_title || "—"}
                          {officerCategoryMap.get(u.id)?.length ? (
                            <span className="block text-xs">{officerCategoryMap.get(u.id)!.join(", ")}</span>
                          ) : null}
                        </span>
                      )}
                      {u.role === "manager" && (u.manager_title || "—")}
                      {u.role === "student" && "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Toggle checked={u.is_active} onChange={() => toggleActive(u)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {u.role === "officer" && (
                          <Button variant="ghost" size="sm" onClick={() => openManagerFlag(u)}>
                            <ShieldCheck className="size-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeletingUser(u)}>
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ---------------- Create user modal ---------------- */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create user"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={saving} disabled={!form.full_name || !form.email || !form.password}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Role" required>
            <Select value={form.role} onChange={(e) => setForm({ ...emptyForm, role: e.target.value as UserRole })}>
              <option value="student">Student</option>
              <option value="officer">Officer</option>
              <option value="manager">Manager</option>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Full name" required>
              <TextInput value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </Field>
            <Field label="Email" required>
              <TextInput
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Temporary password" required hint="The user can change this after first login.">
            <TextInput
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>

          {form.role === "student" && (
            <div className="grid grid-cols-3 gap-3">
              <Field label="Student number" required>
                <TextInput
                  value={form.student_number}
                  onChange={(e) => setForm({ ...form, student_number: e.target.value })}
                />
              </Field>
              <Field label="Department">
                <TextInput
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                />
              </Field>
              <Field label="Academic year">
                <TextInput
                  type="number"
                  value={form.academic_year ?? ""}
                  onChange={(e) => setForm({ ...form, academic_year: Number(e.target.value) || undefined })}
                />
              </Field>
            </div>
          )}

          {form.role === "officer" && (
            <div className="space-y-4">
              <Field label="Officer title">
                <TextInput
                  placeholder="e.g. Academic Affairs Officer"
                  value={form.officer_title}
                  onChange={(e) => setForm({ ...form, officer_title: e.target.value })}
                />
              </Field>
              <Field label="Categories" required hint="At least one category is required for an officer.">
                <MultiCheckList
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                  selected={form.category_ids ?? []}
                  onChange={(ids) => setForm({ ...form, category_ids: ids })}
                />
              </Field>
              <Toggle
                checked={!!form.is_also_manager}
                onChange={(v) => setForm({ ...form, is_also_manager: v })}
                label="Also grant manager access"
              />
              {form.is_also_manager && (
                <Field label="Manager title" required>
                  <TextInput
                    value={form.manager_title}
                    onChange={(e) => setForm({ ...form, manager_title: e.target.value })}
                  />
                </Field>
              )}
            </div>
          )}

          {form.role === "manager" && (
            <Field label="Manager title" required hint='e.g. "Academic Affairs Manager"'>
              <TextInput
                value={form.manager_title}
                onChange={(e) => setForm({ ...form, manager_title: e.target.value })}
              />
            </Field>
          )}
        </div>
      </Modal>

      {/* ---------------- Edit user modal ---------------- */}
      <Modal
        open={!!editingUser}
        onClose={() => setEditingUser(null)}
        title={`Edit ${editingUser?.full_name ?? ""}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} loading={saving}>
              Save changes
            </Button>
          </>
        }
      >
        {editingUser && (
          <div className="space-y-3">
            <Field label="Full name">
              <TextInput
                value={editForm.full_name ?? ""}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <TextInput
                type="email"
                value={editForm.email ?? ""}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </Field>
            {editingUser.role === "officer" && (
              <Field label="Officer title">
                <TextInput
                  value={editForm.officer_title ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, officer_title: e.target.value })}
                />
              </Field>
            )}
            {(editingUser.role === "manager" || (editingUser.role === "officer" && editingUser.is_also_manager)) && (
              <Field label="Manager title">
                <TextInput
                  value={editForm.manager_title ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, manager_title: e.target.value })}
                />
              </Field>
            )}
          </div>
        )}
      </Modal>

      {/* ---------------- Manager flag modal (officer rows) ---------------- */}
      <Modal
        open={!!managerFlagUser}
        onClose={() => setManagerFlagUser(null)}
        title="Manager access"
        footer={
          <>
            <Button variant="ghost" onClick={() => setManagerFlagUser(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveManagerFlag} loading={saving}>
              Save
            </Button>
          </>
        }
      >
        {managerFlagUser && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Grant {managerFlagUser.full_name} manager-level access in addition to their officer role.
            </p>
            <Toggle
              checked={managerFlagDraft.is_also_manager}
              onChange={(v) => setManagerFlagDraft({ ...managerFlagDraft, is_also_manager: v })}
              label="Also a manager"
            />
            {managerFlagDraft.is_also_manager && (
              <Field label="Manager title" required>
                <TextInput
                  value={managerFlagDraft.manager_title}
                  onChange={(e) => setManagerFlagDraft({ ...managerFlagDraft, manager_title: e.target.value })}
                />
              </Field>
            )}
          </div>
        )}
      </Modal>

      {/* ---------------- Delete confirm modal ---------------- */}
      <Modal
        open={!!deletingUser}
        onClose={() => setDeletingUser(null)}
        title="Deactivate user"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeletingUser(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} loading={saving}>
              Deactivate
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          This deactivates <strong className="text-foreground">{deletingUser?.full_name}</strong>. They will no
          longer be able to sign in, but their history is preserved. This is a soft delete and can be reversed by
          reactivating the account.
        </p>
      </Modal>
    </div>
  );
}