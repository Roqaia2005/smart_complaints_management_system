import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Filter, Download, Map as MapIcon, Calendar, Layers,
  ChevronDown, AlertTriangle, BarChart2
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';
import { managerApi } from '../../api/services';
import type { HeatmapItem } from '../../types/api';

type Dimension = 'category' | 'location' | 'time' | 'department';

const DIMENSIONS: { key: Dimension; label: string }[] = [
  { key: 'category',   label: 'By Category' },
  { key: 'location',   label: 'By Location' },
  { key: 'time',       label: 'By Month' },
  { key: 'department', label: 'By Department' },
];

function getBarColor(pct: number) {
  if (pct > 75) return 'bg-rose-500';
  if (pct > 50) return 'bg-orange-500';
  if (pct > 25) return 'bg-amber-500';
  return 'bg-blue-400';
}

export default function ManagerHeatmap() {
  const [dimension, setDimension] = useState<Dimension>('category');
  const [data, setData]           = useState<HeatmapItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    managerApi.getHeatmap(dimension)
      .then(res => setData(res.data.heatmap ?? []))
      .catch(err => setError(err.message || 'Failed to load heatmap'))
      .finally(() => setLoading(false));
  }, [dimension]);

  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Complaint Heatmap</h1>
          <p className="text-slate-500 font-medium">Visualize complaint density across categories, locations, and time</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar: dimension selector */}
        <Card className="lg:col-span-1 border-none shadow-sm h-fit">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Filter size={16} /> View Dimension
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {DIMENSIONS.map(d => (
              <Button
                key={d.key}
                id={`dim-${d.key}`}
                variant={dimension === d.key ? 'default' : 'ghost'}
                onClick={() => setDimension(d.key)}
                className={cn(
                  "w-full justify-start font-bold h-10",
                  dimension === d.key && "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {dimension === d.key && <div className="w-1.5 h-1.5 rounded-full bg-white mr-2" />}
                {d.label}
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* Main heatmap */}
        <Card className="lg:col-span-3 border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-800 flex flex-row items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <BarChart2 size={14} />
                {DIMENSIONS.find(d => d.key === dimension)?.label}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-blue-400" />
                <span className="text-[10px] font-bold text-slate-400">LOW</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-rose-500" />
                <span className="text-[10px] font-bold text-slate-400">HIGH</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {error && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 mb-4">
                <AlertTriangle className="text-rose-600" size={18} />
                <p className="text-rose-700 font-medium text-sm">{error}</p>
              </div>
            )}

            {loading ? (
              <div className="space-y-3">
                {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
              </div>
            ) : data.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <MapIcon size={40} className="text-slate-300 mb-3" />
                <p className="text-slate-500 font-medium">No data available for this dimension</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.map((item, i) => {
                  const pct = Math.round((item.count / maxCount) * 100);
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center gap-4"
                    >
                      <div className="w-32 text-xs font-bold text-slate-600 dark:text-slate-400 truncate text-right shrink-0">
                        {item.label}
                      </div>
                      <div className="flex-1 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden relative">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ delay: i * 0.04 + 0.1, duration: 0.5 }}
                          className={cn("h-full rounded-xl flex items-center justify-end pr-3", getBarColor(pct))}
                        >
                          {pct > 15 && (
                            <span className="text-[10px] font-bold text-white">{item.count}</span>
                          )}
                        </motion.div>
                        {pct <= 15 && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">
                            {item.count}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
