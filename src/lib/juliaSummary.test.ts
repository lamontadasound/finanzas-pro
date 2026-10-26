import {describe,it,expect} from 'vitest';
import {juliaSummary} from './juliaSummary';
import type {Ingreso,Gasto,GastoEvento,Socio,MovimientoSocio} from '../types';
const income=(id:string,lineaNegocio:string,baseImponible:number,fechaEvento='2026-01-10')=>({id,lineaNegocio,baseImponible,fechaEvento,area:'dj'} as Ingreso);
const socios=[{id:'js',nombre:'Julia',porcentaje:99,lineaNegocio:'montada_sound'},{id:'ms',nombre:'Marco',lineaNegocio:'montada_sound'},{id:'ji',nombre:'Julia',lineaNegocio:'montada_installations'}] as Socio[];
const mov=(socioId:string,cantidad:number,fecha='2026-03-31',tipo='reparto_beneficio_cobrado')=>({socioId,cantidad,fecha,tipo} as MovimientoSocio);
describe('Resumen de Julia con repartos manuales',()=>{
 it('DJ y Real Madrid aportan el beneficio completo y restan costes una vez',()=>{
 const rows=juliaSummary(2026,[income('dj','dj',1000),income('rm','real_madrid',2000)],[{area:'dj',lineaNegocio:'dj',fecha:'2026-01-01',baseImponible:100,total:121} as Gasto],[{ingresoId:'rm',area:'dj',fecha:'2026-01-02',importe:300} as GastoEvento],[]);
 expect(rows[0].amounts.dj).toBe(900);expect(rows[0].amounts.real_madrid).toBe(1700);expect(rows[0].total).toBe(2600);
 });
 it('usa importes registrados de Julia, ignora porcentajes, capital y otros socios',()=>{
 const rows=juliaSummary(2026,[income('s','montada_sound',10000)],[],[],socios,[mov('js',300),mov('ms',800),mov('js',900,'2026-03-31','aportacion_personal'),mov('js',100,'2026-03-31','reintegro_aportacion')]);
 expect(rows[2].amounts.montada_sound).toBe(300);expect(rows[0].amounts.montada_sound).toBe(0);
 });
 it('separa meses, años y líneas y refleja una edición sin duplicar',()=>{
 const ms=[mov('js',450),mov('ji',200,'2026-02-01'),mov('js',9999,'2025-03-31')];
 const rows=juliaSummary(2026,[],[],[],socios,ms);expect(rows[1].amounts.montada_installations).toBe(200);expect(rows[2].amounts.montada_sound).toBe(450);expect(rows.reduce((n,m)=>n+m.total,0)).toBe(650);
 const changed=juliaSummary(2026,[],[],[],socios,[{...ms[0],cantidad:500},...ms.slice(1)]);expect(changed[2].total).toBe(500);
 });
});


it('total personal: beneficio sin IVA DJ y Real Madrid más solo repartos de Julia',()=>{
 const rows=juliaSummary(2026,[income('d','dj',1000),income('r','real_madrid',3000),income('s','montada_sound',90000),income('i','montada_installations',50000)],
 [{lineaNegocio:'dj',fecha:'2026-01-01',baseImponible:100,total:121} as Gasto],
 [{ingresoId:'d',fecha:'2026-01-02',importe:242,baseImponible:200,importeIVA:42} as GastoEvento,{ingresoId:'r',fecha:'2026-01-03',importe:605,importeIVA:105} as GastoEvento],socios,[mov('js',300,'2026-01-31'),mov('ji',200,'2026-01-31'),mov('ms',999,'2026-01-31')]);
 expect(rows[0].amounts).toEqual({dj:700,real_madrid:2500,montada_sound:300,montada_installations:200});
 expect(rows[0].total).toBe(3700);
});
