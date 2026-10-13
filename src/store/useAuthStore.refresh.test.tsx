import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { useAuthStore, type Profile } from './useAuthStore';
const sdk = vi.hoisted(() => ({ listener: null as null | ((event: AuthChangeEvent, session: Session | null) => void), profile: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: {
  auth: { getSession: () => new Promise(() => {}), onAuthStateChange: (listener: typeof sdk.listener) => {
    sdk.listener = listener;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  } },
  from: (table: string) => ({ select: () => ({ eq: () => table === 'profiles'
    ? { single: sdk.profile }
    : table === 'user_facturacion_permissions' ? { maybeSingle: async () => ({ data: null }) } : Promise.resolve({ data: [] }) }) }),
} }));
const session = (id = 'u1') => ({ user: { id, email: 'test@example.com' }, access_token: 'renewed' }) as Session;
const profile: Profile = { id: 'u1', email: 'test@example.com', nombre: 'Test', rol: 'admin', activo: true,
  permisosLineas: {}, permisosModulos: {} as Profile['permisosModulos'], permisosFacturacion: { emitir: false, rectificar: false, gestionarNumeracion: false } };
// RequireAuth replaces its children when loading, which loses local edits.
function Editor() {
  const [value, setValue] = useState('');
  return <input aria-label="Presupuesto en curso" value={value} onChange={e => setValue(e.target.value)} />;
}
function Gate() {
  const { status, isAuthenticated } = useAuthStore();
  return status === 'ready' && isAuthenticated ? <Editor /> : <span>Sin editor</span>;
}
let dispose: () => void;
beforeEach(() => {
  vi.useFakeTimers();
  sdk.profile.mockReset().mockResolvedValue({ data: profile, error: null });
  useAuthStore.setState({ status: 'ready', session: session(), profile, user: profile, isAuthenticated: true });
  dispose = useAuthStore.getState().init();
});
afterEach(() => { dispose(); cleanup(); vi.useRealTimers(); });
describe('Conservar el editor al volver a la app', () => {
  it.each(['SIGNED_IN', 'TOKEN_REFRESHED'] as const)('%s conserva campos antes y después de revalidar', async event => {
    render(<Gate />);
    fireEvent.change(screen.getByLabelText('Presupuesto en curso'), { target: { value: 'Boda: sonido y luces' } });
    act(() => sdk.listener!(event, session()));
    expect((screen.getByLabelText('Presupuesto en curso') as HTMLInputElement).value).toBe('Boda: sonido y luces');
    await act(() => vi.runAllTimersAsync());
    expect((screen.getByLabelText('Presupuesto en curso') as HTMLInputElement).value).toBe('Boda: sonido y luces');
    expect(sdk.profile).toHaveBeenCalledOnce();
    expect(useAuthStore.getState().profile).toBe(profile);
  });
  it.each([null, session('other')])('retira el editor al salir o cambiar usuario: %j', next => {
    render(<Gate />);
    act(() => sdk.listener!(next ? 'SIGNED_IN' : 'SIGNED_OUT', next));
    expect(screen.queryByLabelText('Presupuesto en curso')).toBeNull();
    expect(useAuthStore.getState().profile).toBeNull();
  });
  it('retira el acceso si el perfil ya no está activo', async () => {
    sdk.profile.mockResolvedValue({ data: { ...profile, activo: false }, error: null });
    render(<Gate />);
    act(() => sdk.listener!('TOKEN_REFRESHED', session()));
    await act(() => vi.runAllTimersAsync());
    expect(screen.queryByLabelText('Presupuesto en curso')).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
  it('una respuesta pendiente no restaura una sesión cerrada', async () => {
    let resolve!: (value: unknown) => void;
    sdk.profile.mockReturnValue(new Promise(r => { resolve = r; }));
    act(() => sdk.listener!('TOKEN_REFRESHED', session()));
    await act(() => vi.runAllTimersAsync());
    act(() => sdk.listener!('SIGNED_OUT', null));
    await act(async () => { resolve({ data: profile, error: null }); await vi.runAllTimersAsync(); });
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().profile).toBeNull();
  });
});
