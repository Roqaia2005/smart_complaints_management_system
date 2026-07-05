import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { Input } from '../../components/ui/input';
import {
  Plus, Search, Trash2, Edit, Tag, AlertCircle,
  CheckCircle2, XCircle, Sparkles, Loader2
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { adminApi } from '../../api/services';
import type { Category } from '../../types/api';

// Shape returned by POST /api/admin/categories/suggest-description
interface CategorySuggestion {
  description_en: string;
  description_ar: string;
  keywords_en: string[];
  keywords_ar: string[];
  combined_description: string;
  combined_keywords: string;
}

// Matches the backend's `description` column limit. Adjust this to match
// whatever your Category model actually allows.
const MAX_DESCRIPTION_LENGTH = 1000;

function clampDescription(text: string): { value: string; wasTrimmed: boolean } {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_DESCRIPTION_LENGTH) return { value: trimmed, wasTrimmed: false };
  return { value: trimmed.slice(0, MAX_DESCRIPTION_LENGTH).trim(), wasTrimmed: true };
}

// ── Modal ─────────────────────────────────────────────────────────────────
interface CategoryModalProps {
  initial?: Partial<Category>;
  onClose: () => void;
  onSave: (data: { name: string; description: string; sla_hours: number; keywords?: string }) => Promise<void>;
}

function CategoryModal({ initial, onClose, onSave }: CategoryModalProps) {
  const [name, setName]           = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [slaHours, setSlaHours]   = useState(String(initial?.sla_hours ?? 24));
  const [keywords, setKeywords]   = useState((initial as any)?.keywords ?? '');
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState('');

  // AI description suggestion (POST /api/admin/categories/suggest-description)
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<CategorySuggestion | null>(null);
  const [suggestErr, setSuggestErr] = useState('');

  const handleSuggest = async () => {
    if (!name.trim()) { setSuggestErr('Enter a category name first'); return; }
    setSuggesting(true);
    setSuggestErr('');
    try {
      const res = await adminApi.suggestCategoryDescription(name.trim(), description.trim());
      if (res.data?.success) {
        setSuggestion(res.data.suggestion);
      } else {
        setSuggestErr(res.data?.error || 'Could not generate a suggestion.');
      }
    } catch (error: any) {
      setSuggestErr(error.response?.data?.error ?? error.message ?? 'Suggestion failed.');
    } finally {
      setSuggesting(false);
    }
  };

  const applySuggestion = (variant: 'en' | 'ar' | 'combined') => {
    if (!suggestion) return;
    const source =
      variant === 'en' ? suggestion.description_en :
      variant === 'ar' ? suggestion.description_ar :
      suggestion.combined_description;

    const { value, wasTrimmed } = clampDescription(source);
    setDescription(value);
    setSuggestErr(
      wasTrimmed
        ? `The suggested description was trimmed to fit the ${MAX_DESCRIPTION_LENGTH}-character limit. Feel free to edit it further.`
        : ''
    );
  };

  const applyKeywords = () => {
    if (!suggestion) return;
    const existing = keywords
      .split(',')
      .map((k: string) => k.trim())
      .filter(Boolean);
    const incoming = suggestion.combined_keywords
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);
    const merged = Array.from(new Set([...existing, ...incoming]));
    setKeywords(merged.join(', '));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErr('Name is required'); return; }
    if (!description.trim()) { setErr('Description is required'); return; }
    if (description.trim().length > MAX_DESCRIPTION_LENGTH) {
      setErr(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer (currently ${description.trim().length}).`);
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        sla_hours: Number(slaHours),
        keywords: keywords.trim() || undefined,
      });
      onClose();
    } catch (error: any) {
      setErr(error.response?.data?.error ?? error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        <div className="p-6 border-b dark:border-slate-800 shrink-0">
          <h2 className="text-xl font-bold">{initial?.id ? 'Edit Category' : 'Add Category'}</h2>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
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
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description *</label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  onClick={handleSuggest}
                  disabled={suggesting || !name.trim()}
                >
                  {suggesting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {suggesting ? 'Thinking…' : 'Suggest with AI'}
                </Button>
              </div>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Brief description..."
                maxLength={MAX_DESCRIPTION_LENGTH}
                rows={3}
                className="w-full rounded-md border border-slate-200 dark:border-slate-700 dark:bg-slate-900 px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className={cn(
                "text-[10px] font-medium text-right",
                description.length >= MAX_DESCRIPTION_LENGTH ? "text-rose-600" : "text-slate-400"
              )}>
                {description.length}/{MAX_DESCRIPTION_LENGTH}
              </div>

              {suggestErr && (
                <p className="text-xs text-rose-600 font-medium pt-1">{suggestErr}</p>
              )}

              {suggestion && (
                <div className="mt-2 p-3 rounded-lg bg-blue-50 border border-blue-200 space-y-3">
                  <div className="flex items-center gap-1.5 text-blue-700 text-xs font-bold uppercase tracking-widest">
                    <Sparkles size={12} /> AI Suggestion
                  </div>

                  <div className="space-y-2 text-sm text-slate-700">
                    <p><span className="font-bold">EN:</span> {suggestion.description_en}</p>
                    <p dir="rtl" className="text-right"><span className="font-bold">AR:</span> {suggestion.description_ar}</p>
                  </div>

                  {(suggestion.keywords_en.length > 0 || suggestion.keywords_ar.length > 0) && (
                    <div className="flex flex-wrap gap-1.5">
                      {[...suggestion.keywords_en, ...suggestion.keywords_ar].map((kw, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full bg-white border border-blue-200 text-[11px] text-slate-600">
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => applySuggestion('en')}>
                      Use English
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => applySuggestion('ar')}>
                      Use Arabic
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => applySuggestion('combined')}>
                      Use Both
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={applyKeywords}>
                      Add Keywords
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Keywords</label>
              <Input
                value={keywords}
                onChange={e => setKeywords(e.target.value)}
                placeholder="Comma-separated, e.g. wifi, login, password"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SLA Hours</label>
              <Input type="number" value={slaHours} onChange={e => setSlaHours(e.target.value)} min={1} />
            </div>
          </div>
          <div className="p-6 border-t dark:border-slate-800 flex gap-3 justify-end shrink-0">
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

  const handleAdd = async (data: { name: string; description: string; sla_hours: number; keywords?: string }) => {
    await adminApi.addCategory(data);
    showToast('Category added successfully!');
    load();
  };

  const handleEdit = (cat: Category) => async (data: { name: string; description: string; sla_hours: number; keywords?: string }) => {
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