import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthState } from '../types/auth';

interface AuthStore extends AuthState {
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: {
        id: 'dev-mock-1',
        name: 'Demo User',
        email: 'demo@uniresolve.app',
        role: 'student'
      },
      token: 'dev-mock-token',
      isAuthenticated: true,
      setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
      updateUser: (userData) => set((state) => ({
        user: state.user ? { ...state.user, ...userData } : null
      })),
    }),
    {
      name: 'auth-storage-v2',
    }
  )
);
