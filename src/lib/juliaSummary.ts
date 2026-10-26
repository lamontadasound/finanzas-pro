import {gastoEventoSinIVA} from './ingresoRentabilidad';
import type {Ingreso,Gasto,GastoEvento,Socio,MovimientoSocio} from '../types';
import {resolveLinea} from '../config/resolveLinea';
import {LINEA_IDS,type LineaId} from '../config/businessLines';
const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export function juliaSummary(year:number,ingresos:Ingreso[],gastos:Gasto[],eventCosts:GastoEvento[],socios:Socio[],movimientos:MovimientoSocio[]=[]){
 const parents=new Map(ingresos.map(i=>[i.id,i]));
 const juliaIds=new Set(socios.filter(s=>/^julia(?: centeno)?$/i.test(s.nombre.trim())).map(s=>s.id));
 const socioMap=new Map(socios.map(s=>[s.id,s]));
 return Array.from({length:12},(_,month)=>{
  const prefix=`${year}-${String(month+1).padStart(2,'0')}`;
  const profit=Object.fromEntries(LINEA_IDS.map(l=>[l,0])) as Record<LineaId,number>;
  ingresos.filter(i=>i.fechaEvento.startsWith(prefix)).forEach(i=>profit[resolveLinea(i)]+=i.baseImponible);
  gastos.filter(g=>g.fecha.startsWith(prefix)).forEach(g=>profit[resolveLinea(g)]-=g.baseImponible);
  eventCosts.forEach(g=>{
   const ingreso=parents.get(g.ingresoId);
   const line=resolveLinea(ingreso??g);
   // El beneficio de Real Madrid pertenece al mes del partido, aunque
   // sus gastos se registren o paguen en otro mes.
   const fecha=line==='real_madrid'&&ingreso?ingreso.fechaEvento:g.fecha;
   if(fecha.startsWith(prefix))profit[line]-=gastoEventoSinIVA(g);
  });
  const amounts:Record<LineaId,number|null>={dj:round(profit.dj),real_madrid:round(profit.real_madrid),montada_sound:0,montada_installations:0};
  for(const m of movimientos){
   if(m.tipo!=='reparto_beneficio_cobrado'||!m.fecha.startsWith(prefix)||!juliaIds.has(m.socioId))continue;
   const line=socioMap.get(m.socioId)?.lineaNegocio??'montada_sound';
   amounts[line]=round((amounts[line]??0)+m.cantidad);
  }
  return {month,profit,amounts,total:round(Object.values(amounts).reduce<number>((n,v)=>n+(v??0),0)),pending:[] as LineaId[]};
 });
}
