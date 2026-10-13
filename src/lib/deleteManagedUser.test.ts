import { describe, it, expect, vi } from 'vitest';
import { deleteManagedUser } from '../../supabase/functions/_shared/delete-user';
const caller='11111111-1111-4111-8111-111111111111';
const target='22222222-2222-4222-8222-222222222222';
const steps=()=>({deactivate:vi.fn().mockResolvedValue({error:null}),removeAuth:vi.fn().mockResolvedValue({error:null}),removeProfile:vi.fn().mockResolvedValue({error:null})});
describe('borrado de acceso administrado',()=>{
 it('rechaza no administradores y borrado propio antes de cualquier cambio',async()=>{
  const s=steps();expect((await deleteManagedUser(caller,target,false,s)).status).toBe(403);
  expect((await deleteManagedUser(caller,caller,true,s)).status).toBe(400);
  expect(s.deactivate).not.toHaveBeenCalled();
 });
 it('si el trigger protege al último admin no toca Auth ni el perfil',async()=>{
  const s=steps();s.deactivate.mockResolvedValue({error:'ultimo admin'});
  expect((await deleteManagedUser(caller,target,true,s)).status).toBe(409);
  expect(s.removeAuth).not.toHaveBeenCalled();expect(s.removeProfile).not.toHaveBeenCalled();
 });
 it('un fallo de Auth conserva el perfil desactivado para reintentar',async()=>{
  const s=steps();s.removeAuth.mockResolvedValue({error:'fallo'});
  expect((await deleteManagedUser(caller,target,true,s)).error).toContain('desactivado');
  expect(s.removeProfile).not.toHaveBeenCalled();
 });
 it('no anuncia éxito si no puede retirar el perfil',async()=>{
  const s=steps();s.removeProfile.mockResolvedValue({error:'fallo'});
  expect((await deleteManagedUser(caller,target,true,s)).status).toBe(500);
 });
 it('retira primero el acceso, luego Auth y al final el perfil',async()=>{
  const s=steps();expect((await deleteManagedUser(caller,target,true,s)).ok).toBe(true);
  expect(s.deactivate.mock.invocationCallOrder[0]).toBeLessThan(s.removeAuth.mock.invocationCallOrder[0]);
  expect(s.removeAuth.mock.invocationCallOrder[0]).toBeLessThan(s.removeProfile.mock.invocationCallOrder[0]);
 });
});
