import type {Cliente,Ingreso} from '../types';
import {clienteCoincide} from './crmSound';
import {lineaDeIngreso} from './contabilidad';
const valid=(d?:string|null):d is string=>!!d&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d));
export function fechaEventoCliente(cliente:Cliente,clientes:Cliente[],ingresos:Ingreso[],leads:{nombre:string;fecha_evento?:string|null}[],today:string){
 const related=ingresos.filter(i=>lineaDeIngreso(i)==='montada_sound'&&clienteCoincide(i.cliente,cliente,clientes));
 const dates=(related.length?related.map(i=>i.fechaEvento):leads.filter(l=>clienteCoincide(l.nombre,cliente,clientes)).map(l=>l.fecha_evento)).filter(valid).sort();
 return dates.find(d=>d>=today)??dates.at(-1);
}
export function ordenEventoCliente(a:string|undefined,b:string|undefined,today:string){
 const group=(d?:string)=>!d?2:d>=today?0:1;
 const diff=group(a)-group(b);if(diff)return diff;if(!a||!b)return 0;
 return group(a)===0?a.localeCompare(b):b.localeCompare(a);
}
export const fechaEventoCorta=(date?:string)=>date?new Date(`${date}T12:00:00`).toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'}):'Sin fecha de evento';
