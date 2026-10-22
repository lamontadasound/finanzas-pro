import type {Evento,Ingreso} from '../types';
import {lineaDeIngreso} from './contabilidad';
export type CalendarEvent={id:string;date:string;title:string;client:string;type:string;notes?:string;total:number;status:string};
export const localDate=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function soundCalendarEvents(incomes:Ingreso[],events:Evento[]):CalendarEvent[]{
 const linked=new Set(incomes.map(i=>i.eventoId).filter(Boolean));
 return [
  ...incomes.filter(i=>lineaDeIngreso(i)==='montada_sound').map(i=>({id:`income:${i.id}`,date:i.fechaEvento,title:i.concepto,client:i.cliente,type:i.tipoEvento,notes:i.notas,total:i.total,status:i.estadoPago})),
  ...events.filter(e=>e.area==='montada'&&!linked.has(e.id)).map(e=>({id:`event:${e.id}`,date:e.fecha,title:e.nombre,client:e.cliente,type:e.tipo,notes:e.notas,total:e.presupuesto,status:e.estado})),
 ].sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title,'es'));
}
export function monthDays(year:number,month:number){
 const start=new Date(year,month,1,12);start.setDate(start.getDate()-(start.getDay()+6)%7);
 return Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return {date:localDate(d),day:d.getDate(),inMonth:d.getMonth()===month};});
}
