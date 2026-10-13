import { supabase } from './supabase';
import type { Cliente } from '../types';
export const ETAPAS = {contacto:'Contacto',propuesta:'Propuesta enviada',negociacion:'Negociación',ganado:'Ganado',perdido:'Perdido'} as const;
export const SERVICIOS_CRM={sin_clasificar:'Sin clasificar',alquiler:'Alquiler',boda:'Boda',corporativo:'Evento corporativo',privado:'Evento privado',otro:'Otro servicio'} as const;
export const ORIGENES_CRM=['Instagram','Web','WhatsApp','Recomendación','Email','Llamada','Cliente recurrente','Otro'];
export const CATEGORIAS = {informacion:'Información y listados',contrato:'Contratos',presupuesto:'Presupuestos',factura:'Facturas'} as const;
export type CategoriaCRM = keyof typeof CATEGORIAS;
export interface FichaCRM {cliente_id:string;etapa:keyof typeof ETAPAS;proxima_accion:string;fecha_seguimiento:string|null;notas:string;cliente:Cliente;origen:string;contacto_nombre:string;tipo_servicio:keyof typeof SERVICIOS_CRM;motivo_perdida:string;fecha_cierre:string|null}
export interface ArchivoCRM {id:string;cliente_id:string;categoria:CategoriaCRM;nombre:string;storage_path:string;created_at:string}
export const normalizarCliente=(nombre:string)=>nombre.trim().toLocaleLowerCase('es');
export function clienteCoincide(nombre:string,cliente:Cliente,clientes:Cliente[]){const key=normalizarCliente(nombre);return key!==''&&key===normalizarCliente(cliente.nombre)&&clientes.filter(c=>normalizarCliente(c.nombre)===key).length===1;}
export async function cargarCRM():Promise<FichaCRM[]> {
 const {data,error}=await supabase.from('crm_sound_clientes').select('*,cliente:clientes(*)').is('eliminado_en',null).eq('carpeta_cliente',true).order('created_at',{ascending:false});
 if(error)throw new Error('No se pudieron cargar los clientes. Reintenta.');
 return (data??[]).map(r=>({...r,origen:r.origen??'',contacto_nombre:r.contacto_nombre??'',tipo_servicio:r.tipo_servicio??'sin_clasificar',motivo_perdida:r.motivo_perdida??'',fecha_cierre:r.fecha_cierre??null,cliente:{id:r.cliente.id,nombre:r.cliente.nombre,nifCif:r.cliente.nif_cif??'',direccion:r.cliente.direccion??'',email:r.cliente.email??'',telefono:r.cliente.telefono??'',esEmpresa:r.cliente.es_empresa??false,observaciones:r.cliente.observaciones??'',createdAt:r.cliente.created_at}}));
}
export async function listarArchivosCRM(clienteId:string){const {data,error}=await supabase.from('crm_sound_documentos').select('*').eq('cliente_id',clienteId).order('created_at',{ascending:false});if(error)throw new Error('No se pudieron cargar los documentos.');return data as ArchivoCRM[];}
const MIME:Record<string,string>={pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',txt:'text/plain',csv:'text/csv',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
export async function subirArchivoCRM(clienteId:string,categoria:CategoriaCRM,file:File){
 const ext=file.name.split('.').pop()?.toLowerCase()??'';if(!MIME[ext]||file.size===0||file.size>20*1024*1024)throw new Error('Selecciona un PDF, imagen, documento, hoja de cálculo o texto de hasta 20 MB.');
 const id=crypto.randomUUID(),path=`${clienteId}/${id}/archivo.${ext}`;
 const storage=supabase.storage.from('crm-sound');
 const {error}=await storage.upload(path,file,{contentType:MIME[ext],upsert:false});if(error)throw new Error('No se pudo subir el archivo. Reintenta.');
 const saved=await supabase.from('crm_sound_documentos').insert({id,cliente_id:clienteId,categoria,nombre:file.name.slice(0,250),storage_path:path});
 if(saved.error){await storage.remove([path]);throw new Error('No se pudo guardar el documento en la carpeta. Reintenta.');}
}
export function descargarBlobCRM(blob:Blob,nombre:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=nombre;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
export async function descargarArchivoCRM(a:ArchivoCRM){const {data,error}=await supabase.storage.from('crm-sound').download(a.storage_path);if(error||!data)throw new Error('No se pudo descargar el documento.');descargarBlobCRM(data,a.nombre);}

export function clienteFacturaDrive(nombre:string):string {const match=nombre.match(/^Factura\s+\d+\s*[-–]\s*(.+)\.pdf$/i);return match?.[1].trim()??'';}
