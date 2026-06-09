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
        // Leer variables y limpiar espacios en ambos lados
        const envEmail    = (import.meta.env.VITE_ADMIN_EMAIL    ?? '').trim();
        const envPassword = (import.meta.env.VITE_ADMIN_PASSWORD ?? '').trim();
        const inputEmail    = email.trim();
        const inputPassword = password.trim();

        // Log de diagnóstico (sin mostrar contraseña completa)
        if (!envEmail || !envPassword) {
          console.error(
            '[Auth] Variables de entorno no configuradas. ' +
            'Añade VITE_ADMIN_EMAIL y VITE_ADMIN_PASSWORD en Vercel → Settings → Environment Variables y haz Redeploy.'
          );
          return false;
        }
        console.info(
          `[Auth] Verificando login — email env: "${envEmail}" | password env configurada: ${envPassword.length > 0 ? 'sí (' + envPassword.length + ' caracteres)' : 'NO'}`
        );

        const ok = inputEmail === envEmail && inputPassword === envPassword;
        if (ok) set({ isAuthenticated: true });
        return ok;
      },

      logout: () => set({ isAuthenticated: false }),
    }),
    { name: 'finanzas-auth' }
  )
);
