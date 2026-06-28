export type WorkflowRole = 'student' | 'officer' | 'manager' | 'admin'|'super_admin';

export type ComplaintStatus = 'pending' | 'in_progress' | 'resolved' | 'appealed';

export type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'date' | 'file' | 'checkbox';

export interface WorkflowField {
  id: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required: boolean;
  options?: { label: string; value: string }[];
  validation?: string;
  defaultValue?: any;
}

export interface Complaint {
  id: string;
  studentId: string;
  studentName: string;
  category: string;
  subject: string;
  description: string;
  aiSummary?: string;
  aiPriority: 'low' | 'medium' | 'high' | 'critical';
  status: ComplaintStatus;
  resolution?: string;
  appealReason?: string;
  createdAt: string;
  updatedAt: string;
  timeline: {
    status: ComplaintStatus;
    performedBy: string;
    timestamp: string;
    comment?: string;
  }[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  type?: 'text' | 'card' | 'follow_up';
  data?: any; // For cards or follow-up questions
  attachment?: { name: string; url?: string };
  timestamp: string;
}
export type RequestStatus = ComplaintStatus;

export interface WorkflowConfig {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: any[];
  initialStepId: string;
}
