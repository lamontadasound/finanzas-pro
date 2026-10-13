import {LeadControls} from '../../components/studio/LeadFollowup';
import {Plus} from 'lucide-react';
import {motion} from 'framer-motion';
import {PageHeader,YearStepper,Btn,Metric,Widget,Pill,Segmented} from '../../components/kit';
import {ClientesSwitch} from '../../components/kit/ClientesSwitch';
import {fmtShort} from '../../utils/helpers';
import {defaultYear} from '../../components/kit/utils';
import {useEffect,useState} from 'react';
import {supabase} from '../../lib/supabase';
import {useAuthStore} from '../../store/useAuthStore';
import {Button2} from '../../components/ui2/Button';
import {Modal} from '../../components/ui/Modal';
import {ClientAvatar} from '../../components/studio/SoundCRMTable';
import {ORIGENES_CRM,SERVICIOS_CRM} from '../../lib/crmSound';
import {leadFollowup,responseDays,conversionPorCanal,type Lead} from '../../lib/soundLeads';
const statuses={pendiente:'Pendientes',convertido:'Convertidos',no_convertido:'No convertidos'} as const;
const empty=():Lead=>({id:crypto.randomUUID(),nombre:'',email:'',telefono:'',contacto:'',nif:'',direccion:'',canal:'',servicio:'otro',estado:'pendiente',motivo:'',notas:'',fecha:new Date().toISOString().slice(0,10),cierre:null});
export function SoundProspects(){
 const create=useAuthStore(s=>s.canCreateLinea('montada_sound')),edit=useAuthStore(s=>s.canEditLinea('montada_sound')),remove=useAuthStore(s=>s.canDeleteLinea('montada_sound'));
 const [rows,setRows]=useState<Lead[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [form,setForm]=useState<Lead|null>(null),[newRow,setNewRow]=useState(false),[deleting,setDeleting]=useState<Lead|null>(null);
 const [folder,setFolder]=useState('todos'),[year,setYear]=useState(new Date().getFullYear());
 useEffect(()=>{let active=true;void supabase.from('sound_leads').select('*').eq('eliminado',false).order('fecha',{ascending:false}).then(({data,error:e})=>{if(active){if(e)setError(e.message);else{setRows(data??[]);setYear(defaultYear([...new Set((data??[]).map((r:Lead)=>Number(r.fecha.slice(0,4))).filter(Boolean))]));}setLoading(false);}});return()=>{active=false;};},[]);
 const save=async()=>{if(!form)return;setBusy(true);setError('');try{if(!form.nombre.trim()||!form.fecha||!form.canal.trim())throw Error('Completa nombre, canal y fecha de entrada.');if(form.estado!=='pendiente'&&!form.cierre)throw Error('Indica la fecha de cierre.');if(form.estado==='no_convertido'&&!form.motivo.trim())throw Error('Indica el motivo de no conversión.');if(form.primer_contacto&&form.primer_contacto<form.fecha)throw Error('El primer contacto no puede ser anterior a la solicitud.');if(form.ultimo_contacto&&form.primer_contacto&&form.ultimo_contacto<form.primer_contacto)throw Error('El último contacto no puede ser anterior al primero.');const payload={...form,nombre:form.nombre.trim(),canal:form.canal.trim()};const result=newRow?await supabase.from('sound_leads').insert(payload).select().single():await supabase.from('sound_leads').update(payload).eq('id',form.id).select().single();if(result.error)throw result.error;setRows(old=>newRow?[result.data,...old]:old.map(r=>r.id===form.id?result.data:r));setForm(null);}catch(e){setError(e instanceof Error?e.message:'No se pudo guardar');}finally{setBusy(false);}};
 const deleteRow=async()=>{if(!deleting)return;setBusy(true);setError('');const {error:e,data}=await supabase.from('sound_leads').delete().eq('id',deleting.id).select('id');if(e||!data?.length)setError(e?.message||'No se pudo borrar con tus permisos.');else{setRows(old=>old.filter(r=>r.id!==deleting.id));setDeleting(null);}setBusy(false);};
 const years=[...new Set(rows.map(r=>Number(r.fecha.slice(0,4))).filter(Boolean))];
 const yearScope=rows.filter(r=>!year||r.fecha.startsWith(String(year)));
 const list=yearScope.filter(r=>folder==='todos'||r.estado===folder).sort((a,b)=>b.fecha.localeCompare(a.fecha));
 const replies=yearScope.map(responseDays).filter((n):n is number=>n!==null);
 const ganados=yearScope.filter(r=>r.estado==='convertido');
 const canales=conversionPorCanal(yearScope);
 const maxCanal=Math.max(1,...canales.map(c=>c.total));
 const seguimiento=yearScope.filter(r=>r.estado==='pendiente'&&r.siguiente_contacto).sort((a,b)=>(a.siguiente_contacto??'').localeCompare(b.siguiente_contacto??'')).slice(0,5);
 const open=(r:Lead)=>{setNewRow(false);setForm({...r});setError('');};
 return <div>
  <PageHeader title="Clientes">
   <ClientesSwitch/>
   {years.length>0&&<YearStepper year={year} years={years} onChange={setYear}/>}
   {create&&<Btn variant="primary" onClick={()=>{setNewRow(true);setForm(empty());setError('');}}><Plus size={16} strokeWidth={2.4}/>Nuevo contacto</Btn>}
  </PageHeader>
  {error&&<div role="alert" className="banner banner-danger mb-4">{error}</div>}
  {loading?<p role="status" className="text-ink-3">Cargando…</p>:<div className="bento">
   <Metric label="Captados" value={yearScope.length} kind="count"/>
   <Metric label="Convertidos" value={ganados.length} kind="count" delay={0.03} tone="positive" foot={<>{yearScope.length?Math.round(100*ganados.length/yearScope.length):0}% de conversión</>}/>
   <Metric label="Respuesta media" value={replies.length?Math.round(10*replies.reduce((x,y)=>x+y,0)/replies.length)/10:0} kind="count" delay={0.06} foot="días hasta el primer contacto"/>
   <Metric label="Facturación ganada" value={ganados.reduce((x,r)=>x+Number(r.precio_acordado??0),0)} delay={0.09}/>

   <Widget className="span-2" title="Canales de entrada" delay={0.12}>
    {canales.length===0?<p className="text-ink-3 text-[14px]">Sin contactos este año.</p>:<div className="space-y-3.5">{canales.map(c=><div key={c.canal}>
     <div className="flex justify-between text-[14px] mb-1.5"><span className="font-medium">{c.canal}</span><span className="text-ink-3"><b className="text-ink num">{c.total}</b> · {c.tasa.toFixed(0)}% convierten</span></div>
     <div className="h-2.5 rounded-full bg-black/[.05] overflow-hidden flex"><motion.span className="h-full" style={{background:'var(--tint-a)'}} initial={{width:0}} animate={{width:`${100*c.convertidos/maxCanal}%`}} transition={{type:'spring',bounce:0,duration:.8}}/><motion.span className="h-full" style={{background:'color-mix(in srgb, var(--tint-b) 35%, #fff)'}} initial={{width:0}} animate={{width:`${100*(c.total-c.convertidos)/maxCanal}%`}} transition={{type:'spring',bounce:0,duration:.8,delay:.05}}/></div>
    </div>)}</div>}
   </Widget>

   <Widget className="span-2" title="Próximos seguimientos" delay={0.14}>
    {seguimiento.length===0?<p className="text-ink-3 text-[14px]">Nada programado.</p>:<div className="-mx-2">{seguimiento.map(r=>{const st=leadFollowup(r);return <button key={r.id} onClick={()=>open(r)} className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-black/[.03] text-left">
     <ClientAvatar name={r.nombre}/><span className="flex-1 min-w-0"><b className="block text-[14.5px] truncate">{r.nombre}</b><small className="text-[12.5px] text-ink-3">{r.canal} · {r.siguiente_contacto}</small></span>
     <Pill tone={st==='Retrasado'?'negative':st==='Hoy'?'info':'neutral'}>{st}</Pill>
    </button>;})}</div>}
   </Widget>

   <div className="span-full mt-2 flex items-center justify-between gap-3 flex-wrap">
    <Segmented id="crm-estado" value={folder} onChange={setFolder} options={[['todos','Todos'],['pendiente','Pendientes'],['convertido','Convertidos'],['no_convertido','No convertidos']].map(([v,l])=>({value:v,label:<>{l} <span className="text-ink-3 num">{yearScope.filter(r=>v==='todos'||r.estado===v).length}</span></>}))}/>
   </div>
   <div className="span-full widget" style={{padding:0}}>
    {list.length===0?<p className="p-6 text-ink-3">No hay contactos aquí.</p>:list.map((r,i)=>{const st=r.estado==='convertido'?'positive':r.estado==='no_convertido'?'negative':'warning';const days=responseDays(r);return <motion.button key={r.id} onClick={()=>open(r)} className="list-row"
     initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{type:'spring',bounce:0,duration:.45,delay:Math.min(i,12)*.02}}>
     <ClientAvatar name={r.nombre}/>
     <span className="list-main"><b>{r.nombre}</b><small>{[r.canal||'Sin canal',SERVICIOS_CRM[r.servicio as keyof typeof SERVICIOS_CRM]||r.servicio,r.fecha_evento&&`evento ${r.fecha_evento}`].filter(Boolean).join(' · ')}</small></span>
     <span className="hidden sm:flex flex-col items-end text-[12.5px] text-ink-3 mr-2"><span>Entró {r.fecha}</span>{days!=null&&<span>Respuesta {days} d</span>}</span>
     {r.precio_acordado!=null&&<span className="list-amount num hidden sm:flex">{fmtShort(Number(r.precio_acordado))}</span>}
     <Pill tone={st}>{({pendiente:'Pendiente',convertido:'Convertido',no_convertido:'No convertido'} as const)[r.estado]}</Pill>
    </motion.button>;})}
   </div>
  </div>}
 <Modal isOpen={!!form} onClose={()=>!busy&&setForm(null)} title={newRow?'Nuevo contacto CRM':'Ficha CRM'} size="lg">{form&&<form onSubmit={e=>{e.preventDefault();void save();}} className="space-y-4"><fieldset disabled={busy||(!newRow&&!edit)} className="grid sm:grid-cols-2 gap-3">{(['nombre','contacto','email','telefono','nif','direccion','canal','fecha'] as const).map(k=><label key={k} className="text-sm">{{nombre:'Nombre',contacto:'Persona de contacto',email:'Email',telefono:'Teléfono',nif:'NIF/CIF',direccion:'Dirección',canal:'Canal de entrada',fecha:'Fecha de entrada'}[k]}<input required={['nombre','canal','fecha'].includes(k)} type={k==='fecha'?'date':'text'} list={k==='canal'?'lead-canals':undefined} className="input-form" value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}<datalist id="lead-canals">{ORIGENES_CRM.map(c=><option key={c} value={c}/>)}</datalist><label className="text-sm">Servicio<select className="input-form" value={form.servicio} onChange={e=>setForm({...form,servicio:e.target.value})}>{Object.entries(SERVICIOS_CRM).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label className="text-sm">Resultado<select className="input-form" value={form.estado} onChange={e=>setForm({...form,estado:e.target.value as Lead['estado'],cierre:e.target.value==='pendiente'?null:form.cierre||new Date().toISOString().slice(0,10)})}>{Object.entries(statuses).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>{form.estado!=='pendiente'&&<label className="text-sm">Fecha de cierre<input required type="date" className="input-form" value={form.cierre??''} onChange={e=>setForm({...form,cierre:e.target.value})}/></label>}{form.estado==='no_convertido'&&<label className="text-sm">Motivo de no conversión<textarea required className="input-form" value={form.motivo} onChange={e=>setForm({...form,motivo:e.target.value})}/></label>}<LeadControls value={form} onChange={setForm}/><label className="text-sm sm:col-span-2">Comentarios y necesidades<textarea className="input-form" rows={4} value={form.notas} onChange={e=>setForm({...form,notas:e.target.value})}/></label></fieldset><div className="flex gap-2 flex-wrap">{(newRow?create:edit)&&<Button2 type="submit" disabled={busy}>Guardar contacto</Button2>}{!newRow&&remove&&<Button2 type="button" variant="danger" disabled={busy} onClick={()=>{const r=form;setForm(null);setDeleting(r);}}>Borrar contacto</Button2>}</div>{error&&<p role="alert" className="text-red-700">{error}</p>}</form>}</Modal>
 <Modal isOpen={!!deleting} onClose={()=>!busy&&setDeleting(null)} title="Borrar contacto CRM"><p>¿Borrar a {deleting?.nombre}? Su ficha independiente en Clientes no se modifica.</p><div className="flex gap-2 mt-4"><Button2 disabled={busy} onClick={()=>setDeleting(null)}>Cancelar</Button2><Button2 disabled={busy} variant="danger" onClick={deleteRow}>Confirmar borrado</Button2></div>{error&&<p role="alert">{error}</p>}</Modal>
 </div>;
}
