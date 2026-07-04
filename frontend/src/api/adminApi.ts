// =========================================================================
// adminApi.ts
// Shared, typed API layer for every /admin/* page.
// All admin pages (Users, Import, Regulations, Priority Rules, Audit Logs,
// Insights) import from this single file, so there is exactly one place
// that knows about endpoint shapes and backend quirks.
//
// Backend reference: admin_controller.js + admin_service.js
// Base path assumed: /api/admin  -> adjust ADMIN_BASE below if your
// admin_routes.js mounts it somewhere else.
// =========================================================================

import axios from "axios";

const API_ROOT = (import.meta as any).env.VITE_API_URL|| "/api";
const ADMIN_BASE = `${API_ROOT}/admin`;

// The category-description suggester runs on a separate Python (FastAPI)
// service, not the Node admin backend — adjust this to wherever that's
// actually deployed.
const PYTHON_SERVICE_URL = (import.meta as any).env.VITE_PYTHON_SERVICE_URL || "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: API_ROOT,
  headers: { "Content-Type": "application/json" },
});

// Attach auth token automatically if you store one in localStorage.
apiClient.interceptors.request.use((config) => {
  const persisted = localStorage.getItem("auth-storage-v2"); // <-- your actual key
  if (persisted) {
    const { state } = JSON.parse(persisted);

    if (state.token) {
      config.headers.Authorization = `Bearer ${state.token}`;
    }
  }

  return config;
});

// Normalizes axios errors into a single readable message, matching the
// `{ success: false, error: "..." }` shape every controller returns.
export function getApiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error || err.message || fallback;
  }
  return fallback;
}

// =========================================================================
// Shared types
// =========================================================================

export type UserRole = "student" | "officer" | "manager";

export interface AdminUser {
  id: number;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  is_also_manager?: boolean | null;
  manager_title?: string | null;
  officer_title?: string | null;
}

export interface CategoryOfficerRef {
  id: number;
  full_name: string;
  email: string;
}

export interface AdminCategory {
  id: number;
  name: string;
  description?: string | null;
  sla_hours?: number | null;
  faculty_id: number;
  is_active: boolean;
  officers?: CategoryOfficerRef[];
}

// Payload for POST /admin/users — fields used depend on `role`.
export interface CreateUserPayload {
  role: UserRole;
  full_name: string;
  email: string;
  password: string;
  // student
  student_number?: string;
  department?: string;
  academic_year?: number;
  // officer
  category_ids?: number[];
  officer_title?: string;
  is_also_manager?: boolean;
  manager_title?: string;
  // manager
  // (manager_title shared with officer's "also manager" field above)
}

// Payload for PATCH /admin/users/:id — service does a raw User.update(data),
// so only send columns that actually exist on the User model.
export interface UpdateUserPayload {
  full_name?: string;
  email?: string;
  is_active?: boolean;
  officer_title?: string | null;
  manager_title?: string | null;
  is_also_manager?: boolean;
}

export interface ImportPreviewRowError {
  row: number;
  data: Record<string, string>;
  errors: string[];
}

export interface ImportPreviewResult {
  import_id: string;
  preview: {
    total_records: number;
    valid_records: number;
    invalid_records: number;
    errors: ImportPreviewRowError[];
  };
}

export interface ConfirmImportResult {
  success: boolean;
  imported_count: number;
}

export interface Regulation {
  id: number;
  article_number: string;
  content: string;
  type: string;
  faculty_id: number;
}

export interface PriorityRule {
  id: number;
  priority_level: number;
  description: string;
  examples: string[];
  category_id: number;
  updatedAt?: string;
}

export interface AuditLogEntry {
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: number;
  created_at: string;
}

export interface AuditLogFilters {
  user_id?: number | string;
  entity_type?: string;
  from?: string; // ISO date
  to?: string; // ISO date
}

// =========================================================================
// Categories
// (kept here too since Users + Insights pages both need the category list)
// =========================================================================

export async function getCategories(): Promise<AdminCategory[]> {
  const res = await apiClient.get<{ categories: AdminCategory[] }>(`${ADMIN_BASE}/categories`);
  return res.data.categories;
}

