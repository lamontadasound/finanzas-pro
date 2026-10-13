import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { PermisosLineas, PermisosModulos, ModuloId, PermisoCRUD, UserRol, PermisosFacturacion } from '../types';
import { NO_PERM_CRUD, ALL_PERM_CRUD, NO_PERMS_FACTURACION } from '../types';
import type { LineaId } from '../config/businessLines';
import { LINEA_IDS } from '../config/businessLines';
import { supabase } from '../lib/supabase';

// ============================================================================
// Fase G — Supabase Auth como única fuente de verdad de la sesión.
//
// Sustituye por completo el sistema anterior (Fase A-F): login contra la
// tabla pública `usuarios`, SHA-256 en el frontend, admin hardcodeado con
// PIN "1234" embebido en el bundle. El frontend YA NO descarga, compara ni
// conoce ninguna contraseña o hash — `supabase.auth.signInWithPassword`
// delega toda la verificación de credenciales al servidor de Supabase.
//
// No se usa `zustand/persist` para la sesión: Supabase Auth ya persiste su
// propia sesión (localStorage bajo su propia clave, gestionada por su SDK,
// con refresco de token automático) — duplicarlo en zustand/persist fue
// precisamente la causa del bug de TDZ/hidratación de la Fase F. Zustand
// aquí solo mantiene un ESPEJO en memoria, reconstruido siempre a partir de
// `supabase.auth.getSession()` + `onAuthStateChange`, nunca al revés.
//
// IMPORTANTE — estado de esta fase: las tablas `profiles`,
// `user_line_permissions` y `user_module_permissions` (Fase F) todavía NO
// existen en producción (migración preparada, no ejecutada). Hasta que se
// ejecute, `cargarPerfil()` fallará su consulta — se trata como "sin
// perfil" (deny-by-default), nunca como acceso concedido. El código de
// abajo es la arquitectura DEFINITIVA, lista para funcionar en cuanto la
// migración se apruebe y ejecute.
// ============================================================================

const EMPTY_LINEAS: LineaId[] = [];
const ALL_LINEAS_STABLE: LineaId[] = [...LINEA_IDS];
const ADMIN_PERM_CRUD: PermisoCRUD = { ...ALL_PERM_CRUD };

// Caché de referencia estable por objeto `profile` — imprescindible: estos
// métodos se usan como `useAuthStore((s) => s.lineasVisibles())` en muchos
// componentes, y devolver un array/objeto NUEVO en cada llamada rompería la
// comparación por referencia de zustand (bucle infinito de renders — bug
// real ya encontrado y corregido en la Fase F).
const lineasVisiblesCache = new WeakMap<object, LineaId[]>();
const permisoLineaCache = new WeakMap<object, Map<LineaId, PermisoCRUD>>();
const permisoModuloCache = new WeakMap<object, Map<ModuloId, PermisoCRUD>>();

export interface Profile {
  id: string; // = auth.users.id (UUID) — nunca un id inventado por el cliente
  email: string;
  nombre: string;
  rol: UserRol;
  activo: boolean;
  permisosLineas: PermisosLineas;
  permisosModulos: PermisosModulos;
  /** Fase H — permisos finos de facturación (emitir/rectificar/gestionar numeración), independientes del CRUD genérico de `contabilidad`. */
  permisosFacturacion: PermisosFacturacion;
  ultimoAcceso?: string;
}

/** @deprecated Alias de compatibilidad — usar {@link Profile}. Varias
 *  pantallas ya importan `CurrentUser`; se mantiene el nombre para no forzar
 *  un cambio de import masivo en esta misma fase, apunta al mismo tipo. */
export type CurrentUser = Profile;

type AuthStatus = 'loading' | 'ready';

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  profile: Profile | null;
  /** @deprecated alias de `profile`, mismas garantías — mantenido porque
   *  gran parte de la app ya usa `useAuthStore((s) => s.user)`. */
  user: Profile | null;
  isAuthenticated: boolean;

  /** Arranca la sesión: getSession() + suscripción a onAuthStateChange.
   *  Debe llamarse UNA vez, al montar la app (ver `AuthGate` en App.tsx). */
  init: () => () => void; // devuelve la función de desuscripción

  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; error?: string }>;

  isAdmin: () => boolean;

  permisoLinea: (linea: LineaId) => PermisoCRUD;
  canViewLinea:   (linea: LineaId) => boolean;
  canCreateLinea: (linea: LineaId) => boolean;
  canEditLinea:   (linea: LineaId) => boolean;
  canDeleteLinea: (linea: LineaId) => boolean;
  lineasVisibles: () => LineaId[];

  permisoModulo: (modulo: ModuloId) => PermisoCRUD;
  canViewModulo:   (modulo: ModuloId) => boolean;
  canCreateModulo: (modulo: ModuloId) => boolean;
  canEditModulo:   (modulo: ModuloId) => boolean;
  canDeleteModulo: (modulo: ModuloId) => boolean;

  // ── Permisos finos de facturación (Fase H) — independientes del CRUD
  // genérico de `contabilidad`: alguien puede tener permiso para VER
  // facturas (módulo contabilidad) sin poder EMITIRlas, RECTIFICARlas ni
  // GESTIONAR LA NUMERACIÓN. Admin siempre true — ver `isAdmin()`.
  canEmitirFacturas: () => boolean;
  canRectificarFacturas: () => boolean;
  canGestionarNumeracion: () => boolean;
}

