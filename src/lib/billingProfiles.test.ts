import {it,expect} from 'vitest';
import type {Factura} from '../types';
import {billingProfiles} from './billingProfiles';
it('reutiliza el último perfil por NIF y no mezcla clientes ni recibidas',()=>{
 const f=(fecha:string,nif:string,nombre:string,tipo='emitida')=>({fecha,tipo,clienteBorrador:{nombre,nifCif:nif,direccion:'Madrid'}} as Factura);
 const profiles=billingProfiles([f('2026-01-01','B-123','Viejo'),f('2026-02-01','B123','Nuevo'),f('2026-03-01','B999','Otra'),f('2026-04-01','B123','Proveedor','recibida')]);
 expect(profiles).toHaveLength(2);expect(profiles.find(p=>p.key==='B123')?.nombre).toBe('Nuevo');expect(profiles[0].direccion).toBe('Madrid');
});
