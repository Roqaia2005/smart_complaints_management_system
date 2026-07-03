import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import {
  ShieldAlert, ArrowRight, CheckCircle2, AlertTriangle,
  History, AlertCircle, Brain
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { officerApi } from '../../api/services';
import type { Appeal } from '../../types/api';
 
interface BackendCategory {
  id: number;
  name: string;
}
 
export default function OfficerAppeals() {
  const [appeals, setAppeals]     = useState<Appeal[]>([]);
  const [categories, setCategories] = useState<BackendCategory[]>([]);
 
  // undefined = "All" — no category_id sent to backend
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>(undefined);
 
  const [loading, setLoading]         = useState(true);
  const [loadingCats, setLoadingCats] = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [marking, setMarking]         = useState<number | null>(null);
  const [toast, setToast]             = useState<string | null>(null);

  // Officer's response text per appeal, keyed by appeal id
  const [responseTexts, setResponseTexts] = useState<Record<number, string>>({});
 
  // Fetch only THIS officer's assigned categories — same source as dashboard
  useEffect(() => {
    setLoadingCats(true);
    officerApi.getAssignedCategories()
      .then(res => setCategories(res.data?.categories ?? []))
      .catch(err => console.error('Failed to load assigned categories', err))
      .finally(() => setLoadingCats(false));
  }, []);
 
  const loadAppeals = React.useCallback(() => {
    setLoading(true);
    setError(null);
    officerApi.getAppeals(selectedCategoryId)
      .then(res => {
        const rawAppeals = res.data.appeals || [];
        const mappedAppeals: Appeal[] = rawAppeals.map((a: any) => ({
          id: a.appeal_id,
          complaint_id: a.complaint?.id,
          reason: a.appeal_reason,
          status: a.status || 'pending',
          createdAt: a.appeal_date,
          Complaint: a.complaint,
        }));
        setAppeals(mappedAppeals);
      })
      .catch(err => setError(err.response?.data?.error || err.message))
      .finally(() => setLoading(false));
  }, [selectedCategoryId]);
 
  useEffect(() => {
    loadAppeals();
  }, [loadAppeals]);
 
  const handleResponseTextChange = (id: number, value: string) => {
    setResponseTexts(prev => ({ ...prev, [id]: value }));
  };

  const handleMarkReviewed = async (id: number) => {
    const responseText = (responseTexts[id] || '').trim();
    if (!responseText) {
      setToast('Please write a response before marking as reviewed');
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setMarking(id);
    try {
      await officerApi.markAppealReviewed(id, responseText);
      setToast('Appeal marked as reviewed');
      setTimeout(() => setToast(null), 3000);
      setResponseTexts(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      loadAppeals();
    } catch (err: any) {
      setToast('Failed to update: ' + (err.response?.data?.error || err.message));
      setTimeout(() => setToast(null), 3000);
    } finally {
      setMarking(null);
    }
  };
  return (
    <div className="space-y-8 animate-in">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl bg-emerald-600 text-white font-bold text-sm animate-in slide-in-from-bottom-4">
          <CheckCircle2 size={18} /> {toast}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Appealed Cases</h1>
          <p className="text-slate-500 font-medium">Re-review complaints where students requested an appeal</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Department:</span>
            <select
              value={selectedCategoryId ?? 'all'}
              onChange={e => {
                const val = e.target.value;
                setSelectedCategoryId(val === 'all' ? undefined : parseInt(val, 10));
              }}
              className="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm focus:ring-2 focus:ring-blue-600 outline-none text-slate-800 dark:text-slate-200 font-semibold"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {!loading && (
            <Badge className="bg-orange-500/10 text-orange-600 border-orange-200 px-4 py-1.5 font-bold self-start md:self-auto h-10 flex items-center">
              {appeals.length} Pending Appeals
            </Badge>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900">
          <AlertCircle className="text-rose-600" size={18} />
          <p className="text-rose-700 dark:text-rose-400 font-medium text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {loading
          ? [1,2,3].map(i => <Skeleton key={i} className="h-44 rounded-2xl animate-pulse" />)
          : appeals.length === 0
            ? (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                <ShieldAlert size={40} className="text-slate-350 dark:text-slate-650 mb-3 animate-bounce" />
                <p className="text-slate-500 font-medium">No appealed cases at the moment.</p>
              </div>
            )
            : appeals.map(appeal => {
              const complaint = appeal.Complaint;
              const subject = complaint?.problem?.split('\n')[0].substring(0, 80) || `Appeal #${appeal.id}`;
              return (
                <Card
                  key={appeal.id}
                  className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 shadow-sm overflow-hidden"
                >
                  <div className="flex flex-col lg:flex-row">
                    <div className="p-6 flex-1 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/30 flex items-center justify-center text-orange-655">
                          <ShieldAlert size={22} />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                            {subject}
                          </h3>
                          <p className="text-xs text-slate-500 font-medium">
                            Case ID: #{appeal.complaint_id}
                          </p>
                        </div>
                      </div>

                      {appeal.reason && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Appeal Reason</p>
                          <div className="p-4 rounded-xl bg-orange-50/20 dark:bg-orange-955/10 border border-orange-100/50 dark:border-orange-900/40 text-slate-700 dark:text-slate-300 text-sm leading-relaxed italic">
                            "{appeal.reason}"
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-6 pt-2">
                        {complaint?.createdAt && (
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <History size={14} /> Original: {new Date(complaint.createdAt).toLocaleDateString()}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs font-bold text-orange-600">
                          <AlertTriangle size={14} /> Appealed: {new Date(appeal.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div className="lg:w-72 p-6 bg-slate-50/50 dark:bg-slate-900/30 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800 flex flex-col justify-center gap-3">
                      <Link to={`/officer/complaints/${appeal.complaint_id}`}>
                        <Button variant="outline" className="w-full gap-2 font-bold h-11 border-slate-300 dark:border-slate-800">
                          View Case <ArrowRight size={16} />
                        </Button>
                      </Link>

                      <textarea
                        id={`response-text-${appeal.id}`}
                        value={responseTexts[appeal.id] ?? ''}
                        onChange={e => handleResponseTextChange(appeal.id, e.target.value)}
                        placeholder="Write your response to this appeal…"
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-600 outline-none resize-none"
                      />

                      <Button
                        id={`mark-reviewed-${appeal.id}`}
                        disabled={marking === appeal.id}
                        onClick={() => handleMarkReviewed(appeal.id)}
                        className="w-full gap-2 font-bold h-11 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20"
                      >
                        <CheckCircle2 size={16} />
                        {marking === appeal.id ? 'Updating…' : 'Mark as Reviewed'}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
        }
      </div>
    </div>
  );
}