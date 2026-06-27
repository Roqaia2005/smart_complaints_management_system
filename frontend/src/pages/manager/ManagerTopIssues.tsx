import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { AlertTriangle, Search, RefreshCw, ListChecks } from 'lucide-react';
import { managerApi } from '../../api/services';
import type { TopIssuesResponse } from '../../types/api';

export default function ManagerTopIssues() {
  const [categoryId, setCategoryId] = useState('');
  const [issues, setIssues] = useState<Array<Record<string, unknown> | string>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadIssues = async (id?: string) => {
    const resolvedId = id?.trim();
    if (!resolvedId) {
      setIssues([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await managerApi.getTopIssues(resolvedId);
      const payload = response.data as TopIssuesResponse;
      setIssues(payload.top_issues ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load top issues.');
      setIssues([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (categoryId) {
      loadIssues(categoryId);
    }
  }, [categoryId]);

  const issueItems = useMemo(() => issues.map((item, index) => {
    if (typeof item === 'string') {
      return { id: `${index}-${item}`, title: item };
    }

    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      const title = typeof record.title === 'string'
        ? record.title
        : typeof record.issue === 'string'
          ? record.issue
          : typeof record.name === 'string'
            ? record.name
            : JSON.stringify(record);
      return { id: `${index}-${title}`, title };
    }

    return { id: `${index}-unknown`, title: 'Unknown issue' };
  }), [issues]);

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Top Issues</h1>
          <p className="text-slate-500 font-medium">Inspect the most common concerns for a category from the backend analytics.</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => loadIssues(categoryId)} disabled={loading || !categoryId}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 text-slate-400" size={18} />
              <Input
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                placeholder="Category ID"
                className="pl-10 h-11"
              />
            </div>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => loadIssues(categoryId)} disabled={loading || !categoryId}>
              Load issues
            </Button>
          </div>

          {error && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-700">
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}

          {loading && (
            <div className="rounded-xl border border-slate-200 p-6 text-sm text-slate-500">Loading top issues…</div>
          )}

          {!loading && !error && !categoryId && (
            <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
              Enter a category ID to fetch the latest analytics-driven issues.
            </div>
          )}

          {!loading && !error && categoryId && issueItems.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
              No top issues returned for this category.
            </div>
          )}

          {!loading && !error && issueItems.length > 0 && (
            <div className="grid gap-3">
              {issueItems.map((item) => (
                <div key={item.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
                  <div className="rounded-full bg-blue-50 p-2 text-blue-600">
                    <ListChecks size={16} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{item.title}</p>
                    <p className="text-sm text-slate-500">From the latest analysis report for category {categoryId}.</p>
                  </div>
                  <Badge variant="secondary" className="ml-auto">Top issue</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}