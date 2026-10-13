import {describe,it,expect} from 'vitest';
import {ingresoRentabilidad} from './ingresoRentabilidad';
import {fixtureIngresos} from '../dev/fixtures';
import type {GastoEvento} from '../types';
const ingreso={...fixtureIngresos[0],baseImponible:1000,total:1210,importeIVA:210};
const expense=(data:Partial<GastoEvento>)=>({id:'g',ingresoId:ingreso.id,area:'montada',importe:121,baseImponible:100,importeIVA:21,concepto:'Técnico',categoria:'Técnico',fecha:'2026-06-14',createdAt:'',...data} as GastoEvento);
describe('Rentabilidad por ingreso',()=>{
 it('descuenta costes sin IVA y solo los enlazados al ingreso y área',()=>{const r=ingresoRentabilidad(ingreso,[expense({}),expense({ingresoId:'otro'}),expense({area:'dj'})]);expect(r.coste).toBe(100);expect(r.beneficio).toBe(900);expect(r.margen).toBe(90);expect(r.costeConIVA).toBe(121);expect(r.gastos).toHaveLength(1);});
 it('respeta el cero explícito, resta IVA conocido y señala importes históricos',()=>{const r=ingresoRentabilidad(ingreso,[expense({baseImponible:0}),expense({baseImponible:undefined}),expense({baseImponible:undefined,importeIVA:undefined,importe:50})]);expect(r.coste).toBe(150);expect(r.sinDesglose).toBe(1);});
 it('muestra pérdidas y evita dividir por cero',()=>{expect(ingresoRentabilidad(ingreso,[expense({baseImponible:1500})]).margen).toBe(-50);expect(ingresoRentabilidad({...ingreso,baseImponible:0},[]).margen).toBeNull();});
 it('usa las reglas comunes de cobro incluyendo reserva y el estado pagado',()=>{const r=ingresoRentabilidad({...ingreso,pagosRecibidos:200,tieneReserva:true,reserva:100},[]);expect(r.cobrado).toBe(300);expect(r.pendiente).toBe(910);expect(ingresoRentabilidad({...ingreso,estadoPago:'pagado',pagosRecibidos:0},[]).pendiente).toBe(0);});
});
