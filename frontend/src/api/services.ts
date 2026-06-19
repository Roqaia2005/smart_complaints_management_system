import backendApi from './backendApi';

// ── Auth ──────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    backendApi.post('/auth/login', { email, password }),
  register: (student_number: string, password: string) =>
    backendApi.post('/auth/register', { student_number, password }),
  checkStudent: (student_number: string) =>
    backendApi.post('/auth/check-student', { student_number }),
  sendOtp: (student_number: string) =>
    backendApi.post('/auth/send-otp', { student_number }),
  verifyOtp: (student_number: string, otp_code: string) =>
    backendApi.post('/auth/verify-otp', { student_number, otp_code }),
};

// ── Student / Complaints ──────────────────────────────────────────────────
export const studentApi = {
  submitComplaint: (data: {
    user_id: number;
    category_id: number;
    problem: string;
    location?: string;
  }) => backendApi.post('/complaints', data),

  getMyComplaints: (student_id: number) =>
    backendApi.get(`/complaints/student/${student_id}`),

  getComplaintDetails: (id: number | string) =>
    backendApi.get(`/complaints/${id}`),

  submitAppeal: (id: number | string, reason: string, user_id: number) =>
    backendApi.post(`/complaints/${id}/appeal`, { reason, user_id }),
};

// ── Officer ───────────────────────────────────────────────────────────────
export const officerApi = {
  getComplaints: (category_id: number) =>
    backendApi.get('/officer/complaints', { params: { category_id } }),

  getComplaintDetails: (id: number | string) =>
    backendApi.get(`/officer/complaints/${id}`),

  updateComplaintStatus: (id: number | string, status: string, resolution_text?: string) =>
    backendApi.patch(`/officer/complaints/${id}/status`, { status, resolution_text }),

  getAppeals: (category_id: number) =>
    backendApi.get('/officer/appeals', { params: { category_id } }),

  markAppealReviewed: (id: number | string) =>
    backendApi.patch(`/officer/appeals/${id}/review`, {}),
};

// ── Manager ───────────────────────────────────────────────────────────────
export const managerApi = {
  getOverview: (from?: string) =>
    backendApi.get('/manager/overview', { params: from ? { from } : {} }),

  getDepartmentPerformance: () =>
    backendApi.get('/manager/department-performance'),

  getHeatmap: (dimension: 'category' | 'location' | 'time' | 'department') =>
    backendApi.get('/manager/heatmap', { params: { dimension } }),

  getReports: (filters?: { from?: string; to?: string; category_id?: number; status?: string }) =>
    backendApi.get('/manager/reports', { params: filters }),

  getTopIssues: (category_id: number) =>
    backendApi.get(`/manager/top-issues/${category_id}`),
};

// ── Admin ─────────────────────────────────────────────────────────────────
export const adminApi = {
  // Categories
  getCategories: () => backendApi.get('/admin/categories'),
  addCategory: (data: { name: string; description?: string; sla_hours?: number; keywords?: string; responsible_id?: number }) =>
    backendApi.post('/admin/categories', data),
  updateCategory: (id: number, data: Partial<{ name: string; description: string; sla_hours: number; is_active: boolean }>) =>
    backendApi.patch(`/admin/categories/${id}`, data),
  deleteCategory: (id: number) => backendApi.delete(`/admin/categories/${id}`),

  // Users
  getUsers: () => backendApi.get('/admin/users'),
  addUser: (data: { full_name: string; email: string; password: string; role: string }) =>
    backendApi.post('/admin/users', data),
  updateUser: (id: number, data: Partial<{ full_name: string; email: string; role: string; is_active: boolean }>) =>
    backendApi.patch(`/admin/users/${id}`, data),
  deleteUser: (id: number) => backendApi.delete(`/admin/users/${id}`),

  // Regulations
  getRegulations: () => backendApi.get('/admin/regulations'),
  addRegulation: (data: { 'article number': string; content: string; type: string; faculty_id?: number }) =>
    backendApi.post('/admin/regulations', data),
  deleteRegulation: (id: number) => backendApi.delete(`/admin/regulations/${id}`),

  // Priority Rules
  getPriorityRules: () => backendApi.get('/admin/priority-rules'),
  savePriorityRule: (data: { 'priority level': number; description: string; examples: string[] }) =>
    backendApi.post('/admin/priority-rules', data),

  // Audit Logs
  getAuditLogs: (filters?: { user_id?: number; entity_type?: string; from?: string; to?: string }) =>
    backendApi.get('/admin/audit-logs', { params: filters }),
};
