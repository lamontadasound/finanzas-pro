import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const ADMIN_EMAIL    = 'juliacenteno10@gmail.com';
const ADMIN_PASSWORD = '1234';

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
          email.trim() === ADMIN_EMAIL &&
          password.trim() === ADMIN_PASSWORD;
        if (ok) set({ isAuthenticated: true });
        return ok;
      },
      logout: () => set({ isAuthenticated: false }),
    }),
    { name: 'finanzas-auth' }
  )
);