export async function addCategory(payload: {
  name: string;
  description?: string;
  sla_hours?: number;
  faculty_id?: number;
  keywords?: string; // comma-separated, backend splits it
  officer_ids?: number[];
}): Promise<{ success: boolean; category_id: number }> {
  const res = await apiClient.post(`${ADMIN_BASE}/categories`, payload);
  return res.data;
}

// POST {PYTHON_SERVICE_URL}/api/admin/categories/suggest-description
// Called while an admin is creating a category — returns a bilingual
// description + keyword suggestions the admin can accept or edit.
export interface CategoryDescriptionSuggestion {
  description_en: string;
  description_ar: string;
  keywords_en: string[];
  keywords_ar: string[];
  combined_description: string;
  combined_keywords: string;
}

export interface SuggestCategoryDescriptionResult {
  success: boolean;
  suggestion?: CategoryDescriptionSuggestion;
  error?: string;
}

export async function suggestCategoryDescription(
  name: string,
  existing_description?: string
): Promise<SuggestCategoryDescriptionResult> {
  const res = await axios.post<SuggestCategoryDescriptionResult>(
    `${PYTHON_SERVICE_URL}/api/admin/categories/suggest-description`,
    { name, existing_description }
  );
  return res.data;
}

export async function updateCategory(
  id: number,
  payload: Partial<{ name: string; description: string; sla_hours: number; is_active: boolean }>
): Promise<{ success: boolean }> {
  const res = await apiClient.patch(`${ADMIN_BASE}/categories/${id}`, payload);
  return res.data;
}

export async function deleteCategory(id: number): Promise<{ success: boolean }> {
  const res = await apiClient.delete(`${ADMIN_BASE}/categories/${id}`);
  return res.data;
}

// =========================================================================
// Users
// =========================================================================

export async function getUsers(): Promise<AdminUser[]> {
  const res = await apiClient.get<{ users: AdminUser[] }>(`${ADMIN_BASE}/users`);
  return res.data.users;
}

export async function createUser(
  payload: CreateUserPayload
): Promise<{ success: boolean; role: UserRole; data: unknown }> {
  const res = await apiClient.post(`${ADMIN_BASE}/users/create`, payload);
  return res.data;
}

export async function updateUser(id: number, payload: UpdateUserPayload): Promise<{ success: boolean }> {
  const res = await apiClient.patch(`${ADMIN_BASE}/users/${id}`, payload);
  return res.data;
}

export async function deleteUser(id: number): Promise<{ success: boolean }> {
  const res = await apiClient.delete(`${ADMIN_BASE}/users/${id}`);
  return res.data;
}

// PATCH /admin/officers/:id/manager-flag
export async function setOfficerManagerFlag(
  officerId: number,
  is_also_manager: boolean,
  manager_title?: string | null
): Promise<{ success: boolean; officer: AdminUser }> {
  const res = await apiClient.patch(`${ADMIN_BASE}/officers/${officerId}/manager-flag`, {
    is_also_manager,
    manager_title,
  });
  return res.data;
}

// =========================================================================
// CSV bulk import (preview -> confirm, two-step flow)
// =========================================================================

