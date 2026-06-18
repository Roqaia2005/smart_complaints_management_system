import React from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import {
  Search,
  Filter,
  Eye,
  Clock,
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import type { RequestStatus } from '../../types/workflow';

export default function TaskInbox() {
  const [activeTab, setActiveTab] = React.useState<RequestStatus | 'all'>('all');

  const tasks = [
    { id: '4521', title: 'Laptop won\'t boot', user: 'Sarah Connor', priority: 'High', status: 'pending', time: '10m ago', category: 'IT Support' },
    { id: '882', title: 'New Keyboard Request', user: 'John Smith', priority: 'Low', status: 'in_progress', time: '1h ago', category: 'IT Support' },
    { id: '901', title: 'VPN Connection Issues', user: 'Mike Ross', priority: 'Medium', status: 'escalated', time: '2h ago', category: 'Network' },
    { id: '772', title: 'Software License Renewal', user: 'Rachel Zane', priority: 'Medium', status: 'pending', time: '4h ago', category: 'Software' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Task Inbox</h1>
          <p className="text-muted-foreground">Manage and process assigned workflow tasks</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-muted-foreground" size={18} />
            <Input placeholder="Search tasks..." className="pl-10 w-64" />
          </div>
          <Button variant="outline" className="gap-2">
            <Filter size={18} /> Filter
          </Button>
        </div>
      </div>

      <div className="flex gap-2 p-1 bg-accent/50 rounded-xl w-fit">
        {['all', 'pending', 'in_progress', 'escalated'].map(tab => (
          <Button
            key={tab}
            variant={activeTab === tab ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab(tab as any)}
            className="capitalize rounded-lg px-6"
          >
            {tab.replace('_', ' ')}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b bg-accent/30">
                  <th className="p-4 font-semibold text-sm">ID</th>
                  <th className="p-4 font-semibold text-sm">Request Title</th>
                  <th className="p-4 font-semibold text-sm">Sender</th>
                  <th className="p-4 font-semibold text-sm">Priority</th>
                  <th className="p-4 font-semibold text-sm">Status</th>
                  <th className="p-4 font-semibold text-sm">Time</th>
                  <th className="p-4 font-semibold text-sm">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tasks.filter(t => activeTab === 'all' || t.status === activeTab).map(task => (
                  <tr key={task.id} className="hover:bg-accent/20 transition-colors group">
                    <td className="p-4 text-sm font-mono text-muted-foreground">#{task.id}</td>
                    <td className="p-4">
                      <p className="font-semibold text-sm">{task.title}</p>
                      <p className="text-xs text-muted-foreground">{task.category}</p>
                    </td>
                    <td className="p-4 text-sm">{task.user}</td>
                    <td className="p-4">
                      <Badge variant={task.priority === 'High' ? 'destructive' : task.priority === 'Medium' ? 'warning' : 'info'}>
                        {task.priority}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {task.status === 'pending' && <Clock size={14} className="text-amber-500" />}
                        {task.status === 'in_progress' && <ArrowRight size={14} className="text-blue-500" />}
                        {task.status === 'escalated' && <AlertCircle size={14} className="text-rose-500" />}
                        <span className="text-xs font-bold uppercase tracking-wider">
                          {task.status.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-xs text-muted-foreground">{task.time}</td>
                    <td className="p-4">
                      <Button variant="ghost" size="icon" className="h-8 w-8 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        <Eye size={18} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
