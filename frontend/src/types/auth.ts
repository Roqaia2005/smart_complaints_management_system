import type { WorkflowRole } from "./workflow";

export interface User {
  id: string;
  email: string;
  name: string;
  role: WorkflowRole;
  universityId?: string;
  avatar?: string;
  department?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}
