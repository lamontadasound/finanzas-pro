import type {Ingreso,Gasto,GastoEvento} from '../types';
import {lineaDeIngreso,lineaDeGasto,pendienteDe} from './contabilidad';
import {gastoEventoSinIVA,gastoEventoConIVA} from './ingresoRentabilidad';
export function soundResults(ingresos:Ingreso[],gastos:Gasto[],eventos:GastoEvento[],year:string){
 const all=ingresos.filter(i=>lineaDeIngreso(i)==='montada_sound');const ids=new Set(all.map(i=>i.id));
 const inYear=(d:string)=>year==='todos'||d?.slice(0,4)===year;
 const income=all.filter(i=>i.estadoPago!=='cancelado'&&i.estadoPago!=='presupuesto'&&inYear(i.fechaEvento));
 const general=gastos.filter(g=>lineaDeGasto(g)==='montada_sound'&&inYear(g.fecha));
 const event=eventos.filter(g=>ids.has(g.ingresoId)&&inYear(g.fecha));
 const sum=<T,>(rows:T[],fn:(r:T)=>number)=>rows.reduce((n,r)=>n+Math.round(fn(r)*100),0)/100;
 const revenue=sum(income,i=>i.baseImponible),outputVat=sum(income,i=>i.importeIVA);
 const expenses=sum(general,g=>g.baseImponible)+sum(event,gastoEventoSinIVA),inputVat=sum(general,g=>g.importeIVA)+sum(event,g=>g.importeIVA??Math.max(0,gastoEventoConIVA(g)-gastoEventoSinIVA(g)));
 return {income:revenue,outputVat,expenses,inputVat,result:Math.round((revenue-expenses)*100)/100,vat:Math.round((outputVat-inputVat)*100)/100,
 incomeTotal:sum(income,i=>i.total),expenseTotal:sum(general,g=>g.total)+sum(event,gastoEventoConIVA),
 receivable:sum(income,pendienteDe),payable:sum(general.filter(g=>g.estadoPago!=='pagado'),g=>g.total)+sum(event.filter(g=>g.estadoPago!=='pagado'),gastoEventoConIVA),
 pending:event.filter(g=>g.baseImponible==null&&g.importeIVA==null).length};
}
