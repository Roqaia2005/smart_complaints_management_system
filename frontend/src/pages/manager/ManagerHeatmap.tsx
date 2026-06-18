import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Filter,
  Download,
  Maximize2,
  Map as MapIcon,
  Calendar,
  Layers,
  ChevronDown
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

export default function ManagerHeatmap() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = ['8am', '10am', '12pm', '2pm', '4pm', '6pm', '8pm', '10pm'];

  // Mock intensity data (0-100)
  const data = Array.from({ length: 7 }, () => Array.from({ length: 8 }, () => Math.floor(Math.random() * 100)));

  const getIntensityColor = (value: number) => {
    if (value > 80) return 'bg-rose-500 text-white';
    if (value > 60) return 'bg-orange-500 text-white';
    if (value > 40) return 'bg-amber-500 text-white';
    if (value > 20) return 'bg-blue-400 text-white';
    return 'bg-blue-100 dark:bg-slate-800 text-transparent';
  };

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Complaint Heatmap</h1>
          <p className="text-slate-500 font-medium">Visualize complaint density across time and location</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2 font-bold"><Download size={18} /> Export View</Button>
          <Button className="gap-2 bg-blue-600 hover:bg-blue-700 font-bold shadow-lg shadow-blue-500/20">
            <Maximize2 size={18} /> Fullscreen
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <Card className="lg:col-span-1 border-none shadow-sm h-fit">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Filter size={16} /> Data Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Location</label>
              <Button variant="outline" className="w-full justify-between font-semibold h-11 border-slate-200 dark:border-slate-800">
                All Campus <ChevronDown size={16} />
              </Button>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Category</label>
              <Button variant="outline" className="w-full justify-between font-semibold h-11 border-slate-200 dark:border-slate-800">
                All Categories <ChevronDown size={16} />
              </Button>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Time Range</label>
              <div className="grid grid-cols-1 gap-2">
                {['Last 24 Hours', 'Last 7 Days', 'Last 30 Days', 'Custom Range'].map(range => (
                  <Button key={range} variant="ghost" className="justify-start text-xs font-bold h-10 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-600 dark:text-slate-400 hover:text-blue-600">
                    {range === 'Last 7 Days' && <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mr-2" />}
                    {range}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-800 flex flex-row items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <Calendar size={14} /> Time Distribution
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 border-l pl-4">
                <Layers size={14} /> Density Map
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-blue-100 dark:bg-slate-800" />
                <span className="text-[10px] font-bold text-slate-400">LOW</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-rose-500" />
                <span className="text-[10px] font-bold text-slate-400">HIGH</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="relative">
              {/* Hour labels */}
              <div className="grid grid-cols-8 gap-2 mb-4 ml-12">
                {hours.map(h => (
                  <div key={h} className="text-[10px] font-bold text-slate-400 text-center uppercase">{h}</div>
                ))}
              </div>

              {/* Day rows */}
              <div className="space-y-2">
                {days.map((day, dayIdx) => (
                  <div key={day} className="flex items-center gap-4">
                    <div className="w-8 text-[10px] font-bold text-slate-400 uppercase">{day}</div>
                    <div className="grid grid-cols-8 gap-2 flex-1">
                      {data[dayIdx].map((val, hourIdx) => (
                        <motion.div
                          key={hourIdx}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: (dayIdx * 8 + hourIdx) * 0.01 }}
                          className={cn(
                            "h-10 rounded-lg flex items-center justify-center text-[10px] font-bold transition-all hover:ring-2 hover:ring-blue-500 cursor-pointer",
                            getIntensityColor(val)
                          )}
                        >
                          {val > 40 && val}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 p-6 rounded-2xl bg-blue-600 text-white flex items-center justify-between shadow-xl shadow-blue-500/20">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                  <MapIcon size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-lg">Predictive Insight</h4>
                  <p className="text-blue-100 text-sm">Complaint volume is expected to rise by 25% on Thursday morning due to Registration.</p>
                </div>
              </div>
              <Button className="bg-white text-blue-600 hover:bg-blue-50 font-bold px-6">View Forecast</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
