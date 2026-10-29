// ── Guards de ruta — Fase F ───────────────────────────────────────────────
// Única fuente de verdad en el frontend para "¿puede este usuario ver esta
// pantalla?" — Sidebar, Dock, rutas y Dashboard consultan siempre los
// mismos helpers de `useAuthStore` (permisoLinea/permisoModulo), nunca una
// condición propia. Esto es defensa en profundidad: la protección REAL
// vive en las políticas RLS (preparadas, no ejecutadas — ver
// supabase/migrations/…fase_f_permisos_rls.sql) — sin RLS, un usuario con
// las herramientas de red podría seguir consultando Supabase directamente
// con la anon key. Este guard evita fugas de UI (menú, rutas, Dashboard,
// parpadeo de datos), no sustituye a RLS.
import {useLocation} from 'react-router-dom';
import {sectionForPath,sectionAllowed} from '../../config/serviceSections';
import type { ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import type { LineaId } from '../../config/businessLines';
import type { ModuloId } from '../../types';

// Pantalla limpia de acceso denegado — nunca revela importes, clientes ni
// ningún dato financiero, tal como exige la auditoría.
export const AccessDenied = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
    <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
      <ShieldAlert size={24} className="text-red-500" />
    </div>
    <p className="text-gray-900 font-semibold text-base">No tienes permiso para acceder</p>
    <p className="text-gray-400 text-sm max-w-xs">
      Esta sección no está disponible para tu usuario. Si crees que es un error, contacta con un administrador.
    </p>
  </div>
);

// Pantalla neutra mientras se confirman los permisos — NUNCA se renderizan
// los `children` (ni sus datos) antes de que esto se resuelva.
const CheckingAccess = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="w-6 h-6 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

/** Bloquea TODO hasta que Supabase Auth resuelva si hay sesión —
 *  evita el instante en que `user` es `null` por no haber cargado aún. */
export const RequireHydrated = ({ children }: { children: ReactNode }) => {
  const ready = useAuthStore((s) => s.status === 'ready');
  if (!ready) return <CheckingAccess />;
  return <>{children}</>;
};

interface RequireLineaProps {
  linea: LineaId;
  /** Nivel de acceso exigido para entrar a la ruta — por defecto solo "ver". */
  accion?: 'ver' | 'crear' | 'editar' | 'eliminar';
  children: ReactNode;
}

export const RequireLinea = ({ linea, accion = 'ver', children }: RequireLineaProps) => {
  const {pathname}=useLocation();
  const ready = useAuthStore((s) => s.status === 'ready');
  const permiso = useAuthStore((s) => s.permisoLinea(linea));
  if (!ready) return <CheckingAccess />;
  const permitido = accion === 'ver' ? permiso.ver : accion === 'crear' ? permiso.crear : accion === 'editar' ? permiso.editar : permiso.eliminar;
  if (!permitido || !sectionAllowed(permiso,sectionForPath(pathname))) return <AccessDenied />;
  return <>{children}</>;
};

interface RequireModuloProps {
  modulo: ModuloId;
  accion?: 'ver' | 'crear' | 'editar' | 'eliminar';
  children: ReactNode;
}

export const RequireModulo = ({ modulo, accion = 'ver', children }: RequireModuloProps) => {
  const ready = useAuthStore((s) => s.status === 'ready');
  const permiso = useAuthStore((s) => s.permisoModulo(modulo));
  if (!ready) return <CheckingAccess />;
  const permitido = accion === 'ver' ? permiso.ver : accion === 'crear' ? permiso.crear : accion === 'editar' ? permiso.editar : permiso.eliminar;
  if (!permitido) return <AccessDenied />;
  return <>{children}</>;
};

/** Solo administradores — usado en Administración. */
export const RequireAdminStrict = ({ children }: { children: ReactNode }) => {
  const ready = useAuthStore((s) => s.status === 'ready');
  const isAdmin = useAuthStore((s) => s.isAdmin());
  if (!ready) return <CheckingAccess />;
  if (!isAdmin) return <AccessDenied />;
  return <>{children}</>;
};
