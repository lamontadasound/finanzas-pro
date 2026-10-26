import {supabase} from './supabase';
import {db} from './db';
import {generarFacturaPdf} from './facturaPdf';
import type {Factura} from '../types';

export async function syncInvoice(invoice:Factura):Promise<Factura>{
 if(invoice.tipo!=='emitida')throw new Error('Las facturas de gastos se consultan únicamente desde Drive.');
 if(invoice.driveFileId)return invoice;
 if(!invoice.numeroSecuencial||!invoice.emisorSnapshot||!invoice.clienteSnapshot)throw new Error('La factura necesita número y datos fiscales confirmados antes de generar el PDF.');
 const partidoEvento=invoice.ingresoId&&['real_madrid','Real Madrid'].includes(invoice.lineaNegocio??'')?(await db.ingresos.getById(invoice.ingresoId)).concepto:undefined;
 const blob=generarFacturaPdf({partidoEvento,factura:invoice,configuracionFiscal:invoice.emisorSnapshot,cliente:{...invoice.clienteSnapshot,nombre:invoice.clienteSnapshot.nombre??invoice.cliente}}).output('blob');
 const bytes=new Uint8Array(await blob.arrayBuffer());
 if(bytes.byteLength>10*1024*1024)throw new Error('El archivo supera 10 MB.');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');
 let binary='';for(const b of bytes)binary+=String.fromCharCode(b);
 const request={body:{accion:'upload',facturaId:invoice.id,contenidoBase64:btoa(binary),contenidoHash:hash,mimeType:blob.type||'application/pdf'}};
 let {data,error}=await supabase.functions.invoke('drive-sync',request);
 if(error&&'context' in error&&error.context instanceof Response&&error.context.status===409){
  const detail=await error.context.clone().json().catch(()=>null);
  if(typeof detail?.error==='string'&&detail.error.includes('carpeta mensual')){
   const refreshed=await supabase.functions.invoke('drive-invoice-archive');
   if(!refreshed.error&&refreshed.data?.ok)({data,error}=await supabase.functions.invoke('drive-sync',request));
  }
 }

 if(error){
  let detail='';
  if('context' in error && error.context instanceof Response){try{const body=await error.context.json();detail=typeof body.error==='string'?body.error:'';}catch{/* Preserve the original error when no JSON is available. */}}
  throw new Error(detail||error.message||'No se pudo confirmar la subida a Drive.');
 }
 if(!data?.fileId)throw new Error(data?.error||'No se pudo confirmar la subida a Drive.');
 return db.facturas.getById(invoice.id);
}
