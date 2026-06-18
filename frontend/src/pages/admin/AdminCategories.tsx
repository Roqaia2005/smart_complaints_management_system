import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import {
  Plus,
  Search,
  MoreVertical,
  Grid,
  Trash2,
  Edit,
  Tag,
  ShieldCheck,
  Zap,
  Library
} from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';

export default function AdminCategories() {
  const categories = [
    { id: '1', name: 'Technical / IT', parent: 'Central Services', icon: Zap, color: 'text-blue-500', active: true, subcategories: 12 },
    { id: '2', name: 'Academic Affairs', parent: 'Education', icon: Library, color: 'text-purple-500', active: true, subcategories: 8 },
    { id: '3', name: 'Facilities', parent: 'Campus Ops', icon: Grid, color: 'text-orange-500', active: true, subcategories: 15 },
    { id: '4', name: 'Student Records', parent: 'Administration', icon: ShieldCheck, color: 'text-emerald-500', active: true, subcategories: 5 },
  ];

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Category Architecture</h1>
          <p className="text-slate-500 font-medium">Define and organize complaint categories and sub-categories</p>
        </div>
        <Button className="gap-2 bg-blue-600 hover:bg-blue-700 font-bold h-11 px-6 shadow-lg shadow-blue-500/20">
          <Plus size={18} /> Add Category
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {categories.map((cat) => (
          <Card key={cat.id} className="border-none shadow-sm group hover:ring-2 hover:ring-blue-600 transition-all">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div className={cn("p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 group-hover:scale-110 transition-transform", cat.color)}>
                  <cat.icon size={24} />
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600"><Edit size={14} /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-600"><Trash2 size={14} /></Button>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-800 dark:text-white leading-tight mb-1">{cat.name}</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{cat.parent}</p>

                <div className="mt-6 pt-4 border-t dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">{cat.subcategories} Sub-categories</span>
                  <Badge className="bg-emerald-500/10 text-emerald-600 text-[10px] font-bold">ACTIVE</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        <button className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-slate-400 hover:border-blue-500 hover:text-blue-600 transition-all min-h-[220px] bg-slate-50/50 dark:bg-slate-900/30">
          <div className="w-12 h-12 rounded-full border-2 border-dashed border-current flex items-center justify-center mb-4">
            <Plus size={24} />
          </div>
          <p className="font-bold uppercase tracking-widest text-xs">Create New</p>
        </button>
      </div>
    </div>
  );
}

import { cn } from '../../lib/utils';
