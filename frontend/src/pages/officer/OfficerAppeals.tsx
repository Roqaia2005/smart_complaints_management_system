import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import {
  ShieldAlert, ArrowRight, CheckCircle2, AlertTriangle,
  History, AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { officerApi } from '../../api/services';
import type { Appeal } from '../../types/api';

// Officer's assigned category — should come from auth context in a full app
const CATEGORY_ID = 1;

export default function OfficerAppeals() {
  const [appeals, setAppeals]   = useState<Appeal[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [marking, setMarking]   = useState<number | null>(null);
  const [toast, setToast]       = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    officerApi.getAppeals(CATEGORY_ID)
      .then(res => setAppeals(res.data.appeals ?? res.data ?? []))
      .catch(err => setError(err.response?.data?.error ?? err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleMarkReviewed = async (id: number) => {
    setMarking(id);
    try {
      await officerApi.markAppealReviewed(id);
      setToast('Appeal marked as reviewed');
      setTimeout(() => setToast(null), 3000);
      load();
    } catch (err: any) {
      setToast('Failed to update: ' + (err.response?.data?.error ?? err.message));
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

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Appealed Cases</h1>
          <p className="text-slate-500 font-medium">Re-review complaints where students requested an appeal</p>
        </div>
        {!loading && (
          <Badge className="bg-orange-500/10 text-orange-600 border-orange-200 px-4 py-1.5 font-bold self-start md:self-auto">
            {appeals.length} Pending Appeals
          </Badge>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200">
          <AlertCircle className="text-rose-600" size={18} />
          <p className="text-rose-700 font-medium text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {loading
          ? [1,2,3].map(i => <Skeleton key={i} className="h-44 rounded-2xl" />)
          : appeals.length === 0
            ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <ShieldAlert size={40} className="text-slate-300 mb-3" />
                <p className="text-slate-500 font-medium">No appealed cases at the moment.</p>
              </div>
            )
            : appeals.map(appeal => {
              const complaint = appeal.Complaint;
              return (
                <Card
                  key={appeal.id}
                  className="border-orange-100 dark:border-orange-900 shadow-lg shadow-orange-500/5 overflow-hidden"
                >
                  <div className="flex flex-col lg:flex-row">
                    <div className="p-6 flex-1 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600">
                          <ShieldAlert size={22} />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold">
                            {complaint?.problem?.slice(0, 60) ?? `Appeal #${appeal.id}`}
                            {(complaint?.problem?.length ?? 0) > 60 ? '…' : ''}
                          </h3>
                          <p className="text-xs text-slate-500 font-medium">
                            Case #: {appeal.complaint_id}
                          </p>
                        </div>
                      </div>

                      {appeal.reason && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Appeal Reason</p>
                          <div className="p-4 rounded-xl bg-orange-50/50 dark:bg-orange-950/10 border border-orange-100 dark:border-orange-900 text-slate-700 dark:text-slate-300 text-sm leading-relaxed italic">
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

                    <div className="lg:w-72 p-6 bg-slate-50 dark:bg-slate-900/50 border-l border-slate-100 dark:border-slate-800 flex flex-col justify-center gap-3">
                      <Link to={`/officer/complaints/${appeal.complaint_id}`}>
                        <Button variant="outline" className="w-full gap-2 font-bold h-11 border-slate-300">
                          View Case <ArrowRight size={16} />
                        </Button>
                      </Link>
                      <Button
                        id={`mark-reviewed-${appeal.id}`}
                        disabled={marking === appeal.id}
                        onClick={() => handleMarkReviewed(appeal.id)}
                        className="w-full gap-2 font-bold h-11 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20"
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
