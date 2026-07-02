import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { Input } from '../../components/ui/input';
import {
  Plus, Search, Trash2, Edit, Tag, AlertCircle,
  CheckCircle2, XCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { adminApi } from '../../api/services';
import type { Category } from '../../types/api';

// ── Modal ─────────────────────────────────────────────────────────────────
interface CategoryModalProps {
  initial?: Partial<Category>;
  onClose: () => void;
  onSave: (data: { name: string; description: string; sla_hours: number }) => Promise<void>;
}

function CategoryModal({ initial, onClose, onSave }: CategoryModalProps) {
  const [name, setName]           = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [slaHours, setSlaHours]   = useState(String(initial?.sla_hours ?? 24));
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErr('Name is required'); return; }
    if (!description.trim()) { setErr('Description is required'); return; }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), description: description.trim(), sla_hours: Number(slaHours) });
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
          <h2 className="text-xl font-bold">{initial?.id ? 'Edit Category' : 'Add Category'}</h2>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {err && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
                <AlertCircle size={16} /> {err}
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Name *</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Technical / IT" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description..." />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SLA Hours</label>
              <Input type="number" value={slaHours} onChange={e => setSlaHours(e.target.value)} min={1} />
            </div>
          </div>
          <div className="p-6 border-t dark:border-slate-800 flex gap-3 justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 font-bold px-8">
              {saving ? 'Saving…' : 'Save Category'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [search, setSearch]         = useState('');
  const [modal, setModal]           = useState<'add' | number | null>(null);
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const load = () => {
    setLoading(true);
    adminApi.getCategories()
      .then(res => {
        console.log('Fetched categories:', res.data.categories);
        setCategories(res.data.categories ?? [])})
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (data: { name: string; description: string; sla_hours: number }) => {
    await adminApi.addCategory(data);
    showToast('Category added successfully!');
    load();
  };

  const handleEdit = (cat: Category) => async (data: { name: string; description: string; sla_hours: number }) => {
    await adminApi.updateCategory(cat.id, data);
    showToast('Category updated!');
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this category?')) return;
    try {
      await adminApi.deleteCategory(id);
      showToast('Category deleted.');
      load();
    } catch (err: any) {
      showToast(err.message, false);
    }
  };

  const filtered = categories.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase())
  );

  const editingCat = typeof modal === 'number' ? categories.find(c => c.id === modal) : undefined;

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
      {modal === 'add' && (
        <CategoryModal onClose={() => setModal(null)} onSave={handleAdd} />
      )}
      {typeof modal === 'number' && editingCat && (
        <CategoryModal initial={editingCat} onClose={() => setModal(null)} onSave={handleEdit(editingCat)} />
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Category Architecture</h1>
          <p className="text-slate-500 font-medium">Define and organize complaint categories</p>
        </div>
        <Button
          id="add-category-btn"
          onClick={() => setModal('add')}
          className="gap-2 bg-blue-600 hover:bg-blue-700 font-bold h-11 px-6 shadow-lg shadow-blue-500/20"
        >
          <Plus size={18} /> Add Category
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
        <Input
          placeholder="Search categories..."
          className="pl-10 h-10"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200">
          <AlertCircle className="text-rose-600" size={18} />
          <p className="text-rose-700 font-medium text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loading
          ? [1,2,3,4].map(i => <Skeleton key={i} className="h-56 rounded-2xl" />)
          : filtered.map(cat => (
            <Card
              key={cat.id}
              className={cn(
                "border-none shadow-sm group hover:ring-2 hover:ring-blue-600 transition-all",
                !cat.is_active && "opacity-60"
              )}
            >
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600">
                    <Tag size={24} />
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      id={`edit-cat-${cat.id}`}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-blue-600"
                      onClick={() => setModal(cat.id)}
                    >
                      <Edit size={14} />
                    </Button>
                    <Button
                      id={`delete-cat-${cat.id}`}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-rose-600"
                      onClick={() => handleDelete(cat.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-800 dark:text-white leading-tight mb-1">{cat.name}</h3>
                  {cat.description && (
                    <p className="text-xs text-slate-400 line-clamp-2">{cat.description}</p>
                  )}
                  <div className="mt-6 pt-4 border-t dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">SLA: {cat.sla_hours ?? '—'}h</span>
                    <Badge className={cn(
                      "text-[10px] font-bold",
                      cat.is_active !== false
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-slate-500/10 text-slate-500"
                    )}>
                      {cat.is_active !== false ? 'ACTIVE' : 'INACTIVE'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        }

        {/* Add new placeholder */}
        {!loading && (
          <button
            onClick={() => setModal('add')}
            className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-slate-400 hover:border-blue-500 hover:text-blue-600 transition-all min-h-[220px] bg-slate-50/50 dark:bg-slate-900/30"
          >
            <div className="w-12 h-12 rounded-full border-2 border-dashed border-current flex items-center justify-center mb-4">
              <Plus size={24} />
            </div>
            <p className="font-bold uppercase tracking-widest text-xs">Create New</p>
          </button>
        )}
      </div>
    </div>
  );
}
