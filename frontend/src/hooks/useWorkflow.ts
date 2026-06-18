import { useState, useEffect } from 'react';
import type { WorkflowConfig } from '../types/workflow';

export function useWorkflow(workflowId?: string) {
  const [workflow, setWorkflow] = useState<WorkflowConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workflowId) return;

    const fetchWorkflow = async () => {
      try {
        setLoading(true);
       
        setTimeout(() => {
          setWorkflow({
            id: workflowId,
            name: 'Demo Workflow',
            description: 'This is a dynamic workflow config from API',
            category: 'General',
            initialStepId: '1',
            steps: []
          });
          setLoading(false);
        }, 500);
      } catch (err) {
        setError('Failed to load workflow configuration');
        setLoading(false);
      }
    };

    fetchWorkflow();
  }, [workflowId]);

  return { workflow, loading, error };
}
