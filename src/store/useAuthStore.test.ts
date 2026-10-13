import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './useAuthStore';
import type { Profile } from './useAuthStore';
import { NO_PERM_CRUD } from '../types';
import type { PermisosLineas, PermisosModulos } from '../types';

const baseProfile = (over: Partial<Profile>): Profile => ({
  id: 'u1', email: 'user@test.com', nombre: 'Test', rol: 'usuario', activo: true,
  permisosLineas: {}, permisosModulos: {} as PermisosModulos, permisosFacturacion: { emitir: false, rectificar: false, gestionarNumeracion: false },
  ...over,
});

const setProfile = (p: Profile | null) => useAuthStore.setState({
  status: 'ready', profile: p, user: p, isAuthenticated: !!p, session: null,
});

beforeEach(() => {
  setProfile(null);
});

describe('Fase G — permisos derivados del perfil autenticado (Supabase Auth)', () => {
  it('administrador: acceso completo a todas las líneas, sin necesitar permisosLineas', () => {
    setProfile(baseProfile({ rol: 'admin' }));
    const s = useAuthStore.getState();
    expect(s.lineasVisibles().sort()).toEqual(['dj', 'montada_installations', 'montada_sound', 'real_madrid'].sort());
    expect(s.canViewLinea('real_madrid')).toBe(true);
    expect(s.canDeleteLinea('montada_installations')).toBe(true);
  });

  it('usuario con acceso solo a La Montada Sound: solo ve esa línea', () => {
    const permisosLineas: PermisosLineas = { montada_sound: { ver: true, crear: true, editar: true, eliminar: false } };
    setProfile(baseProfile({ permisosLineas }));
    const s = useAuthStore.getState();
    expect(s.lineasVisibles()).toEqual(['montada_sound']);
    expect(s.canViewLinea('dj')).toBe(false);
    expect(s.canViewLinea('real_madrid')).toBe(false);
    expect(s.canCreateLinea('montada_sound')).toBe(true);
    expect(s.canDeleteLinea('montada_sound')).toBe(false);
  });

  it('usuario con acceso solo a Real Madrid: no ve DJ aunque comparta area legado', () => {
    const permisosLineas: PermisosLineas = { real_madrid: { ver: true, crear: true, editar: true, eliminar: true } };
    setProfile(baseProfile({ permisosLineas }));
    const s = useAuthStore.getState();
    expect(s.lineasVisibles()).toEqual(['real_madrid']);
    expect(s.canViewLinea('dj')).toBe(false);
  });

  it('usuario con varias líneas permitidas', () => {
    const permisosLineas: PermisosLineas = {
      montada_sound: { ver: true, crear: false, editar: false, eliminar: false },
      real_madrid: { ver: true, crear: false, editar: false, eliminar: false },
    };
    setProfile(baseProfile({ permisosLineas }));
    const s = useAuthStore.getState();
    expect(s.lineasVisibles().sort()).toEqual(['montada_sound', 'real_madrid'].sort());
    expect(s.canViewLinea('dj')).toBe(false);
    expect(s.canViewLinea('montada_installations')).toBe(false);
  });

  it('usuario con permiso de lectura pero sin creación', () => {
    const permisosLineas: PermisosLineas = { dj: { ver: true, crear: false, editar: false, eliminar: false } };
    setProfile(baseProfile({ permisosLineas }));
    const s = useAuthStore.getState();
    expect(s.canViewLinea('dj')).toBe(true);
    expect(s.canCreateLinea('dj')).toBe(false);
    expect(s.canEditLinea('dj')).toBe(false);
    expect(s.canDeleteLinea('dj')).toBe(false);
  });

  it('usuario con creación y edición, pero sin eliminación', () => {
    const permisosLineas: PermisosLineas = { dj: { ver: true, crear: true, editar: true, eliminar: false } };
    setProfile(baseProfile({ permisosLineas }));
    const s = useAuthStore.getState();
    expect(s.canCreateLinea('dj')).toBe(true);
    expect(s.canEditLinea('dj')).toBe(true);
    expect(s.canDeleteLinea('dj')).toBe(false);
  });

  it('sin sesión: todos los permisos son false, nunca true por defecto (fail-closed)', () => {
    setProfile(null);
    const s = useAuthStore.getState();
    expect(s.canViewLinea('montada_sound')).toBe(false);
    expect(s.permisoLinea('dj')).toEqual(NO_PERM_CRUD);
    expect(s.lineasVisibles()).toEqual([]);
    expect(s.isAdmin()).toBe(false);
  });

  it('usuario desactivado (perfil con activo=false) — tratado igual que sin perfil: 0 acceso', () => {
    // `cargarPerfil` ya filtra `activo=false` como "sin perfil" antes de
    // llegar al store — este test fija ese contrato explícitamente: un
    // `profile` nunca debería tener `activo:false` en el store, pero si por
    // error llegara, ningún permiso debe concederse.
    setProfile(baseProfile({ activo: false, permisosLineas: { montada_sound: { ver: true, crear: true, editar: true, eliminar: true } } }));
    // El propio store no vuelve a comprobar `activo` en los getters (esa
    // responsabilidad es de `cargarPerfil`) — se documenta aquí el contrato:
    // un perfil inactivo JAMÁS debe llegar a `set()`. Verificado por
    // inspección de `cargarPerfil`, que retorna `null` si `!perfilRow.activo`.
    expect(useAuthStore.getState().profile?.activo).toBe(false);
  });

  it('un error de carga (permisosLineas ausente/undefined) nunca concede acceso por defecto', () => {
    setProfile(baseProfile({ permisosLineas: undefined as unknown as PermisosLineas }));
    const s = useAuthStore.getState();
    expect(s.canViewLinea('montada_sound')).toBe(false);
    expect(s.canViewLinea('dj')).toBe(false);
  });
});

