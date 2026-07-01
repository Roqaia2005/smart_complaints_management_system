import { apiClient } from './adminApi';

// ── Student / Complaints ──────────────────────────────────────────────────
export const studentApi = {
  submitComplaint: (data: {
    user_id: number;
    category_id: number;
    problem: string;
    location?: string;
  }) => apiClient.post('/complaints', data),

  getMyComplaints: (student_id: number) =>
    apiClient.get(`/complaints/student/${student_id}`),

  getComplaintDetails: (id: number | string) =>
    apiClient.get(`/complaints/${id}`),

  submitAppeal: (id: number | string, reason: string, user_id: number) =>
    apiClient.post(`/complaints/${id}/appeal`, { reason, user_id }),

  getCategories: () =>
    apiClient.get('/complaints/categories'),
};

// ── Officer ───────────────────────────────────────────────────────────────
export const officerApi = {
  getDashboard: (category_id?: number | string, officer_id?: number) =>
    apiClient.get('/officer/dashboard', { params: { category_id, officer_id } }),

  getComplaints: (category_id?: number | string) =>
    apiClient.get('/officer/complaints', { params: category_id ? { category_id } : {} }),

  getComplaintDetails: (id: number | string) =>
    apiClient.get(`/officer/complaints/details/${id}`),

  updateComplaintStatus: (id: number | string, status: string, resolution_text?: string) =>
    apiClient.patch(`/officer/complaints/${id}/status`, { status, resolution_text }),

  getAppeals: (category_id?: number) =>
    apiClient.get('/officer/appeals', { params: { category_id } }),

  markAppealReviewed: (id: number | string) =>
    apiClient.patch(`/officer/appeals/${id}/review`, {}),
  
  getAllOfficers: () =>
  apiClient.get('/officer/all'),

   // Returns only the categories assigned to the logged-in officer via CategoryOfficer table
  getAssignedCategories: () =>
    apiClient.get('/officer/categories'),
};

// ── Manager ───────────────────────────────────────────────────────────────
export const managerApi = {
  getOverview: (category_id?: number | string) =>
    apiClient.get('/manager/dashboard', { params: category_id ? { category_id } : {} }),

  getDepartmentPerformance: () =>
    apiClient.get('/manager/department-performance'),

  getHeatmap: (dimension: 'category' | 'location' | 'time' | 'department') =>
    apiClient.get('/manager/heatmap', { params: { dimension } }),

  getReports: (filters?: { from?: string; to?: string; category_id?: number | string; status?: string }) =>
    apiClient.get('/manager/reports', { params: filters }),

  getTopIssues: (category_id?: number | string|null) =>
  apiClient.get('/manager/top-issue', { params: category_id ? { category_id } : {} }),
};

// ── Admin ─────────────────────────────────────────────────────────────────

// Shared role-specific payload shapes for createUser
type StudentPayload = {
  role: 'student';
  full_name: string;
  email: string;
  password: string;
  faculty_id: number;
  student_number: string;
  department?: string;
  academic_year?: number;
};

type OfficerPayload = {
  role: 'officer';
  full_name: string;
  email: string;
  password: string;
  faculty_id: number;
  officer_title?: string;
  category_ids: number[];
  is_also_manager?: boolean;
  manager_title?: string;
};

type ManagerPayload = {
  role: 'manager';
  full_name: string;
  email: string;
  password: string;
  faculty_id: number;
  manager_title: string;
};

export type CreateUserPayload = StudentPayload | OfficerPayload | ManagerPayload;

