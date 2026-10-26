import {describe,it,expect} from 'vitest';
import {renderHook} from '@testing-library/react';
import {useLineaFinance} from './useLineaFinance';
import {juliaSummary} from '../lib/juliaSummary';
import type {Ingreso,Gasto,GastoEvento,Equipo} from '../types';

describe.each(['dj','real_madrid'])('Beneficio coherente de %s',lineaNegocio=>{
 it('coincide por mes y año, sin IVA y con gastos registrados en otro año',()=>{
  const ingresos=[
   {id:'enero',area:'dj',lineaNegocio,fechaEvento:'2026-01-15',baseImponible:3000,total:3630,importeIVA:630,pagosRecibidos:0},
   {id:'febrero',area:'dj',lineaNegocio,fechaEvento:'2026-02-15',baseImponible:1000,total:1210,importeIVA:210,pagosRecibidos:0},
   {id:'anterior',area:'dj',lineaNegocio,fechaEvento:'2025-12-15',baseImponible:500,total:605,importeIVA:105,pagosRecibidos:0},
  ] as Ingreso[];
  const gastos=[{area:'dj',lineaNegocio,fecha:'2026-01-01',baseImponible:100,total:121}] as Gasto[];
  const costes=[
   {ingresoId:'enero',area:'dj',fecha:'2025-12-01',importe:605,baseImponible:500,importeIVA:105},
   {ingresoId:'enero',area:'dj',fecha:'2026-02-01',importe:242,importeIVA:42},
   {ingresoId:'febrero',area:'dj',fecha:'2026-03-01',importe:100},
   {ingresoId:'anterior',area:'dj',fecha:'2026-01-01',importe:50},
   {ingresoId:'inexistente',area:'dj',lineaNegocio,fecha:'2026-01-01',importe:999},
  ] as GastoEvento[];
  const resumen=juliaSummary(2026,ingresos,gastos,costes,[]);
  const monthly=[2200,900];
  monthly.forEach((expected,m)=>{
   const prefix=`2026-0${m+1}`;
   const rows=ingresos.filter(i=>i.fechaEvento.startsWith(prefix));
   const {result}=renderHook(()=>useLineaFinance(rows,gastos.filter(g=>g.fecha.startsWith(prefix)),costes.filter(g=>rows.some(i=>i.id===g.ingresoId))));
   expect(result.current.beneficioOperativo).toBe(expected);
   expect(resumen[m].amounts[lineaNegocio as 'dj'|'real_madrid']).toBe(result.current.beneficioOperativo);
  });
  const rows=ingresos.filter(i=>i.fechaEvento.startsWith('2026'));
  const {result}=renderHook(()=>useLineaFinance(rows,gastos,costes.filter(g=>rows.some(i=>i.id===g.ingresoId)),[{total:1000}] as Equipo[]));
  expect(result.current.beneficioOperativo).toBe(3100);
  expect(result.current.flujoCajaTrasInversiones).toBe(2100);
  expect(resumen.reduce((sum,m)=>sum+(m.amounts[lineaNegocio as 'dj'|'real_madrid']??0),0)).toBe(result.current.beneficioOperativo);
 });
});
