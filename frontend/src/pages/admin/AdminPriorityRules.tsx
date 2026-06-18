import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Save,
  RotateCcw,
  ShieldAlert,
  Clock,
  Zap,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';

export default function AdminPriorityRules() {
  const [rules, setRules] = React.useState([
    { level: 'Critical', color: 'bg-rose-500', time: '2h', description: 'Immediate safety or infrastructure failure impacting >100 students' },
    { level: 'High', color: 'bg-orange-500', time: '6h', description: 'Academic blockers or significant service disruptions' },
    { level: 'Medium', color: 'bg-blue-500', time: '24h', description: 'Standard service issues impacting individual students' },
    { level: 'Low', color: 'bg-slate-500', time: '72h', description: 'General inquiries or minor cosmetic issues' },
    { level: 'Informational', color: 'bg-slate-400', time: '120h', description: 'Feedback and suggestions for long-term improvement' },
  ]);

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Priority Logic Engine</h1>
          <p className="text-slate-500 font-medium">Configure SLA targets and urgency classification rules</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2 font-bold"><RotateCcw size={18} /> Reset Defaults</Button>
          <Button className="gap-2 bg-blue-600 hover:bg-blue-700 font-bold shadow-lg shadow-blue-500/20">
            <Save size={18} /> Save Changes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {rules.map((rule, i) => (
          <Card key={rule.level} className="overflow-hidden border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-200 transition-all group">
            <div className="flex flex-col md:flex-row items-stretch">
              <div className={cn("w-full md:w-48 flex flex-col items-center justify-center p-6 text-white", rule.color)}>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1">Level {5 - i}</p>
                <h3 className="text-xl font-bold">{rule.level}</h3>
              </div>
              <CardContent className="flex-1 p-6 grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    SLA Target <HelpCircle size={10} />
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 text-slate-400" size={16} />
                    <Input
                      value={rule.time}
                      onChange={(e) => {
                        const newRules = [...rules];
                        newRules[i].time = e.target.value;
                        setRules(newRules);
                      }}
                      className="pl-10 font-bold text-slate-800 dark:text-white"
                    />
                  </div>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Logic Description</label>
                  <Input
                    value={rule.description}
                    onChange={(e) => {
                      const newRules = [...rules];
                      newRules[i].description = e.target.value;
                      setRules(newRules);
                    }}
                    className="font-medium text-slate-600 dark:text-slate-400"
                  />
                </div>
              </CardContent>
            </div>
          </Card>
        ))}
      </div>

      <Card className="bg-blue-600 text-white border-none overflow-hidden relative">
        <div className="absolute right-[-20px] top-[-20px] opacity-10">
          <Zap size={200} />
        </div>
        <CardContent className="p-8 relative z-10 flex flex-col md:flex-row items-center gap-8">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
            <ShieldAlert size={32} />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h4 className="text-xl font-bold mb-2">Automated Escalation Rule</h4>
            <p className="text-blue-100 text-sm leading-relaxed max-w-2xl">
              When a complaint is marked as <span className="font-bold text-white italic">Critical</span>, the system will automatically notify the Dean's Office and the Head of Department if not resolved within 1 hour.
            </p>
          </div>
          <Button className="bg-white text-blue-600 hover:bg-blue-50 font-bold px-8">Edit Escalation</Button>
        </CardContent>
      </Card>
    </div>
  );
}