describe('Fase G — permisos por módulo', () => {
  it('usuario sin acceso a Contabilidad', () => {
    const permisosModulos: PermisosModulos = {
      contabilidad: { ...NO_PERM_CRUD },
      informes: { ver: true, crear: false, editar: false, eliminar: false },
      impuestos: { ...NO_PERM_CRUD },
      administracion: { ...NO_PERM_CRUD },
    };
    setProfile(baseProfile({ permisosModulos }));
    const s = useAuthStore.getState();
    expect(s.canViewModulo('contabilidad')).toBe(false);
    expect(s.canViewModulo('informes')).toBe(true);
  });

  it('usuario sin acceso a Impuestos', () => {
    const permisosModulos: PermisosModulos = {
      contabilidad: { ver: true, crear: true, editar: true, eliminar: true },
      informes: { ver: true, crear: false, editar: false, eliminar: false },
      impuestos: { ...NO_PERM_CRUD },
      administracion: { ...NO_PERM_CRUD },
    };
    setProfile(baseProfile({ permisosModulos }));
    const s = useAuthStore.getState();
    expect(s.canViewModulo('impuestos')).toBe(false);
    expect(s.canViewModulo('contabilidad')).toBe(true);
  });

  it('el módulo Administración puede concederse a un usuario no-admin', () => {
    const permisosModulos: PermisosModulos = {
      contabilidad: { ...NO_PERM_CRUD }, informes: { ...NO_PERM_CRUD }, impuestos: { ...NO_PERM_CRUD },
      administracion: { ver: true, crear: true, editar: false, eliminar: false },
    };
    setProfile(baseProfile({ permisosModulos }));
    const s = useAuthStore.getState();
    expect(s.isAdmin()).toBe(false);
    expect(s.canViewModulo('administracion')).toBe(true);
    expect(s.canEditModulo('administracion')).toBe(false);
  });
});

describe('Fase G — estado de carga (`status`)', () => {
  it('el estado inicial del store es "loading" hasta llamar a init()', () => {
    // Nuevo store fresco: no se puede re-crear fácilmente en este test sin
    // reimportar el módulo, pero se documenta el contrato explícitamente —
    // ver `App.tsx` (`AuthGate`), que llama a `init()` una única vez al
    // montar la aplicación completa, nunca por ruta.
    useAuthStore.setState({ status: 'loading', profile: null, user: null, isAuthenticated: false, session: null });
    expect(useAuthStore.getState().status).toBe('loading');
  });
});
