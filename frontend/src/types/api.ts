// ── Categories ────────────────────────────────────────────────────────────
export interface Category {
  id: number;
  name: string;
  description?: string;
  sla_hours?: number;
  faculty_id?: number;
  is_active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// ── Users ─────────────────────────────────────────────────────────────────
export interface SystemUser {
  id: number;
  full_name: string;
  email: string;
  role: 'student' | 'officer' | 'manager' | 'admin' | 'super_admin';
  is_active: boolean;
  createdAt?: string;
}

// ── Complaint ─────────────────────────────────────────────────────────────
export interface Complaint {
  id: number;
  user_id: number;
  category_id: number;
  problem: string;
  location?: string;
  ai_summary?: string;
  priority?: number;
  status: 'pending' | 'in_progress' | 'resolved' | 'appealed';
  resolution_text?: string;
  resolved_at?: string;
  createdAt: string;
  updatedAt?: string;
  Category?: { id: number; name: string };
  User?: {
    full_name?: string;
    email?: string;
    Student?: {
      id: number;
      department?: string;
      Faculty?: { name: string };
    };
  };
  ComplaintHistories?: ComplaintHistory[];
}

export interface ComplaintHistory {
  id: number;
  complaint_id: number;
  status: string;
  note?: string;
  createdAt: string;
}

// ── Appeal ────────────────────────────────────────────────────────────────
export interface Appeal {
  id: number;
  complaint_id: number;
  reason?: string;
  status?: string;
  response_text?: string;
  responded_at?: string;
  createdAt: string;
  Complaint?: Complaint;
}

// ── Regulation ────────────────────────────────────────────────────────────
export interface Regulation {
  id: number;
  article_number?: string;
  content: string;
  type?: string;
  faculty_id?: number;
  createdAt?: string;
}

// ── Priority Rule ─────────────────────────────────────────────────────────
export interface PriorityRule {
  id: number;
  priority_level: number;
  description?: string;
  examples?: string[];
  faculty_id?: number;
  updatedAt?: string;
}

// ── Audit Log ─────────────────────────────────────────────────────────────
export interface AuditLog {
  user_name: string;
  action: string;
  entity_type: string;
  entity_id?: number;
  created_at: string;
}

// ── Manager: Overview ─────────────────────────────────────────────────────
export interface OverviewData {
  total: number;
  pending: number;
  resolved: number;
  inProgress: number;
  appealed: number;
}

// ── Manager: Department Performance ──────────────────────────────────────
export interface DepartmentPerformance {
  name: string;
  total: number;
  resolved: number;
  avg_hours: number;
}

// ── Manager: Heatmap ──────────────────────────────────────────────────────
export interface HeatmapItem {
  label: string;
  count: number;
}

// ── Manager: Reports ──────────────────────────────────────────────────────
export interface ReportsResponse {
  complaints: Complaint[];
  total_count: number;
}
