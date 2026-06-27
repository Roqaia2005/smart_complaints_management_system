import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Filter, RefreshCw, AlertTriangle, BarChart3 } from 'lucide-react';
import { managerApi } from '../../api/services';
import type { HeatmapResponse } from '../../types/api';

const dimensions = [
  { value: 'category', label: 'Category' },
  { value: 'location', label: 'Location' },
  { value: 'time', label: 'Time' },
  { value: 'department', label: 'Department' },
] as const;

export default function ManagerHeatmap() {
  const [dimension, setDimension] = useState<(typeof dimensions)[number]['value']>('category');
  const [items, setItems] = useState<HeatmapResponse['heatmap']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await managerApi.getHeatmap(dimension);
      const payload = response.data as HeatmapResponse;
      setItems(payload.heatmap ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load heatmap data.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dimension]);

  const maxCount = useMemo(() => Math.max(...items.map((item) => item.count), 1), [items]);

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Complaint Analysis</h1>
          <p className="text-slate-500 font-medium">Distribution of complaints by the selected dimension from the backend.</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={loadData} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-col gap-4 border-b dark:border-slate-800 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-lg">Analysis data</CardTitle>
            <p className="text-xs font-medium text-slate-500">The backend returns a simple distribution list, which is rendered here as a compact intensity view.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">
              <Filter size={16} /> Dimension
            </div>
            {dimensions.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={dimension === option.value ? 'default' : 'outline'}
                onClick={() => setDimension(option.value)}
                className={dimension === option.value ? 'bg-blue-600 hover:bg-blue-700' : ''}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {error && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-700">
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="rounded-xl border border-slate-200 p-8 text-sm text-slate-500">Loading heatmap…</div>
          ) : (
            <div className="space-y-4">
              {items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">No heatmap data returned for this dimension.</div>
              ) : (
                items.map((item) => (
                  <div key={item.label} className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                      <span>{item.label}</span>
                      <span>{item.count}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: `${(item.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