export const adminApi = {
  // ── Categories ──────────────────────────────────────────────────────────
  getCategories: () =>
    apiClient.get('/admin/categories'),

  addCategory: (data: {
    name: string;
    description?: string;
    sla_hours?: number;
    faculty_id?: number;
    keywords?: string;           // comma-separated, e.g. "schedule,timing"
    officer_ids?: number[];      // replaces the old responsible_id
  }) => apiClient.post('/admin/categories', data),

  updateCategory: (
    id: number,
    data: Partial<{ name: string; description: string; sla_hours: number; is_active: boolean }>,
  ) => apiClient.patch(`/admin/categories/${id}`, data),

  deleteCategory: (id: number) =>
    apiClient.delete(`/admin/categories/${id}`),

  // ── Users — General Management ──────────────────────────────────────────
  getUsers: () =>
    apiClient.get('/admin/users'),

  // Replaces the old addUser — now hits /users/create with a unified role-based payload
  createUser: (data: CreateUserPayload) =>
    apiClient.post('/admin/users/create', data),

  updateUser: (
    id: number,
    data: Partial<{
      full_name: string;
      email: string;
      role: string;
      is_active: boolean;
      officer_title: string;
      manager_title: string;
      is_also_manager: boolean;
    }>,
  ) => apiClient.patch(`/admin/users/${id}`, data),

  deleteUser: (id: number) =>
    apiClient.delete(`/admin/users/${id}`),

  // ── Users — CSV Bulk Import ──────────────────────────────────────────────
  // Step 1: upload the CSV; returns { import_id, preview: { total, valid, invalid, errors } }
  importUsersPreview: (file: File, role: 'student' | 'officer' | 'manager', faculty_id: number) => {
    const form = new FormData();
    form.append('file', file);
    form.append('role', role);
    form.append('targetRole', role);
    form.append('faculty_id', String(faculty_id));
    return apiClient.post('/admin/users/import/preview', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Step 2: confirm with the import_id returned from preview
  confirmImportUsers: (import_id: string) =>
    apiClient.post('/admin/users/import/confirm', { import_id }),

  // ── Officers ────────────────────────────────────────────────────────────
  setOfficerManagerFlag: (
    id: number,
    data: { is_also_manager: boolean; manager_title?: string },
  ) => apiClient.patch(`/admin/officers/${id}/manager-flag`, data),

  // ── Regulations ─────────────────────────────────────────────────────────
  getRegulations: () =>
    apiClient.get('/admin/regulations'),

  addRegulation: (data: {
    'article number': string;
    content: string;
    type: string;
    faculty_id?: number;
  }) => apiClient.post('/admin/regulations', data),

  deleteRegulation: (id: number) =>
    apiClient.delete(`/admin/regulations/${id}`),

  // ── Priority Rules ───────────────────────────────────────────────────────
  getPriorityRules: () =>
    apiClient.get('/admin/priority-rules'),

  savePriorityRule: (data: {
    'priority level': number;
    description: string;
    examples: string[];
  }) => apiClient.post('/admin/priority-rules', data),

  // ── Audit Logs ───────────────────────────────────────────────────────────
  getAuditLogs: (filters?: {
    user_id?: number;
    entity_type?: string;
    from?: string;   // ISO date string
    to?: string;     // ISO date string
  }) => apiClient.get('/admin/audit-logs', { params: filters }),
};

// ── Auth ──────────────────────────────────────────────────────────────────
export const authApi = {
  login: (data: { email: string; password: string }) =>
    apiClient.post('/auth/login', data),

  registerAdmin: (data: {
    full_name: string;
    email: string;
    password: string;
    university_name: string;
    faculty_name: string;
    email_domain: string;
    supporting_document: string;
  }) => apiClient.post('/auth/admin/register', data),

  forgotPassword: (data: { email: string }) =>
    apiClient.post('/auth/forgot-password', data),

  resetPassword: (data: { token: string; password: string }) =>
    apiClient.post('/auth/reset-password', data),
   changePassword: (data: {
    current_password: string;
    new_password: string;
  }) =>
    apiClient.patch('/auth/change-password', data),
};

// ── Super Admin ───────────────────────────────────────────────────────────
export const superAdminApi = {
  // Registration Requests
  getAllRequests: () =>
    apiClient.get('/superadmin/requests'),

  getPendingRequests: () =>
    apiClient.get('/superadmin/requests/pending'),

  getRequest: (requestId: number) =>
    apiClient.get(`/superadmin/requests/${requestId}`),

  approveRequest: (requestId: number) =>
    apiClient.patch(`/superadmin/requests/${requestId}/approve`),

  rejectRequest: (requestId: number, data: { rejection_reason: string }) =>
    apiClient.patch(`/superadmin/requests/${requestId}/reject`, data),

  // Admin Management
  getAllAdmins: () =>
    apiClient.get('/superadmin/admins'),

  deleteAdmin: (adminId: number) =>
    apiClient.delete(`/superadmin/admins/${adminId}`),
};