export async function importUsersPreview(file: File, targetRole: UserRole): Promise<ImportPreviewResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("targetRole", targetRole);

  const res = await apiClient.post<ImportPreviewResult>(`${ADMIN_BASE}/users/import-preview`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function confirmImportUsers(importId: string): Promise<ConfirmImportResult> {
  const res = await apiClient.post<ConfirmImportResult>(`${ADMIN_BASE}/users/import-confirm`, {
    import_id: importId,
  });
  return res.data;
}

// =========================================================================
// Regulations
// =========================================================================

export async function getRegulations(): Promise<Regulation[]> {
  const res = await apiClient.get<{ regulations: Regulation[] }>(`${ADMIN_BASE}/regulations`);
  console.log(res)
  return res.data.regulations;
}

// NOTE: backend reads `data["article number"]` (literal space in the key) —
// see admin_service.js createNewRegulation. We mirror that exact contract
// here so the page code can just use normal camelCase/snake_case fields.
export async function addRegulation(payload: {
  article_number: string;
  content: string;
  type: string;
  faculty_id?: number;
}): Promise<{ success: boolean }> {
  const res = await apiClient.post(`${ADMIN_BASE}/regulations`, {
    "article number": payload.article_number,
    content: payload.content,
    type: payload.type,
    faculty_id: payload.faculty_id,
  });
  return res.data;
}

export async function deleteRegulation(id: number): Promise<{ success: boolean }> {
  const res = await apiClient.delete(`${ADMIN_BASE}/regulations/${id}`);
  return res.data;
}

// =========================================================================
// Priority rules
// =========================================================================

export async function getPriorityRules(): Promise<PriorityRule[]> {
  const res = await apiClient.get<{ rules: PriorityRule[] }>(`${ADMIN_BASE}/priority-rules`);
  return res.data.rules;
}

// NOTE: backend reads `data["priority level"]` (literal space) — see
// admin_service.js upsertPriorityRule. It upserts by priority_level, so
// this same call handles both create and edit.
export async function savePriorityRule(payload: {
  priority_level: number;
  description: string;
  examples: string[];
  category_id: number;
}): Promise<{ success: boolean }> {
  const res = await apiClient.post(`${ADMIN_BASE}/priority-rules`, {
    "priority level": payload.priority_level,
    description: payload.description,
    examples: payload.examples,
    category_id: payload.category_id,
  });
  return res.data;
}

// =========================================================================
// Audit logs
// =========================================================================

export async function getAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogEntry[]> {
  const res = await apiClient.get<{ logs: AuditLogEntry[] }>(`${ADMIN_BASE}/audit-logs`, {
    params: filters,
  });
  return res.data.logs;
}

// =========================================================================
// Regulations Upload (PDF)
// =========================================================================

export async function uploadRegulationPdf(file: File): Promise<{ success: boolean; parsed_chunks_count?: number }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await apiClient.post(`${ADMIN_BASE}/regulations/upload-pdf`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

// =========================================================================
// Offensive Messages
// =========================================================================

export interface OffensiveMessage {
  id: number;
  user_id: number;
  user_name: string;
  email: string;
  session_id: number;
  message: string;
  offense_count: number;
  createdAt: string;
}

export async function getOffensiveMessages(): Promise<OffensiveMessage[]> {
  const res = await apiClient.get<{ messages: OffensiveMessage[] }>(`${ADMIN_BASE}/offensive-messages`);
  return res.data.messages;
}

// =========================================================================
// Uncategorized Complaints
// =========================================================================

export interface UncategorizedComplaint {
  id: number;
  problem: string;
  ai_summary: string;
  priority: number;
  status: string;
  createdAt: string;
  student_name: string;
  student_email: string;
  // Added by the backend's joined query — may be null if the student
  // record has no department/year set, or if the join didn't resolve.
  student_department?: string | null;
  student_year?: number | null;
}

// Backend now wraps the array with { success, count, complaints }.
export async function getUncategorizedComplaints(): Promise<UncategorizedComplaint[]> {
  const res = await apiClient.get<{ success: boolean; count: number; complaints: UncategorizedComplaint[] }>(
    `${ADMIN_BASE}/uncategorized-complaints`
  );
  return res.data.complaints;
}

export async function reassignComplaint(id: number, category_id: number): Promise<{ success: boolean; new_category_name: string }> {
  const res = await apiClient.patch(`${ADMIN_BASE}/complaints/${id}/reassign`, { category_id });
  return res.data;
}

// Payload for POST /admin/complaints/:id/create-category — creates a brand
// new category (in the admin's faculty) and immediately reassigns the
// given complaint to it. `keywords` is a comma-separated string, same
// convention as addCategory above.
export interface CreateCategoryAndReassignPayload {
  name: string;
  description?: string;
  sla_hours?: number;
  keywords?: string;
}

export interface CreateCategoryAndReassignResult {
  success: boolean;
  new_category_id: number;
  new_category_name: string;
}

export async function createCategoryAndReassign(
  complaintId: number,
  payload: CreateCategoryAndReassignPayload
): Promise<CreateCategoryAndReassignResult> {
  const res = await apiClient.post(`${ADMIN_BASE}/complaints/${complaintId}/create-category`, payload);
  return res.data;
}