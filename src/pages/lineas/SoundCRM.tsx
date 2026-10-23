import {LimitedList} from '../../components/kit/LimitedList';
import {fechaEventoCliente,ordenEventoCliente,fechaEventoCorta} from '../../lib/clientEventDate';
import {ClientAvatar} from '../../components/studio/SoundCRMTable';
import {useEffect,useState} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {Plus,FileText,Download,Users,Pencil,Trash2,ChevronRight,Phone,Mail,Upload,Info,Signature,ReceiptText} from 'lucide-react';
import {motion} from 'framer-motion';
import {PageHeader,Btn,Widget,Pill,Chips} from '../../components/kit';
import {ClientesSwitch} from '../../components/kit/ClientesSwitch';
import {useStore} from '../../store/useStore';
import {useAuthStore} from '../../store/useAuthStore';
import {supabase} from '../../lib/supabase';
import {lineaDeFactura,lineaDeIngreso} from '../../lib/contabilidad';
import {listarPresupuestos} from '../../lib/presupuestosDb';
import {referenciaPresupuesto,type Presupuesto} from '../../lib/presupuestos';
import {prepararArchivoPresupuesto,descargarArchivoPresupuesto} from '../../lib/presupuestoArchivo';
import {generarFacturaPdf} from '../../lib/facturaPdf';
import {obtenerUrlFirmada} from '../../lib/storage';
import {leerArchivoLocal} from '../../lib/localFileStore';
import {CATEGORIAS,SERVICIOS_CRM,cargarCRM,listarArchivosCRM,subirArchivoCRM,descargarArchivoCRM,descargarBlobCRM,clienteCoincide,clienteFacturaDrive,type FichaCRM,type CategoriaCRM,type ArchivoCRM} from '../../lib/crmSound';
import {Modal} from '../../components/ui/Modal';
import {Button2} from '../../components/ui2/Button';
const BASE='/lineas/montada-sound';
export function SoundCRM({vista='clientes'}:{vista?:'crm'|'clientes'}){
 const {clienteId}=useParams();const navigate=useNavigate();
 const canCreate=useAuthStore(s=>s.canCreateLinea('montada_sound')),canEdit=useAuthStore(s=>s.canEditLinea('montada_sound'));
 const canDelete=useAuthStore(s=>s.canDeleteLinea('montada_sound'));
 const [deleting,setDeleting]=useState<FichaCRM|null>(null);
 const allClients=useStore(s=>s.clientes),facturas=useStore(s=>s.facturas),ingresos=useStore(s=>s.ingresos),documentos=useStore(s=>s.documentos);
 const [fichas,setFichas]=useState<FichaCRM[]>([]),[quotes,setQuotes]=useState<Presupuesto[]>([]),[archivos,setArchivos]=useState<ArchivoCRM[]>([]);
 const [leads,setLeads]=useState<{nombre:string;fecha_evento?:string|null}[]>([]);
 const [drive,setDrive]=useState<{id:string;nombre:string;url:string}[]>([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false),[reload,setReload]=useState(0);
 const [newOpen,setNewOpen]=useState(false),[name,setName]=useState('');
 const [serviceFilter,setServiceFilter]=useState('');
 const [yearFilter,setYearFilter]=useState<number|'todos'>('todos');
 const [categoria,setCategoria]=useState<CategoriaCRM>('informacion'),[edit,setEdit]=useState<FichaCRM|null>(null);
 useEffect(()=>{let active=true;Promise.all([cargarCRM(),listarPresupuestos('montada_sound'),supabase.from('drive_invoice_files').select('id,nombre,url').eq('tipo','emitida'),supabase.from('sound_leads').select('nombre,fecha_evento').eq('eliminado',false)]).then(([c,p,d,l])=>{if(active){setFichas(c);setQuotes(p);setDrive(d.data??[]);setLeads(l.data??[]);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[reload]);
 useEffect(()=>{let active=true;if(clienteId)listarArchivosCRM(clienteId).then(d=>{if(active)setArchivos(d);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[clienteId,reload]);
 const selected=fichas.find(c=>c.cliente_id===clienteId);
 const run=async(action:()=>Promise<void>)=>{setBusy(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:'No se pudo completar la acción.');}finally{setBusy(false);}};
 const refresh=()=>{setLoading(true);setReload(n=>n+1);};
 const create=()=>run(async()=>{const {data,error:e}=await supabase.rpc('crear_carpeta_sound',{p_nombre:name.trim()});if(e)throw new Error(e.message);setNewOpen(false);setName('');refresh();navigate(`${BASE}/clientes/${data}`);});
 const save=()=>run(async()=>{if(!edit||!edit.cliente.nombre.trim())return;const {error:e}=await supabase.rpc('guardar_carpeta_sound',{p_id:edit.cliente_id,p_datos:{...edit.cliente,origen:edit.origen,contacto_nombre:edit.contacto_nombre,tipo_servicio:edit.tipo_servicio,motivo_perdida:edit.motivo_perdida,fecha_cierre:edit.fecha_cierre,fecha_evento:edit.fecha_evento||null,ubicacion_evento:edit.ubicacion_evento||null},p_etapa:edit.etapa,p_accion:edit.proxima_accion,p_fecha:edit.fecha_seguimiento||null,p_notas:edit.notas});if(e)throw new Error(e.message);useStore.setState(s=>({clientes:s.clientes.some(c=>c.id===edit.cliente.id)?s.clientes.map(c=>c.id===edit.cliente.id?edit.cliente:c):[...s.clientes,edit.cliente]}));setEdit(null);refresh();});
 const remove=()=>run(async()=>{if(!deleting)return;const {error:e}=await supabase.rpc('borrar_cliente_sound',{p_id:deleting.cliente_id});if(e)throw new Error(e.message);setFichas(rows=>rows.filter(c=>c.cliente_id!==deleting.cliente_id));setDeleting(null);if(clienteId)navigate(`${BASE}/${vista}`);});
 const actions=(c:FichaCRM)=><div className="flex gap-2 flex-wrap">{canEdit&&<Button2 disabled={busy} aria-label={`Editar ${c.cliente.nombre}`} icon={<Pencil size={14}/>} onClick={()=>{setError('');setEdit({...c,cliente:{...c.cliente}});}}>Editar</Button2>}{canDelete&&<Button2 variant="danger" disabled={busy} aria-label={`Borrar ${c.cliente.nombre}`} icon={<Trash2 size={14}/>} onClick={()=>{setError('');setDeleting(c);}}>Borrar</Button2>}</div>;
 const match=(nombre:string)=>!!selected&&clienteCoincide(nombre,selected.cliente,[...allClients.filter(c=>!fichas.some(f=>f.cliente_id===c.id)),...fichas.map(f=>f.cliente)]);
 const relatedQuotes=quotes.filter(p=>match(p.contenido.cliente));
 const relatedInvoices=facturas.filter(f=>lineaDeFactura(f)==='montada_sound'&&(f.clienteSnapshot?.id===selected?.cliente_id||match(f.cliente)));
 const incomeIds=new Set(ingresos.filter(i=>lineaDeIngreso(i)==='montada_sound'&&match(i.cliente)).map(i=>i.id));
 const relatedDocs=documentos.filter(d=>(d.entityType==='ingreso'&&incomeIds.has(d.entityId))||(d.entityType==='factura'&&relatedInvoices.some(f=>f.id===d.entityId)));
 const downloadRow=(label:string,onClick:()=>void)=><button disabled={busy} onClick={onClick} className="doc-row"><span className="flex gap-3 items-center min-w-0"><FileText size={18} className="text-[var(--blue)] shrink-0"/><span className="truncate">{label}</span></span><Download size={16} className="shrink-0 text-ink-3"/></button>;
 const today=new Date().toLocaleDateString('en-CA');
 const clientPool=[...allClients.filter(c=>!fichas.some(f=>f.cliente_id===c.id)),...fichas.map(f=>f.cliente)];
 const dates=new Map(fichas.map(c=>[c.cliente_id,c.fecha_evento||fechaEventoCliente(c.cliente,clientPool,ingresos,leads,today)]));
 const yearOf=(c:FichaCRM)=>Number((dates.get(c.cliente_id)||c.cliente.createdAt||'').slice(0,4))||new Date().getFullYear();
 const years=[...new Set(fichas.map(yearOf))].sort((x,y)=>y-x);
 const inYear=fichas.filter(c=>yearFilter==='todos'||yearOf(c)===yearFilter);
 const shown=inYear.filter(c=>!serviceFilter||c.tipo_servicio===serviceFilter).sort((x,y)=>ordenEventoCliente(dates.get(x.cliente_id),dates.get(y.cliente_id),today)||x.cliente.nombre.localeCompare(y.cliente.nombre,'es'));
 const docCount=(k:CategoriaCRM)=>archivos.filter(a=>a.cliente_id===clienteId&&a.categoria===k).length+relatedDocs.filter(d=>(d.tipo==='contrato'?'contrato':d.tipo==='presupuesto'?'presupuesto':d.tipo==='factura'?'factura':'informacion')===k).length+(k==='presupuesto'?relatedQuotes.length:0)+(k==='factura'?relatedInvoices.length:0);
 const FOLDER_ICON={informacion:Info,contrato:Signature,presupuesto:FileText,factura:ReceiptText} as const;
 return <div className="studio-crm">
 <PageHeader title={selected?.cliente.nombre||'Clientes'}>
  {!clienteId&&<ClientesSwitch/>}
  {!clienteId&&canCreate&&<Btn variant="primary" onClick={()=>setNewOpen(true)}><Plus size={16} strokeWidth={2.4}/>Nuevo cliente</Btn>}
  {selected&&actions(selected)}
 </PageHeader>
 {clienteId&&<nav className="crumbs"><button onClick={()=>navigate(`${BASE}/clientes`)}>Clientes</button><ChevronRight size={14}/><b>{selected?SERVICIOS_CRM[selected.tipo_servicio]:''}</b></nav>}
 {error&&<p role="alert" className="banner banner-danger mb-4">{error}</p>}
 {loading?<p role="status" className="text-ink-3">Cargando clientes…</p>:clienteId&&!selected?<p>Cliente no disponible con tus permisos.</p>:selected?<>
  <div className="bento mb-4">
   <Widget className="span-2 flex items-center gap-4">
    <span className="scale-125 origin-left mr-2"><ClientAvatar name={selected.cliente.nombre}/></span>
    <div className="min-w-0 flex-1">
     <p className="text-[13px] text-ink-3">{SERVICIOS_CRM[selected.tipo_servicio]}{selected.contacto_nombre&&` · ${selected.contacto_nombre}`}</p>
     <p className="text-[19px] font-semibold tracking-[-0.02em] truncate">{selected.cliente.nombre}</p>
    </div>
   </Widget>
   <Widget className="span-2">
    <dl className="contact-grid">
     <div><dt>Teléfono</dt><dd>{selected.cliente.telefono?<a href={`tel:${selected.cliente.telefono.replace(/[^+\d]/g,'')}`}><Phone size={14}/>{selected.cliente.telefono}</a>:'—'}</dd></div>
     <div><dt>Email</dt><dd>{selected.cliente.email?<a href={`mailto:${selected.cliente.email}`}><Mail size={14}/>{selected.cliente.email}</a>:'—'}</dd></div>
     <div><dt>Fecha del evento</dt><dd>{fechaEventoCorta(dates.get(selected.cliente_id))}</dd></div>
     <div><dt>Ubicación del evento</dt><dd>{selected.ubicacion_evento||'Sin ubicación'}</dd></div>
     <div><dt>Dirección</dt><dd>{selected.cliente.direccion||'—'}</dd></div>
     <div><dt>NIF/CIF</dt><dd className="num">{selected.cliente.nifCif||'—'}</dd></div>
    </dl>
   </Widget>
  </div>
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">{(Object.entries(CATEGORIAS) as [CategoriaCRM,string][]).map(([key,label])=>{const Icon=FOLDER_ICON[key];return <button key={key} aria-pressed={categoria===key} onClick={()=>setCategoria(key)} className="widget tile p-4 text-left flex items-center gap-3" data-current={categoria===key}>
   <span className="cat-glyph" style={{background:'color-mix(in srgb, var(--tint-a) 16%, #fff)',color:'var(--tint-a)'}}><Icon size={18}/></span>
   <span className="min-w-0"><b className="block text-[14.5px] font-semibold truncate">{label}</b><small className="text-[12.5px] text-ink-3">{docCount(key)} {docCount(key)===1?'documento':'documentos'}</small></span>
  </button>;})}</div>
  <section className="widget p-5 sm:p-6 space-y-2.5"><div className="flex justify-between gap-3 flex-wrap items-center mb-2"><h2 className="widget-title">{CATEGORIAS[categoria]}</h2>{canCreate&&<label className={`btn btn-secondary cursor-pointer ${busy?'opacity-50':''}`}><Upload size={15}/>Añadir documento<input disabled={busy} type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.txt,.csv,.doc,.docx,.xls,.xlsx" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void run(async()=>{await subirArchivoCRM(selected.cliente_id,categoria,file);refresh();});}}/></label>}</div>
 {categoria==='informacion'&&(selected.notas||selected.cliente.observaciones)&&<div className="rounded-2xl bg-[var(--widget-2)] p-4 text-[14px] space-y-2 whitespace-pre-wrap">{selected.cliente.observaciones&&<p>{selected.cliente.observaciones}</p>}{selected.notas&&<p>{selected.notas}</p>}</div>}
 {archivos.filter(a=>a.cliente_id===clienteId&&a.categoria===categoria).map(a=><div key={a.id}>{downloadRow(a.nombre,()=>void run(()=>descargarArchivoCRM(a)))}</div>)}
 {relatedDocs.filter(d=>(d.tipo==='contrato'?'contrato':d.tipo==='presupuesto'?'presupuesto':d.tipo==='factura'?'factura':'informacion')===categoria).map(d=><div key={d.id}>{downloadRow(d.nombre,()=>void run(async()=>{if(d.storageKey.startsWith('local-indexeddb/')){const f=await leerArchivoLocal(d.id);if(!f)throw new Error('Este archivo está en el navegador donde se guardó. Vuelve a adjuntarlo.');descargarBlobCRM(f.blob,d.nombre);}else{const url=await obtenerUrlFirmada(d.storageKey);const response=await fetch(url);if(!response.ok)throw new Error('No se pudo descargar el archivo.');descargarBlobCRM(await response.blob(),d.nombre);}}))}</div>)}
 {categoria==='presupuesto'&&relatedQuotes.map(p=><div key={p.id}>{downloadRow(`${referenciaPresupuesto(p)} · ${p.contenido.titulo}`,()=>void run(async()=>{const {blob}=await prepararArchivoPresupuesto(p,false);descargarArchivoPresupuesto(blob,p);}))}</div>)}
 {categoria==='factura'&&relatedInvoices.map(f=><div key={f.id}>{f.numeroSecuencial&&f.emisorSnapshot&&f.clienteSnapshot?downloadRow(`Factura ${f.numero} · ${f.concepto}`,()=>void run(async()=>{descargarBlobCRM(generarFacturaPdf({factura:f,configuracionFiscal:f.emisorSnapshot!,cliente:{...f.clienteSnapshot!,nombre:f.clienteSnapshot?.nombre??f.cliente}}).output('blob'),`Factura ${f.numero}.pdf`);})): <p className="doc-row">{f.numero||'Borrador'} · {f.concepto} · {f.estado??'Sin emitir'}</p>}</div>)}
 {categoria==='factura'&&drive.filter(d=>match(clienteFacturaDrive(d.nombre))).map(d=><a key={d.id} href={d.url} target="_blank" rel="noopener noreferrer" className="doc-row"><span className="flex gap-3 items-center min-w-0"><FileText size={18} className="text-[#1f9d55] shrink-0"/><span className="truncate">{d.nombre}</span></span><Pill tone="positive">Drive</Pill></a>)}
 {docCount(categoria)===0&&categoria!=='informacion'&&<p className="text-[14px] text-ink-3 py-2">Sin documentos todavía.</p>}
 </section></>:<>
  <div className="flex flex-wrap items-center gap-3 mb-4">
   <Chips label="Año" value={yearFilter} onChange={v=>setYearFilter(v)} options={[{value:'todos' as const,label:'Todos'},...years.map(y=>({value:y,label:String(y)}))]}/>
  </div>
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">{[['','Todos'],...Object.entries(SERVICIOS_CRM)].map(([key,label])=>{const n=inYear.filter(c=>!key||c.tipo_servicio===key).length;if(key&&!n)return null;return <button key={key||'all'} onClick={()=>setServiceFilter(key)} className="widget tile p-4 text-left" data-current={serviceFilter===key}>
   <p className="text-[13px] text-ink-3">{label}</p><p className="num text-[24px] font-semibold tracking-[-0.03em] mt-1">{n}</p>
  </button>;})}</div>
  {!shown.length?<div className="widget p-8 text-center"><Users className="mx-auto mb-3 text-ink-4"/><p className="text-ink-3">Sin clientes en esta selección.</p></div>:
  <div className="widget" style={{padding:0}}><LimitedList>{shown.map((c,i)=><motion.div key={c.cliente_id} className="list-row" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{type:'spring',bounce:0,duration:.45,delay:Math.min(i,14)*.02}}>
   <Link to={`${BASE}/clientes/${encodeURIComponent(c.cliente_id)}`} className="flex items-center gap-3 flex-1 min-w-0"><ClientAvatar name={c.cliente.nombre}/><span className="list-main"><b>{c.cliente.nombre}</b><small>{[SERVICIOS_CRM[c.tipo_servicio],fechaEventoCorta(dates.get(c.cliente_id))].join(' · ')}</small></span></Link>
   <span className="flex items-center gap-1">{canEdit&&<button className="icon-btn" disabled={busy} aria-label={`Editar ${c.cliente.nombre}`} onClick={()=>{setError('');setEdit({...c,cliente:{...c.cliente}});}}><Pencil size={15}/></button>}{canDelete&&<button className="icon-btn text-[#d70015]" disabled={busy} aria-label={`Borrar ${c.cliente.nombre}`} onClick={()=>{setError('');setDeleting(c);}}><Trash2 size={15}/></button>}<ChevronRight size={18} className="text-ink-4"/></span>
  </motion.div>)}</LimitedList></div>}
 </>}

 <Modal isOpen={!!deleting} onClose={()=>!busy&&setDeleting(null)} title="Borrar cliente" size="md">{deleting&&<div className="space-y-4"><p>¿Borrar a <strong>{deleting.cliente.nombre}</strong> de Clientes? Su contacto del CRM no se modificará.</p><p className="text-sm text-gray-500">Se conservarán sus facturas, presupuestos y documentos vinculados en el historial.</p><div className="flex gap-3"><Button2 disabled={busy} onClick={()=>setDeleting(null)}>Cancelar</Button2><Button2 variant="danger" loading={busy} onClick={remove}>Confirmar borrado</Button2></div>{error&&<p role="alert" className="text-red-700">{error}</p>}</div>}</Modal>
 <Modal isOpen={newOpen} onClose={()=>!busy&&setNewOpen(false)} title="Nuevo cliente" size="md"><label className="block text-sm">Nombre o razón social<input className="input-form" value={name} onChange={e=>setName(e.target.value)} maxLength={200}/></label><Button2 disabled={busy||!name.trim()} onClick={create}>Crear cliente</Button2>{error&&<p role="alert">{error}</p>}</Modal>
 <Modal isOpen={!!edit} onClose={()=>!busy&&setEdit(null)} title="Ficha del cliente" size="lg">{edit&&<div className="space-y-4"><div className="grid sm:grid-cols-2 gap-4">{(['nombre','nifCif','email','telefono','direccion'] as const).map(key=><label key={key} className="text-sm">{{nombre:'Nombre',nifCif:'NIF/CIF',email:'Email',telefono:'Teléfono',direccion:'Dirección'}[key]}<input className="input-form" value={edit.cliente[key]??''} onChange={e=>setEdit({...edit,cliente:{...edit.cliente,[key]:e.target.value}})}/></label>)}<label className="text-sm">Fecha del evento<input type="date" className="input-form" value={edit.fecha_evento??''} onChange={e=>setEdit({...edit,fecha_evento:e.target.value})}/></label><label className="text-sm">Ubicación del evento<input className="input-form" value={edit.ubicacion_evento??''} maxLength={500} onChange={e=>setEdit({...edit,ubicacion_evento:e.target.value})}/></label><label className="text-sm">Persona de contacto<input className="input-form" value={edit.contacto_nombre} onChange={e=>setEdit({...edit,contacto_nombre:e.target.value})}/></label><label className="text-sm">Tipo de servicio<select className="input-form" value={edit.tipo_servicio} onChange={e=>setEdit({...edit,tipo_servicio:e.target.value as FichaCRM['tipo_servicio']})}>{Object.entries(SERVICIOS_CRM).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label></div><label className="block text-sm">Información, listados y notas<textarea rows={5} className="input-form" value={edit.notas} onChange={e=>setEdit({...edit,notas:e.target.value})}/></label><Button2 disabled={busy||!edit.cliente.nombre.trim()} onClick={save}>Guardar cambios</Button2>{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}</div>}</Modal>
 </div>;
}
