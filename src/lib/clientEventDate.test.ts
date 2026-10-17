import {it,expect} from 'vitest';
import {fechaEventoCliente,ordenEventoCliente} from './clientEventDate';
import type {Cliente,Ingreso} from '../types';
const client={id:'a',nombre:'Ana'} as Cliente;
const income=(date:string,linea='montada_sound')=>({id:date,cliente:'Ana',fechaEvento:date,lineaNegocio:linea,area:'montada'} as Ingreso);
it('elige el próximo evento de Sound y si no hay futuros el último pasado',()=>{
 expect(fechaEventoCliente(client,[client],[income('2027-09-17'),income('2027-01-01'),income('2026-10-01'),income('2026-10-18','dj')],[],'2026-10-17')).toBe('2027-01-01');
 expect(fechaEventoCliente(client,[client],[income('2026-09-17'),income('2026-01-01')],[],'2026-10-17')).toBe('2026-09-17');
});
it('solo usa el CRM como alternativa a ingresos y no enlaza nombres ajenos',()=>{
 expect(fechaEventoCliente(client,[client],[],[{nombre:'Ana',fecha_evento:'2027-09-17'},{nombre:'Otro',fecha_evento:'2027-01-01'}],'2026-10-17')).toBe('2027-09-17');
 expect(fechaEventoCliente(client,[client],[income('2026-09-01')],[{nombre:'Ana',fecha_evento:'2027-09-17'}],'2026-10-17')).toBe('2026-09-01');
});
it('ordena próximos, pasados y sin fecha',()=>{expect(['2026-01-01',undefined,'2027-09-17','2026-10-17','2026-09-01'].sort((a,b)=>ordenEventoCliente(a,b,'2026-10-17'))).toEqual(['2026-10-17','2027-09-17','2026-09-01','2026-01-01',undefined]);});
