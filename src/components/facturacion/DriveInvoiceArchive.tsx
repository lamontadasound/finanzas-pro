import {LimitedList} from '../kit/LimitedList';
import {Pill} from '../kit';
import {useEffect,useState} from 'react';
import {DriveExpenseSummary} from './DriveExpenseSummary';
import {Folder,ArrowLeft,ExternalLink,RefreshCw,FileText} from 'lucide-react';
import {supabase} from '../../lib/supabase';
import {useAuthStore} from '../../store/useAuthStore';
type FileRow={id:string;nombre:string;tipo:string;anio:number;mes:number;numero:number|null;url:string;sincronizado_en:string};
type FolderRow={id:string;nombre:string;tipo:string;anio:number;mes:number};
const MONTHS=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
export function DriveInvoiceArchive({tipo}:{tipo:'emitida'|'recibida'}){
 return tipo==='recibida'?<DriveExpenseSummary archive/>:<IncomeDriveArchive tipo={tipo}/>;
}
function IncomeDriveArchive({tipo}:{tipo:'emitida'|'recibida'}){
 const [files,setFiles]=useState<FileRow[]>([]),[folders,setFolders]=useState<FolderRow[]>([]);
 const [period,setPeriod]=useState<string|null>(null),[query,setQuery]=useState('');
 const [error,setError]=useState(''),[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false);
 const admin=useAuthStore(s=>s.isAdmin());
 useEffect(()=>{let active=true;Promise.all([supabase.from('drive_invoice_files').select('*').eq('tipo',tipo).order('numero',{ascending:false,nullsFirst:false}),supabase.from('drive_invoice_folders').select('*').eq('tipo',tipo).order('mes',{ascending:false})]).then(([a,b])=>{if(!active)return;if(a.error||b.error)setError('No se pudo cargar el archivo de Drive.');else{setFiles(a.data??[]);setFolders(b.data??[]);}setLoading(false);}).catch(()=>{if(active){setError("No se pudo cargar el archivo de Drive.");setLoading(false);}});return()=>{active=false;};},[tipo]);
 const refresh=async()=>{setRefreshing(true);setError('');try{
  const {data,error:err}=await supabase.functions.invoke('drive-invoice-archive');
  if(err||!data?.ok){let message=data?.error;if(err&&'context' in err&&err.context instanceof Response){message=(await err.context.json().catch(()=>null))?.error??message;}throw new Error(message||'No se pudo actualizar Drive. Se conserva el último archivo importado.');}
  await (await import('../../lib/readDriveExpenseDocuments')).readDriveExpenseDocuments(()=>{},'emitida');
  const [a,b]=await Promise.all([supabase.from('drive_invoice_files').select('*').eq('tipo',tipo),supabase.from('drive_invoice_folders').select('*').eq('tipo',tipo)]);
  if(a.error||b.error)throw new Error('Archivo actualizado; recarga la página para verlo.');setFiles(a.data??[]);setFolders(b.data??[]);
 }catch(e){setError(e instanceof Error?e.message:'No se pudo actualizar Drive.');}finally{setRefreshing(false);}};
 const selected=files.filter(f=>(!period||`${f.anio}-${f.mes}`===period)&&f.nombre.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es'))).sort((a,b)=>(b.numero??0)-(a.numero??0)||a.nombre.localeCompare(b.nombre,'es'));
 const groups=[...new Set(folders.map(f=>`${f.anio}-${f.mes}`))].sort((a,b)=>{const [ay,am]=a.split('-').map(Number),[by,bm]=b.split('-').map(Number);return by-ay||bm-am;});
 return <section className="space-y-4" aria-label="Archivo de facturas de Drive">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-gray-900">Archivo de Google Drive</h2></div>{admin&&<button onClick={refresh} disabled={refreshing} className="inline-flex items-center gap-2 border rounded-xl px-3 py-2 text-sm disabled:opacity-50"><RefreshCw size={14} className={refreshing?'animate-spin':''}/>{refreshing?'Actualizando…':'Actualizar desde Drive'}</button>}</div>
  {error&&<p role="alert" className="bg-amber-50 text-amber-900 p-3 rounded-xl text-sm">{error}</p>}
  <input aria-label="Buscar archivo en Drive" placeholder="Buscar factura o cliente…" value={query} onChange={e=>setQuery(e.target.value)} className="input-form w-full"/>
  {period&&<button onClick={()=>setPeriod(null)} className="flex items-center gap-2 text-sm"><ArrowLeft size={15}/>Todos los meses</button>}
  {loading?<p role="status">Cargando archivo…</p>:!period&&!query?<div className="grid grid-cols-2 lg:grid-cols-3 gap-3">{groups.map(key=>{const [year,month]=key.split('-').map(Number);return <button key={key} onClick={()=>setPeriod(key)} className="widget tile p-5 text-left"><Folder className="text-[var(--tint-a)] mb-3" size={25}/><strong className="block">{MONTHS[month-1]} {year}</strong><span className="text-sm text-gray-500">{files.filter(f=>f.anio===year&&f.mes===month).length} documentos</span></button>;})}</div>:<div className="widget overflow-hidden"><div className="divide-y"><LimitedList key={period??query}>{selected.map(f=><div key={f.id}><a href={f.url} target="_blank" rel="noreferrer" className="list-row"><FileText size={19} className="shrink-0 text-[var(--tint-a)]"/><span className="min-w-0 flex-1 break-words"><span className="block text-sm font-medium">{f.nombre}</span><span className="text-xs text-gray-500">{MONTHS[f.mes-1]} {f.anio}</span></span><Pill tone="positive">Drive</Pill><ExternalLink size={15} className="shrink-0"/><span className="sr-only">Abrir en Drive</span></a></div>)}</LimitedList></div>{!selected.length&&<p className="p-6 text-sm text-gray-500">No hay documentos en esta selección.</p>}</div>}
  {!loading&&!folders.length&&<p className="text-sm text-gray-500">No hay documentos disponibles para tus permisos.</p>}
 </section>;
}
