import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthState } from '../types/auth';
import { authApi } from '@/api/services';

interface AuthStore extends AuthState {
  isLoading: boolean;
  error: string | null;
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

      setAuth: (user, token) => set({ user, token, isAuthenticated: true, error: null }),

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const res = await authApi.login({ email, password });
          const { token, user } = res.data;
          // Persist the token so backendApi interceptor picks it up automatically
          set({ user, token, isAuthenticated: true, isLoading: false, error: null });
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
        set({ user: null, token: null, isAuthenticated: false, error: null }),

      updateUser: (userData) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage-v2',
      // Only persist user + token — derived state is recomputed on rehydrate
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);