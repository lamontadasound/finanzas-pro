import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { RequireLinea, RequireModulo, RequireAdminStrict } from './RouteGuards';
import { useAuthStore } from '../../store/useAuthStore';
import type { Profile } from '../../store/useAuthStore';
import type { PermisosModulos } from '../../types';
import { NO_PERM_CRUD } from '../../types';

afterEach(cleanup);

const SECRET = 'IMPORTE-SECRETO-12345';

const setAuth = (over: { status?: 'loading' | 'ready'; profile?: Profile | null }) => {
  useAuthStore.setState({
    status: over.status ?? 'ready',
    profile: over.profile ?? null,
    user: over.profile ?? null,
    isAuthenticated: !!over.profile,
    session: null,
  });
};

const profile = (over: Partial<Profile>): Profile => ({
  id: 'u1', email: 'x@x.com', nombre: 'X', rol: 'usuario', activo: true,
  permisosLineas: {}, permisosModulos: {} as PermisosModulos, permisosFacturacion: { emitir: false, rectificar: false, gestionarNumeracion: false },
  ...over,
});

describe('RequireLinea — acceso directo por URL / fuga de datos', () => {
  it('mientras Supabase Auth no ha resuelto la sesión, NO se renderiza el contenido protegido (sin fuga momentánea)', () => {
    setAuth({ status: 'loading', profile: null });
    render(
      <RequireLinea linea="montada_sound">
        <div>{SECRET}</div>
      </RequireLinea>,
    );
    expect(screen.queryByText(SECRET)).toBeNull();
  });

  it('usuario sin permiso de línea que intenta acceso directo: pantalla limpia de "No tienes permiso", sin datos', () => {
    setAuth({ profile: profile({ permisosLineas: { dj: { ver: true, crear: true, editar: true, eliminar: true } } }) });
    render(
      <RequireLinea linea="real_madrid">
        <div>{SECRET}</div>
      </RequireLinea>,
    );
    expect(screen.queryByText(SECRET)).toBeNull();
    expect(screen.getByText('No tienes permiso para acceder')).toBeTruthy();
  });

  it('usuario CON permiso de línea sí ve el contenido', () => {
    setAuth({ profile: profile({ permisosLineas: { real_madrid: { ver: true, crear: false, editar: false, eliminar: false } } }) });
    render(
      <RequireLinea linea="real_madrid">
        <div>{SECRET}</div>
      </RequireLinea>,
    );
    expect(screen.getByText(SECRET)).toBeTruthy();
  });

  it('un error de permisos (permisosLineas vacío) nunca concede acceso por defecto', () => {
    setAuth({ profile: profile({ permisosLineas: {} }) });
    render(
      <RequireLinea linea="montada_sound">
        <div>{SECRET}</div>
      </RequireLinea>,
    );
    expect(screen.queryByText(SECRET)).toBeNull();
  });

  it('sin sesión (perfil null): acceso denegado, nunca contenido', () => {
    setAuth({ profile: null });
    render(
      <RequireLinea linea="montada_sound">
        <div>{SECRET}</div>
      </RequireLinea>,
    );
    expect(screen.queryByText(SECRET)).toBeNull();
  });
});

describe('RequireModulo', () => {
  it('sin sesión: acceso denegado, nunca contenido', () => {
    setAuth({ profile: null });
    render(
      <RequireModulo modulo="contabilidad">
        <div>{SECRET}</div>
      </RequireModulo>,
    );
    expect(screen.queryByText(SECRET)).toBeNull();
    expect(screen.getByText('No tienes permiso para acceder')).toBeTruthy();
  });

  it('usuario sin Contabilidad no ve el módulo aunque tenga otros permisos', () => {
    setAuth({
      profile: profile({
        permisosModulos: {
          contabilidad: { ...NO_PERM_CRUD },
          informes: { ver: true, crear: false, editar: false, eliminar: false },
          impuestos: { ...NO_PERM_CRUD },
          administracion: { ...NO_PERM_CRUD },
        },
      }),
    });
    render(<RequireModulo modulo="contabilidad"><div>{SECRET}</div></RequireModulo>);
    expect(screen.queryByText(SECRET)).toBeNull();
  });
});

describe('RequireAdminStrict', () => {
  it('un usuario con acceso al módulo "administracion" pero rol "usuario" no pasa este guard más estricto', () => {
    setAuth({
      profile: profile({
        permisosModulos: {
          administracion: { ver: true, crear: true, editar: true, eliminar: true },
          contabilidad: { ...NO_PERM_CRUD }, informes: { ...NO_PERM_CRUD }, impuestos: { ...NO_PERM_CRUD },
        },
      }),
    });
    render(
      <RequireAdminStrict>
        <div>{SECRET}</div>
      </RequireAdminStrict>,
    );
    expect(screen.queryByText(SECRET)).toBeNull();
  });

  it('un admin real sí pasa', () => {
    setAuth({ profile: profile({ rol: 'admin' }) });
    render(
      <RequireAdminStrict>
        <div>{SECRET}</div>
      </RequireAdminStrict>,
    );
    expect(screen.getByText(SECRET)).toBeTruthy();
  });
});
