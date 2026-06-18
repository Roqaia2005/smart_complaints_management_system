import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Sparkles,
  Brain,
  CheckCircle2,
  XCircle,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  Zap
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

export default function ManagerRecommendations() {
  const recommendations = [
    {
      id: '1',
      pattern: 'High volume of "WiFi Downtime" complaints in Building B between 8:00 PM and 10:00 PM.',
      insight: 'The current router capacity in Building B is insufficient for peak evening usage by dormitory students.',
      recommendation: 'Upgrade to high-density access points and implement load balancing for Building B network nodes.',
      impact: 'Expected to reduce technical complaints by 40% and improve student satisfaction.',
      priority: 'High',
      confidence: 94
    },
    {
      id: '2',
      pattern: 'Recurring complaints about "Food Temperature" at the Main Cafeteria specifically on Mondays.',
      insight: 'Monday delivery schedules are causing delays in kitchen prep, leading to pre-cooked meals sitting longer.',
      recommendation: 'Reschedule Monday deliveries to Sunday evening or adjust Monday meal prep start times by 60 minutes.',
      impact: 'Elimination of recurring temperature-related complaints and reduced food waste.',
      priority: 'Medium',
      confidence: 88
    },
    {
      id: '3',
      pattern: 'Spike in "Registration Errors" for the Computer Science department during the first 2 hours of enrollment.',
      insight: 'System bottleneck identified in the prerequisite validation service during high concurrency.',
      recommendation: 'Implement a caching layer for student transcripts and increase worker nodes for the validation service.',
      impact: '90% reduction in system timeout errors during peak registration periods.',
      priority: 'Critical',
      confidence: 91
    }
  ];

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="text-blue-600" size={24} />
            <h1 className="text-3xl font-bold">AI Recommendations</h1>
          </div>
          <p className="text-slate-500 font-medium">Data-driven suggestions to improve university services and operations</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right mr-4 hidden md:block">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Efficiency Gained</p>
            <p className="text-xl font-bold text-emerald-600">+18% This Month</p>
          </div>
          <Button className="bg-slate-900 text-white font-bold h-11 gap-2 shadow-xl shadow-slate-900/10">
            <Zap size={18} /> Optimization Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {recommendations.map((rec, i) => (
          <motion.div
            key={rec.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="overflow-hidden border-none shadow-lg shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-800">
              <div className="flex flex-col lg:flex-row">
                <div className="p-8 flex-1 space-y-6">
                  <div className="flex items-center justify-between">
                    <Badge className={cn(
                      "font-bold px-3 py-1 text-[10px] uppercase tracking-widest",
                      rec.priority === 'Critical' ? "bg-rose-500 text-white" : rec.priority === 'High' ? "bg-orange-500 text-white" : "bg-blue-500 text-white"
                    )}>
                      {rec.priority} Priority
                    </Badge>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                      <Brain size={14} /> AI Confidence: {rec.confidence}%
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2">
                        <TrendingUp size={14} /> Detected Pattern
                      </p>
                      <h3 className="text-xl font-bold text-slate-800 dark:text-white leading-tight">
                        {rec.pattern}
                      </h3>
                    </div>

                    <div className="p-5 rounded-2xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/50">
                      <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <Lightbulb size={14} /> Proposed Recommendation
                      </p>
                      <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                        {rec.recommendation}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t dark:border-slate-700">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Underlying Insight</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 italic">"{rec.insight}"</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Projected Impact</p>
                      <p className="text-sm font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 size={14} /> {rec.impact}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="lg:w-80 bg-slate-50 dark:bg-slate-900/30 p-8 flex flex-col justify-center gap-4 border-l dark:border-slate-700">
                  <Button className="w-full h-12 gap-2 font-bold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20">
                    <CheckCircle2 size={18} /> Implement
                  </Button>
                  <Button variant="outline" className="w-full h-12 gap-2 font-bold border-slate-200 dark:border-slate-700">
                    <XCircle size={18} /> Ignore Pattern
                  </Button>
                  <Button variant="ghost" className="w-full text-slate-500 hover:text-blue-600 font-bold gap-1">
                    Details <ArrowRight size={14} />
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
