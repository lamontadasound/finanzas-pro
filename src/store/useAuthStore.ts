import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserRol, Permisos, AreaKey, ALL_PERMS } from '../types';
import { supabase } from '../lib/supabase';

// Contraseña SHA-256 usando Web Crypto API (nativa en navegadores modernos)
export async function hashPassword(password: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Admin hardcoded — funciona aunque no haya Supabase configurado
const ADMIN_EMAIL    = 'juliacenteno10@gmail.com';
const ADMIN_PASSWORD = '1234';
const ADMIN_PERMS: Permisos = {
  montada:     { ver: true, crear: true, editar: true, eliminar: true },
  dj:          { ver: true, crear: true, editar: true, eliminar: true },
  inversiones: { ver: true, crear: true, editar: true, eliminar: true },
  facturas:    { ver: true, crear: true, editar: true, eliminar: true },
  informes:    { ver: true, crear: true, editar: true, eliminar: true },
  pagos:       { ver: true, crear: true, editar: true, eliminar: true },
};

export interface CurrentUser {
  id: string;
  email: string;
  nombre: string;
  rol: UserRol;
  permisos: Permisos;
}

interface AuthState {
  isAuthenticated: boolean;
  user: CurrentUser | null;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  // Helpers de permiso
  isAdmin: () => boolean;
  canView:   (area: AreaKey) => boolean;
  canCreate: (area: AreaKey) => boolean;
  canEdit:   (area: AreaKey) => boolean;
  canDelete: (area: AreaKey) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,

      login: async (email, password) => {
        const em = email.trim().toLowerCase();
        const pw = password.trim();

        // 1. Comprobar admin hardcoded primero (siempre funciona)
        if (em === ADMIN_EMAIL.toLowerCase() && pw === ADMIN_PASSWORD) {
          set({
            isAuthenticated: true,
            user: {
              id: 'admin',
              email: ADMIN_EMAIL,
              nombre: 'Administrador',
              rol: 'admin',
              permisos: ADMIN_PERMS,
            },
          });
          return { ok: true };
        }

        // 2. Buscar en tabla usuarios de Supabase
        try {
          const { data, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('email', em)
            .eq('activo', true)
            .single();

          if (error || !data) {
            return { ok: false, error: 'Email o contraseña incorrectos.' };
          }

          const hash = await hashPassword(pw);
          if (hash !== data.password_hash) {
            return { ok: false, error: 'Email o contraseña incorrectos.' };
          }

          set({
            isAuthenticated: true,
            user: {
              id: data.id,
              email: data.email,
              nombre: data.nombre,
              rol: data.rol as UserRol,
              permisos: data.permisos as Permisos,
            },
          });
          return { ok: true };
        } catch {
          return { ok: false, error: 'No se pudo conectar con el servidor. Verifica las credenciales de Supabase.' };
        }
      },

      logout: () => set({ isAuthenticated: false, user: null }),

      isAdmin: () => get().user?.rol === 'admin',

      canView:   (area) => {
        const u = get().user;
        if (!u) return false;
        if (u.rol === 'admin') return true;
        return u.permisos?.[area]?.ver ?? false;
      },
      canCreate: (area) => {
        const u = get().user;
        if (!u) return false;
        if (u.rol === 'admin') return true;
        return u.permisos?.[area]?.crear ?? false;
      },
      canEdit: (area) => {
        const u = get().user;
        if (!u) return false;
        if (u.rol === 'admin') return true;
        return u.permisos?.[area]?.editar ?? false;
      },
      canDelete: (area) => {
        const u = get().user;
        if (!u) return false;
        if (u.rol === 'admin') return true;
        return u.permisos?.[area]?.eliminar ?? false;
      },
    }),
    { name: 'finanzas-auth' }
  )
);
