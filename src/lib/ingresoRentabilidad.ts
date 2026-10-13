import type {Ingreso,GastoEvento} from '../types';
import {cobradoDe,pendienteDe} from './contabilidad';
export const gastoEventoSinIVA=(g:GastoEvento)=>g.baseImponible??(g.importe-(g.importeIVA??0));
export const gastoEventoConIVA=(g:GastoEvento)=>g.totalConIva??g.importe;
export function ingresoRentabilidad(ingreso:Ingreso,gastos:GastoEvento[]){
 const vinculados=gastos.filter(g=>g.ingresoId===ingreso.id&&g.area===ingreso.area);
 const coste=vinculados.reduce((sum,g)=>sum+gastoEventoSinIVA(g),0);
 const beneficio=ingreso.baseImponible-coste;
 return {gastos:vinculados,coste,beneficio,margen:ingreso.baseImponible>0?beneficio/ingreso.baseImponible*100:null,
  costeConIVA:vinculados.reduce((sum,g)=>sum+gastoEventoConIVA(g),0),cobrado:cobradoDe(ingreso),pendiente:pendienteDe(ingreso),
  sinDesglose:vinculados.filter(g=>g.baseImponible==null&&g.importeIVA==null).length};
}
