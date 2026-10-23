import {it,expect} from 'vitest';
import type {Ingreso,Gasto,GastoEvento} from '../types';
import {soundResults} from './resultados';
it('separa La Montada, periodo y reservas cobradas sin sumar gastos de otra línea',()=>{
 const i={id:'s',area:'montada',lineaNegocio:'montada_sound',fechaEvento:'2026-10-01',baseImponible:1000,importeIVA:210,total:1210,estadoPago:'parcial',pagosRecibidos:100,tieneReserva:true,reserva:200} as Ingreso;
 const g={area:'montada',lineaNegocio:'montada_sound',fecha:'2026-10-01',baseImponible:100,importeIVA:21,total:121,estadoPago:'pagado'} as Gasto;
 const e={ingresoId:'s',fecha:'2026-10-01',baseImponible:50,importeIVA:10.5,totalConIva:60.5,importe:60.5,estadoPago:'pendiente'} as GastoEvento;
 const r=soundResults([i,{...i,id:'dj',lineaNegocio:'dj'}],[g,{...g,fecha:'2025-10-01'}],[e,{...e,ingresoId:'dj'}],'2026');
 expect(r.result).toBe(850);expect(r.vat).toBe(178.5);expect(r.receivable).toBe(910);expect(r.payable).toBe(60.5);
});