// ── Carga de perfil + permisos — única consulta que decide el acceso ───────
// Lee `profiles` (rol/activo) y `user_line_permissions`/`user_module_permissions`
// (Fase F). Cualquier fallo (tabla inexistente todavía, red, RLS que
// deniega) se trata como "sin perfil" — NUNCA como admin ni como acceso
// concedido por defecto.
async function cargarPerfil(userId: string, email: string): Promise<Profile | null> {
  try {
    const { data: perfilRow, error: perfilErr } = await supabase
      .from('profiles')
      .select('id, email, nombre, rol, activo')
      .eq('id', userId)
      .single();
    if (perfilErr || !perfilRow) return null;
    if (!perfilRow.activo) return null; // usuario desactivado — 0 acceso, aunque exista la fila

    const [{ data: lineaRows }, { data: moduloRows }, { data: facturacionRow }] = await Promise.all([
      supabase.from('user_line_permissions').select('linea_negocio, can_view, can_create, can_edit, can_delete').eq('user_id', userId),
      supabase.from('user_module_permissions').select('modulo, can_view, can_create, can_edit, can_delete').eq('user_id', userId),
      // Tabla nueva (Fase H) — si no existe todavía (migración no ejecutada),
      // el catch de más abajo la trata como "sin permisos de facturación",
      // nunca como acceso concedido por defecto.
      supabase.from('user_facturacion_permissions').select('puede_emitir, puede_rectificar, puede_gestionar_numeracion').eq('user_id', userId).maybeSingle(),
    ]);

    const permisosLineas: PermisosLineas = {};
    for (const r of lineaRows ?? []) {
      permisosLineas[r.linea_negocio] = { ver: r.can_view, crear: r.can_create, editar: r.can_edit, eliminar: r.can_delete };
    }
    const permisosModulos = {} as PermisosModulos;
    for (const r of moduloRows ?? []) {
      (permisosModulos as Record<string, PermisoCRUD>)[r.modulo] = { ver: r.can_view, crear: r.can_create, editar: r.can_edit, eliminar: r.can_delete };
    }
    const permisosFacturacion: PermisosFacturacion = facturacionRow
      ? { emitir: facturacionRow.puede_emitir, rectificar: facturacionRow.puede_rectificar, gestionarNumeracion: facturacionRow.puede_gestionar_numeracion }
      : NO_PERMS_FACTURACION;

    return {
      id: perfilRow.id,
      email: perfilRow.email ?? email,
      nombre: perfilRow.nombre ?? email,
      rol: perfilRow.rol as UserRol,
      activo: perfilRow.activo,
      permisosLineas,
      permisosModulos,
      permisosFacturacion,
    };
  } catch (err) {
    console.error('[useAuthStore] No se pudo cargar el perfil/permisos:', err instanceof Error ? err.message : err);
    return null;
  }
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  status: 'loading',
  session: null,
  profile: null,
  user: null,
  isAuthenticated: false,

  init: () => {
    let cancelled=false;
    let generation=0;
    const prepare=(session:Session|null)=>{
      const current=get();
      // Refocusing a tab can emit SIGNED_IN again. Keep editors mounted while
      // refreshing the same user's permissions; a different identity must wait.
      if(session?.user.id && current.profile?.id===session.user.id && current.isAuthenticated && current.status==='ready'){
        set({session});
      } else {
        set({status:session?'loading':'ready',session,profile:null,user:null,isAuthenticated:false});
      }
    };
    const apply=async(session:Session|null)=>{
      const ticket=++generation;
      prepare(session);
      try {
        const profile=session?.user?await cargarPerfil(session.user.id,session.user.email??''):null;
        if(cancelled||ticket!==generation)return;
        // DataLoader also keys its data reset on this reference. Reuse it only
        // when every profile field and permission is unchanged.
        const current=get().profile;
        const stableProfile=current && profile && JSON.stringify(current)===JSON.stringify(profile)?current:profile;
        set({session,profile:stableProfile,user:stableProfile,isAuthenticated:!!stableProfile,status:'ready'});
      } catch {
        if(!cancelled&&ticket===generation)set({session:null,profile:null,user:null,isAuthenticated:false,status:'ready'});
      }
    };
    const initialGeneration=generation;
    void supabase.auth.getSession().then(({data:{session}})=>{if(!cancelled&&generation===initialGeneration)void apply(session);}).catch(()=>{if(!cancelled&&generation===initialGeneration)void apply(null);});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      // Leave the Auth callback before issuing queries that acquire the SDK session lock.
      const ticket=++generation;
      prepare(session);
      setTimeout(()=>{if(!cancelled&&ticket===generation)void apply(session);},0);
    });
    return ()=>{cancelled=true;++generation;subscription.unsubscribe();};
  },

  login: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error || !data.session) {
      return { ok: false, error: 'Email o contraseña incorrectos.' };
    }
    // onAuthStateChange ya actualiza el store — pero se espera aquí a que
    // el perfil esté cargado para poder redirigir sin parpadeo.
    const profile = await cargarPerfil(data.session.user.id, data.session.user.email ?? '');
    if (!profile) {
      // Sesión válida en Supabase Auth pero sin perfil activo: se cierra la
      // sesión inmediatamente — nunca se deja a alguien "autenticado pero
      // sin ningún permiso" navegando por la app.
      await supabase.auth.signOut();
      set({ session: null, profile: null, user: null, isAuthenticated: false, status: 'ready' });
      return { ok: false, error: 'Tu cuenta no tiene un perfil activo. Contacta con un administrador.' };
    }
    set({ session: data.session, profile, user: profile, isAuthenticated: true, status: 'ready' });
    return { ok: true };
  },

  logout: async () => {
    set({ session: null, profile: null, user: null, isAuthenticated: false, status: 'ready' });
    await supabase.auth.signOut();
  },

  requestPasswordReset: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return { ok: false, error: 'No se pudo enviar el correo de recuperación.' };
    return { ok: true };
  },

  isAdmin: () => !!get().profile?.activo && get().profile?.rol === 'admin',

  permisoLinea: (linea) => {
    const p = get().profile;
    if (!p?.activo) return NO_PERM_CRUD;
    if (p.rol === 'admin') return ADMIN_PERM_CRUD;
    let userCache = permisoLineaCache.get(p);
    if (!userCache) { userCache = new Map(); permisoLineaCache.set(p, userCache); }
    let cached = userCache.get(linea);
    if (!cached) { cached = p.permisosLineas?.[linea] ?? NO_PERM_CRUD; userCache.set(linea, cached); }
    return cached;
  },
  canViewLinea:   (linea) => get().permisoLinea(linea).ver,
  canCreateLinea: (linea) => get().permisoLinea(linea).crear,
  canEditLinea:   (linea) => get().permisoLinea(linea).editar,
  canDeleteLinea: (linea) => get().permisoLinea(linea).eliminar,

  lineasVisibles: () => {
    const p = get().profile;
    if (!p?.activo) return EMPTY_LINEAS;
    if (p.rol === 'admin') return ALL_LINEAS_STABLE;
    let cached = lineasVisiblesCache.get(p);
    if (!cached) { cached = LINEA_IDS.filter((id) => get().canViewLinea(id)); lineasVisiblesCache.set(p, cached); }
    return cached;
  },

  permisoModulo: (modulo) => {
    const p = get().profile;
    if (!p?.activo) return NO_PERM_CRUD;
    if (p.rol === 'admin') return ADMIN_PERM_CRUD;
    let userCache = permisoModuloCache.get(p);
    if (!userCache) { userCache = new Map(); permisoModuloCache.set(p, userCache); }
    let cached = userCache.get(modulo);
    if (!cached) { cached = p.permisosModulos?.[modulo] ?? NO_PERM_CRUD; userCache.set(modulo, cached); }
    return cached;
  },
  canViewModulo:   (modulo) => get().permisoModulo(modulo).ver,
  canCreateModulo: (modulo) => get().permisoModulo(modulo).crear,
  canEditModulo:   (modulo) => get().permisoModulo(modulo).editar,
  canDeleteModulo: (modulo) => get().permisoModulo(modulo).eliminar,

  // Admin siempre pasa — igual que el resto de comprobaciones de esta
  // store — pero un usuario no-admin necesita el permiso fino explícito,
  // no le basta con `canCreateModulo('contabilidad')` (eso solo permite
  // ver/crear registros contables en general, no emitir números reales).
  canEmitirFacturas: () => get().isAdmin() || (!!get().profile?.activo && !!get().profile?.permisosFacturacion?.emitir),
  canRectificarFacturas: () => get().isAdmin() || (!!get().profile?.activo && !!get().profile?.permisosFacturacion?.rectificar),
  canGestionarNumeracion: () => get().isAdmin() || (!!get().profile?.activo && !!get().profile?.permisosFacturacion?.gestionarNumeracion),
}));
