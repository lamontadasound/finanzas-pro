import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AdminUsuarios } from './Usuarios';
import { useConfirmStore } from '../../store/useConfirmStore';
const mocks=vi.hoisted(()=>({invoke:vi.fn(),init:vi.fn(),rol:'admin'}));
const admin={id:'11111111-1111-4111-8111-111111111111',nombre:'Admin',email:'admin@example.test',rol:'admin',activo:true};
const target={id:'22222222-2222-4222-8222-222222222222',nombre:'Prueba',email:'prueba@example.test',rol:'usuario',activo:true};
vi.mock('../../lib/supabase',()=>({supabase:{functions:{invoke:mocks.invoke}}}));
vi.mock('../../store/useStore',()=>({useStore:(s:(v:unknown)=>unknown)=>s({usuarios:[admin,target],_loaded:true,initData:mocks.init,permisosFacturacion:{}})}));
vi.mock('../../store/useAuthStore',()=>({useAuthStore:(s:(v:unknown)=>unknown)=>s({user:{...admin,rol:mocks.rol}})}));
afterEach(cleanup);
beforeEach(()=>{vi.clearAllMocks();mocks.rol='admin';mocks.init.mockResolvedValue(undefined);useConfirmStore.getState().cancel();});
describe('Eliminar usuarios',()=>{
 it('requiere confirmar y protege la cuenta propia',async()=>{
  mocks.invoke.mockResolvedValue({data:{ok:true},error:null});render(<AdminUsuarios/>);
  expect((screen.getByRole('button',{name:'Eliminar usuario Admin'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Eliminar usuario Prueba'}));
  expect(mocks.invoke).not.toHaveBeenCalled();
  expect(useConfirmStore.getState().message).toContain('prueba@example.test');
  await act(async()=>useConfirmStore.getState().confirm());
  await waitFor(()=>expect(mocks.invoke).toHaveBeenCalledWith('admin-user-actions',{body:{action:'delete_user',userId:target.id}}));
  expect(screen.getByRole('status').textContent).toContain('eliminado');
 });
 it('muestra errores y permite reintentar sin anunciar borrado',async()=>{
  mocks.invoke.mockResolvedValue({data:{error:'Cuenta protegida'},error:new Error('fallo')});render(<AdminUsuarios/>);
  fireEvent.click(screen.getByRole('button',{name:'Eliminar usuario Prueba'}));
  await act(async()=>useConfirmStore.getState().confirm());
  expect((await screen.findByRole('alert')).textContent).toContain('Cuenta protegida');
  expect(screen.queryByRole('status')).toBeNull();
 });
 it('no ofrece borrado a no administradores',()=>{
  mocks.rol='usuario';render(<AdminUsuarios/>);
  expect(screen.queryByRole('button',{name:'Eliminar usuario Prueba'})).toBeNull();
 });
});
