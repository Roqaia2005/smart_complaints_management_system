import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Download, FileText, Search, RefreshCw, AlertTriangle } from 'lucide-react';
import { managerApi } from '../../api/services';
import type { Complaint } from '../../types/api';

export default function ManagerReports() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('');

  const loadReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await managerApi.getReports({
        from: from || undefined,
        to: to || undefined,
        category_id: categoryId ? Number(categoryId) : undefined,
        status: status || undefined,
      });
      const payload = response.data as { complaints?: Complaint[]; total_count?: number };
      setComplaints(payload.complaints ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load reports.');
      setComplaints([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const filteredComplaints = useMemo(() => {
    const value = search.toLowerCase();
    return complaints.filter((complaint) => {
      const haystack = [complaint.problem, complaint.Category?.name, complaint.status, complaint.id.toString()].join(' ').toLowerCase();
      return haystack.includes(value);
    });
  }, [complaints, search]);

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Generated Reports</h1>
          <p className="text-slate-500 font-medium">Complaints from the manager reports endpoint filtered by your selection.</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={loadReports} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400">From</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400">To</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Category ID</label>
              <Input type="number" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Status</label>
              <Input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="pending" />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 text-slate-400" size={18} />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search complaints" className="pl-10" />
            </div>
            <Button className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={loadReports} disabled={loading}>
              <FileText size={16} /> Apply filters
            </Button>
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-700">
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="mt-6 rounded-xl border border-slate-200 p-8 text-sm text-slate-500">Loading reports…</div>
          ) : filteredComplaints.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">No complaints match the current filters.</div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b bg-slate-50 dark:border-slate-800">
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">ID</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Category</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Problem</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-800">
                  {filteredComplaints.map((complaint) => (
                    <tr key={complaint.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="p-4 font-mono text-sm text-slate-500">{complaint.id}</td>
                      <td className="p-4">{complaint.Category?.name ?? '—'}</td>
                      <td className="p-4 max-w-md">{complaint.problem}</td>
                      <td className="p-4 capitalize">{complaint.status}</td>
                      <td className="p-4">{new Date(complaint.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
