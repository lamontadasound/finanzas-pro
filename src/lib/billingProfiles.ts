import type {Factura} from '../types';
export interface BillingProfile {key:string;nombre:string;nifCif:string;direccion:string;email:string;telefono:string}
/** Reuse snapshots from accessible invoices; never couple billing to the CRM. */
export function billingProfiles(invoices:Factura[]):BillingProfile[]{
 const found=new Map<string,BillingProfile>();
 for(const f of [...invoices].sort((a,b)=>(b.fechaEmision??b.fecha).localeCompare(a.fechaEmision??a.fecha))){
  if(f.tipo!=='emitida')continue;
  const c=f.clienteSnapshot??f.clienteBorrador;if(!c?.nombre?.trim())continue;
  const key=c.nifCif?.replace(/[\s-]/g,'').toUpperCase()||c.nombre.trim().toLocaleLowerCase('es');
  if(!found.has(key))found.set(key,{key,nombre:c.nombre,nifCif:c.nifCif??'',direccion:c.direccion??'',email:c.email??'',telefono:c.telefono??''});
 }
 return [...found.values()].sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
}
