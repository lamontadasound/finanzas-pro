import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  isAuthenticated: boolean;
  login: (email: string, password: string) => boolean;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      login: (email, password) => {
        const ok =
          email === import.meta.env.VITE_ADMIN_EMAIL &&
          password === import.meta.env.VITE_ADMIN_PASSWORD;
        if (ok) set({ isAuthenticated: true });
        return ok;
      },
      logout: () => set({ isAuthenticated: false }),
    }),
    { name: 'finanzas-auth' }
  )
);
