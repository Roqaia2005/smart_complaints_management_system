import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  ShieldAlert,
  User as UserIcon,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  History
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function OfficerAppeals() {
  const appeals = [
    { id: '1075', subject: 'Cafeteria Quality Issue', student: 'Mona Khan', reason: 'The resolution said it was fixed but the food is still cold and undercooked today.', originalDate: '2024-04-24', appealDate: '2024-04-25' },
    { id: '1024', subject: 'WiFi Downtime building B', student: 'Ahmed Ali', reason: 'I was only given access to building A wifi, but my dorm is in B.', originalDate: '2024-04-20', appealDate: '2024-04-22' },
  ];

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Appealed Cases</h1>
          <p className="text-slate-500 font-medium">Re-review complaints where students requested an appeal</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-orange-500/10 text-orange-600 border-orange-200 px-4 py-1.5 font-bold">
            {appeals.length} Pending Appeals
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {appeals.map((appeal) => (
          <Card key={appeal.id} className="border-orange-100 dark:border-orange-900 shadow-lg shadow-orange-500/5 overflow-hidden">
            <div className="flex flex-col lg:flex-row">
              <div className="p-6 flex-1 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600">
                    <ShieldAlert size={22} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{appeal.subject}</h3>
                    <p className="text-xs text-slate-500 font-medium">Case ID: #{appeal.id} • Submitted by {appeal.student}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Appeal Reason</p>
                  <div className="p-4 rounded-xl bg-orange-50/50 dark:bg-orange-950/10 border border-orange-100 dark:border-orange-900 text-slate-700 dark:text-slate-300 text-sm leading-relaxed italic">
                    "{appeal.reason}"
                  </div>
                </div>

                <div className="flex items-center gap-6 pt-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <History size={14} /> Resolved: {appeal.originalDate}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-orange-600">
                    <AlertTriangle size={14} /> Appealed: {appeal.appealDate}
                  </div>
                </div>
              </div>

              <div className="lg:w-72 p-6 bg-slate-50 dark:bg-slate-900/50 border-l border-slate-100 dark:border-slate-800 flex flex-col justify-center gap-3">
                <Link to={`/officer/complaints/${appeal.id}`}>
                  <Button variant="outline" className="w-full gap-2 font-bold h-11 border-slate-300">
                    View Case <ArrowRight size={16} />
                  </Button>
                </Link>
                <Button className="w-full gap-2 font-bold h-11 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 size={16} /> Mark as Reviewed
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
