import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Plus, Settings2, Trash2, GitPullRequest, ArrowRight, Play } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { cn } from '../../lib/utils';
import type { WorkflowConfig } from '../../types/workflow';

export default function WorkflowBuilder() {
  const [workflows, setWorkflows] = React.useState<WorkflowConfig[]>([
    {
      id: '1',
      name: 'IT Support Request',
      description: 'Standard flow for technical assistance',
      category: 'IT',
      initialStepId: 'step-1',
      steps: [
        { id: 'step-1', name: 'Submission', role: 'sender', fields: [], actions: [] },
        { id: 'step-2', name: 'Technical Review', role: 'receiver', fields: [], actions: [] },
        { id: 'step-3', name: 'Resolution', role: 'receiver', fields: [], actions: [] },
      ]
    }
  ]);

  const [selectedWorkflow, setSelectedWorkflow] = React.useState<WorkflowConfig | null>(workflows[0]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workflow Builder</h1>
          <p className="text-muted-foreground">Design and configure dynamic process flows</p>
        </div>
        <Button className="gap-2">
          <Plus size={18} />
          Create New Workflow
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar: Workflow List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Workflows</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {workflows.map(wf => (
              <button
                key={wf.id}
                onClick={() => setSelectedWorkflow(wf)}
                className={cn(
                  "w-full text-left p-4 rounded-lg transition-colors flex items-center gap-3",
                  selectedWorkflow?.id === wf.id ? "bg-primary/10 text-primary border border-primary/20" : "hover:bg-accent"
                )}
              >
                <GitPullRequest size={18} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{wf.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{wf.category}</p>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Main: Visual Builder */}
        <Card className="lg:col-span-3 min-h-[600px] relative overflow-hidden">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{selectedWorkflow?.name}</CardTitle>
                <CardDescription>{selectedWorkflow?.description}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-2">
                  <Play size={14} /> Preview
                </Button>
                <Button size="sm">Save Changes</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 bg-slate-50/50 dark:bg-slate-900/50 min-h-[500px]">
            <div className="flex flex-col items-center gap-12 relative">
              {selectedWorkflow?.steps.map((step, idx) => (
                <React.Fragment key={step.id}>
                  <div className="w-full max-w-md group">
                    <Card className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-primary transition-all">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <Badge variant="secondary" className="capitalize">{step.role}</Badge>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-8 w-8"><Settings2 size={14} /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 size={14} /></Button>
                          </div>
                        </div>
                        <h4 className="font-bold text-lg mb-1">{step.name}</h4>
                        <p className="text-sm text-muted-foreground">0 fields defined • 2 actions</p>

                        <Button variant="ghost" size="sm" className="w-full mt-4 border border-slate-200 dark:border-slate-800 border-dashed hover:border-primary hover:bg-primary/5">
                          <Plus size={14} className="mr-2" /> Add Field
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                  {idx < selectedWorkflow.steps.length - 1 && (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-0.5 h-12 bg-slate-200 dark:bg-slate-800 relative">
                        <ArrowRight size={20} className="absolute -bottom-2.5 -left-[9px] rotate-90 text-slate-300 dark:text-slate-700" />
                      </div>
                    </div>
                  )}
                </React.Fragment>
              ))}

              <Button variant="outline" className="border-dashed border-2 h-16 w-full max-w-md">
                <Plus size={20} className="mr-2" /> Add New Step
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

