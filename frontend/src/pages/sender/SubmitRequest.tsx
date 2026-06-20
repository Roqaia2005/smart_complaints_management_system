import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { DynamicForm } from '../../components/shared/DynamicForm';
import type { WorkflowConfig } from '../../types/workflow';
import { Sparkles, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/button';

export default function SubmitRequestPage() {
  const [step, setStep] = React.useState<'select' | 'form' | 'success'>('select');
  const [selectedWorkflow, setSelectedWorkflow] = React.useState<WorkflowConfig | null>(null);

  // Mock available workflows from Admin config
  const workflows: WorkflowConfig[] = [
    {
      id: '1',
      name: 'IT Support',
      description: 'Request help with hardware, software, or network issues.',
      category: 'IT',
      initialStepId: 's1',
      steps: [
        {
          id: 's1',
          name: 'Details',
          role: 'sender',
          fields: [
            { id: 'title', label: 'Issue Title', type: 'text', required: true, placeholder: 'e.g. My laptop won\'t start' },
            {
              id: 'priority', label: 'Urgency', type: 'select', required: true, options: [
                { label: 'Low - I can still work', value: 'low' },
                { label: 'Medium - Impacting productivity', value: 'medium' },
                { label: 'High - Critical blocker', value: 'high' }
              ]
            },
            { id: 'desc', label: 'Detailed Description', type: 'textarea', required: true, placeholder: 'Tell us more about what happened...' }
          ],
          actions: []
        }
      ]
    },
    {
      id: '2',
      name: 'HR Inquiry',
      description: 'Ask questions about benefits, payroll, or leave.',
      category: 'HR',
      initialStepId: 'h1',
      steps: [
        {
          id: 'h1',
          name: 'Inquiry',
          role: 'sender',
          fields: [
            {
              id: 'type', label: 'Inquiry Type', type: 'select', required: true, options: [
                { label: 'Benefits', value: 'benefits' },
                { label: 'Payroll', value: 'payroll' },
                { label: 'Leave Request', value: 'leave' }
              ]
            },
            { id: 'message', label: 'Your Question', type: 'textarea', required: true }
          ],
          actions: []
        }
      ]
    }
  ];

  const handleSelect = (wf: WorkflowConfig) => {
    setSelectedWorkflow(wf);
    setStep('form');
  };

  const handleSubmit = (data: any) => {
    console.log('Submitted Data:', data);
    setStep('success');
  };

  if (step === 'success') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] text-center space-y-6">
        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500">
          <CheckCircle2 size={48} />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Request Submitted!</h1>
          <p className="text-muted-foreground max-w-md">
            Your {selectedWorkflow?.name} request has been successfully created. You can track its progress in "My Requests".
          </p>
        </div>
        <div className="flex gap-4">
          <Button onClick={() => setStep('select')} variant="outline">Submit Another</Button>
          <Button>View My Requests</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {step === 'form' && (
        <Button variant="ghost" onClick={() => setStep('select')} className="mb-4">
          <ArrowLeft size={18} className="mr-2" /> Back to Categories
        </Button>
      )}

      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          {step === 'select' ? 'What can we help you with?' : `Submit ${selectedWorkflow?.name}`}
          {step === 'select' && <Sparkles className="text-primary" size={28} />}
        </h1>
        <p className="text-muted-foreground text-lg">
          {step === 'select'
            ? 'Select a workflow category to get started.'
            : `Please fill out the details below to initiate your request.`}
        </p>
      </div>

      {step === 'select' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {workflows.map(wf => (
            <Card
              key={wf.id}
              className="cursor-pointer hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all group border-2 border-transparent"
              onClick={() => handleSelect(wf)}
            >
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-4 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <Sparkles size={24} />
                </div>
                <CardTitle>{wf.name}</CardTitle>
                <CardDescription className="text-base">{wf.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="shadow-2xl border-white/10">
          <CardContent className="p-8">
            <DynamicForm
              fields={selectedWorkflow?.steps[0].fields || []}
              onSubmit={handleSubmit}
              submitLabel="Initiate Workflow"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
