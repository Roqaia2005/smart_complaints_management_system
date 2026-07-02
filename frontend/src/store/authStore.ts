import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthState } from '../types/auth';
import { authApi } from '@/api/services';

interface TokenClaims {
  id: number;
  role: string;
  faculty_id?: number;
  iat: number;
  exp: number;
}

// Lightweight base64url JWT payload decode — avoids pulling in a jwt-decode
// dependency just for this. Never throws: auth flows shouldn't crash on a
// missing/malformed token, they should just treat the claim as absent.
function decodeJwtPayload<T = TokenClaims>(token: string | null): T | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

interface AuthStore extends AuthState {
  isLoading: boolean;
  error: string | null;
  // Derived from the JWT payload (backend puts faculty_id in the token
  // claims, not on the `user` object returned by /login). null for
  // non-student roles or if the token has no faculty_id claim.
  facultyId: number | null;
  setAuth: (user: User, token: string) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      facultyId: null,

      setAuth: (user, token) =>
        set({
          user,
          token,
          isAuthenticated: true,
          error: null,
          facultyId: decodeJwtPayload(token)?.faculty_id ?? null,
        }),

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const res = await authApi.login({ email, password });
          const { token, user } = res.data;
          // Persist the token so backendApi interceptor picks it up automatically
          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            facultyId: decodeJwtPayload(token)?.faculty_id ?? null,
          });
        } catch (err: any) {
          const message =
            err?.response?.data?.message ||
            err?.response?.data?.error ||
            'Invalid email or password.';
          set({ isLoading: false, error: message });
          throw err; // let the page handle it too if needed
        }
      },

      logout: () =>
        set({ user: null, token: null, isAuthenticated: false, error: null, facultyId: null }),

      updateUser: (userData) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage-v2',
      // Only persist user + token — derived state (including facultyId) is
      // recomputed on rehydrate rather than duplicated in storage.
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.facultyId = decodeJwtPayload(state.token)?.faculty_id ?? null;
        }
      },
    }
  )
);