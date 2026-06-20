import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { Input } from '../../components/ui/input';
import {
  Search, UserPlus, Mail, Trash2, Edit, Filter,
  CheckCircle2, AlertCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { adminApi } from '../../api/services';
import type { SystemUser } from '../../types/api';

const ROLES = ['student', 'officer', 'manager', 'admin'];

const roleColors: Record<string, string> = {
  admin:       'bg-slate-900 text-white',
  super_admin: 'bg-purple-700 text-white',
  manager:     'bg-purple-600 text-white',
  officer:     'bg-blue-600 text-white',
  student:     'bg-emerald-600 text-white',
};

interface UserModalProps {
  initial?: Partial<SystemUser>;
  onClose: () => void;
  onSave: (data: { full_name: string; email: string; password: string; role: string }) => Promise<void>;
}

function UserModal({ initial, onClose, onSave }: UserModalProps) {
  const [fullName, setFullName] = useState(initial?.full_name ?? '');
  const [email, setEmail]       = useState(initial?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole]         = useState(initial?.role ?? 'officer');
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) { setErr('Name and email are required'); return; }
    if (!initial?.id && !password) { setErr('Password is required for new users'); return; }
    setSaving(true);
    try {
      await onSave({ full_name: fullName.trim(), email: email.trim(), password, role });
      onClose();
    } catch (error: any) {
      setErr(error.response?.data?.error ?? error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-2xl">
        <div className="p-6 border-b dark:border-slate-800">
          <h2 className="text-xl font-bold">{initial?.id ? 'Edit User' : 'Add User'}</h2>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {err && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
                <AlertCircle size={16} /> {err}
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Full Name *</label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Dr. Sarah Wilson" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email *</label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@university.edu" />
            </div>
            {!initial?.id && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Password *</label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Role</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="h-10 w-full px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="p-6 border-t dark:border-slate-800 flex gap-3 justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 font-bold px-8">
              {saving ? 'Saving…' : 'Save User'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function AdminUsers() {
  const [users, setUsers]     = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [search, setSearch]   = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [modal, setModal]     = useState<'add' | number | null>(null);
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const load = () => {
    setLoading(true);
    adminApi.getUsers()
      .then(res => setUsers(res.data.users ?? []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (data: { full_name: string; email: string; password: string; role: string }) => {
    await adminApi.addUser(data);
    showToast('User added successfully!');
    load();
  };

  const handleEdit = (user: SystemUser) => async (data: { full_name: string; email: string; password: string; role: string }) => {
    await adminApi.updateUser(user.id, { full_name: data.full_name, email: data.email, role: data.role });
    showToast('User updated!');
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Deactivate this user?')) return;
    try {
      await adminApi.deleteUser(id);
      showToast('User deactivated.');
      load();
    } catch (err: any) {
      showToast(err.message, false);
    }
  };

  const filtered = users.filter(u => {
    const matchSearch = !search ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const editingUser = typeof modal === 'number' ? users.find(u => u.id === modal) : undefined;

  return (
    <div className="space-y-8 animate-in">
      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-white font-bold text-sm",
          toast.ok ? "bg-emerald-600" : "bg-rose-600"
        )}>
          {toast.ok ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {toast.msg}
        </div>
      )}

      {/* Modals */}
      {modal === 'add' && <UserModal onClose={() => setModal(null)} onSave={handleAdd} />}
      {typeof modal === 'number' && editingUser && (
        <UserModal initial={editingUser} onClose={() => setModal(null)} onSave={handleEdit(editingUser)} />
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-slate-500 font-medium">Control system access and assign administrative roles</p>
        </div>
        <Button
          id="add-user-btn"
          onClick={() => setModal('add')}
          className="gap-2 bg-blue-600 hover:bg-blue-700 font-bold h-11 px-6 shadow-lg shadow-blue-500/20"
        >
          <UserPlus size={18} /> Add New User
        </Button>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-800 flex flex-col md:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <Input
              placeholder="Search by name or email..."
              className="pl-10 h-10"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Roles</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-3 p-4 border-b bg-rose-50">
            <AlertCircle className="text-rose-600" size={18} />
            <p className="text-rose-700 font-medium text-sm">{error}</p>
          </div>
        )}

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/30 border-b dark:border-slate-800">
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">User</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Role</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {loading
                  ? [1,2,3,4].map(i => (
                    <tr key={i}><td colSpan={4} className="p-4"><Skeleton className="h-10 w-full" /></td></tr>
                  ))
                  : filtered.length === 0
                    ? (
                      <tr>
                        <td colSpan={4} className="p-10 text-center text-slate-400">No users found</td>
                      </tr>
                    )
                    : filtered.map(user => (
                      <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-500 border dark:border-slate-700">
                              {user.full_name?.charAt(0) ?? '?'}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 dark:text-slate-200">{user.full_name}</p>
                              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <Mail size={12} /> {user.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge className={cn("font-bold px-3 py-0.5 rounded-full text-[10px] uppercase tracking-widest", roleColors[user.role] ?? 'bg-slate-500 text-white')}>
                            {user.role}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-2 h-2 rounded-full", user.is_active ? "bg-emerald-500" : "bg-slate-300")} />
                            <span className="text-xs font-bold capitalize">{user.is_active ? 'Active' : 'Inactive'}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            <Button id={`edit-user-${user.id}`} variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-blue-600" onClick={() => setModal(user.id)}>
                              <Edit size={16} />
                            </Button>
                            <Button id={`delete-user-${user.id}`} variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-rose-600" onClick={() => handleDelete(user.id)}>
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
