import {Plus} from 'lucide-react';
import {motion} from 'framer-motion';
import {PageHeader,YearStepper,Btn,Metric,Widget,Pill,Segmented,FormGroup,Field,Chips} from '../../components/kit';
import {ClientesSwitch} from '../../components/kit/ClientesSwitch';
import {fmtShort} from '../../utils/helpers';
import {defaultYear} from '../../components/kit/utils';
import {useEffect,useState} from 'react';
import {supabase} from '../../lib/supabase';
import {useAuthStore} from '../../store/useAuthStore';
import {Button2} from '../../components/ui2/Button';
import {Modal} from '../../components/ui/Modal';
import {ClientAvatar} from '../../components/studio/SoundCRMTable';
import {ORIGENES_CRM,SERVICIOS_CRM,SERVICIOS_OFRECIDOS} from '../../lib/crmSound';
import {responseDays,conversionPorCanal,type Lead} from '../../lib/soundLeads';
const empty=():Lead=>({id:crypto.randomUUID(),nombre:'',email:'',telefono:'',contacto:'',nif:'',direccion:'',canal:'',servicio:'otro',estado:'pendiente',motivo:'',notas:'',fecha:new Date().toISOString().slice(0,10),cierre:null});
export function SoundProspects(){
 const create=useAuthStore(s=>s.canCreateLinea('montada_sound')),edit=useAuthStore(s=>s.canEditLinea('montada_sound')),remove=useAuthStore(s=>s.canDeleteLinea('montada_sound'));
 const [rows,setRows]=useState<Lead[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [form,setForm]=useState<Lead|null>(null),[newRow,setNewRow]=useState(false),[deleting,setDeleting]=useState<Lead|null>(null);
 const [hasServicios,setHasServicios]=useState(false);
 useEffect(()=>{let active=true;void supabase.from('sound_leads').select('servicios_ofrecidos').limit(1).then(({error:e})=>{if(active)setHasServicios(!e);});return()=>{active=false;};},[]);
 const [folder,setFolder]=useState('todos'),[year,setYear]=useState(new Date().getFullYear());
 useEffect(()=>{let active=true;void supabase.from('sound_leads').select('*').eq('eliminado',false).order('fecha',{ascending:false}).then(({data,error:e})=>{if(active){if(e)setError(e.message);else{setRows(data??[]);setYear(defaultYear([...new Set((data??[]).map((r:Lead)=>Number(r.fecha.slice(0,4))).filter(Boolean))]));}setLoading(false);}});return()=>{active=false;};},[]);
 const save=async()=>{if(!form)return;setBusy(true);setError('');try{if(!form.nombre.trim()||!form.fecha||!form.canal.trim())throw Error('Completa nombre, canal y fecha de entrada.');if(form.estado==='no_convertido'&&!form.motivo.trim())throw Error('Indica el motivo de no conversión.');if(form.primer_contacto&&form.primer_contacto<form.fecha)throw Error('El primer contacto no puede ser anterior a la solicitud.');if(form.ultimo_contacto&&form.primer_contacto&&form.ultimo_contacto<form.primer_contacto)throw Error('El último contacto no puede ser anterior al primero.');const {servicios_ofrecidos,...base}=form;const payload={...base,...(hasServicios?{servicios_ofrecidos:servicios_ofrecidos??[]}:{}),nombre:form.nombre.trim(),canal:form.canal.trim(),cierre:form.estado==='pendiente'?null:form.cierre||new Date().toISOString().slice(0,10)};const result=newRow?await supabase.from('sound_leads').insert(payload).select().single():await supabase.from('sound_leads').update(payload).eq('id',form.id).select().single();if(result.error)throw result.error;setRows(old=>newRow?[result.data,...old]:old.map(r=>r.id===form.id?result.data:r));setForm(null);}catch(e){setError(e instanceof Error?e.message:'No se pudo guardar');}finally{setBusy(false);}};
 const deleteRow=async()=>{if(!deleting)return;setBusy(true);setError('');const {error:e,data}=await supabase.from('sound_leads').delete().eq('id',deleting.id).select('id');if(e||!data?.length)setError(e?.message||'No se pudo borrar con tus permisos.');else{setRows(old=>old.filter(r=>r.id!==deleting.id));setDeleting(null);}setBusy(false);};
 const years=[...new Set(rows.map(r=>Number(r.fecha.slice(0,4))).filter(Boolean))];
 const yearScope=rows.filter(r=>!year||r.fecha.startsWith(String(year)));
 const list=yearScope.filter(r=>folder==='todos'||r.estado===folder).sort((a,b)=>b.fecha.localeCompare(a.fecha));
 const replies=yearScope.map(responseDays).filter((n):n is number=>n!==null);
 const ganados=yearScope.filter(r=>r.estado==='convertido');
 const canales=conversionPorCanal(yearScope);
 const maxCanal=Math.max(1,...canales.map(c=>c.total));
 const contar=(xs:string[])=>[...xs.reduce((m,x)=>m.set(x,(m.get(x)??0)+1),new Map<string,number>()).entries()].sort((a,b)=>b[1]-a[1]);
 const pedidos=hasServicios&&yearScope.some(r=>(r.servicios_ofrecidos??[]).length)?contar(yearScope.flatMap(r=>r.servicios_ofrecidos??[])).slice(0,7):contar(yearScope.map(r=>SERVICIOS_CRM[r.servicio as keyof typeof SERVICIOS_CRM]??r.servicio)).slice(0,7);
 const maxPedido=Math.max(1,...pedidos.map(([,n])=>n));
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

   <Widget className="span-2" title="Lo que más piden" delay={0.14}>
    {pedidos.length===0?<p className="text-ink-3 text-[14px]">Sin contactos este año.</p>:<div className="space-y-3.5">{pedidos.map(([nombre,n])=><div key={nombre}>
     <div className="flex justify-between text-[14px] mb-1.5"><span className="font-medium">{nombre}</span><b className="num">{n}</b></div>
     <div className="h-2.5 rounded-full bg-black/[.05] overflow-hidden"><motion.span className="block h-full rounded-full" style={{background:'var(--tint-a)'}} initial={{width:0}} animate={{width:`${100*n/maxPedido}%`}} transition={{type:'spring',bounce:0,duration:.8}}/></div>
    </div>)}</div>}
    {!hasServicios&&<p className="text-[12.5px] text-ink-3 mt-4">Por tipo de evento. Cuando se active el campo Servicio, se verá también qué servicios piden.</p>}
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
 <Modal isOpen={!!form} onClose={()=>!busy&&setForm(null)} title={newRow?'Nuevo contacto CRM':'Ficha CRM'} size="lg">{form&&<form onSubmit={e=>{e.preventDefault();void save();}}>
 <fieldset disabled={busy||(!newRow&&!edit)}>
 <FormGroup title="Contacto">
  <Field label="Nombre" wide><input required className="input-form" value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})}/></Field>
  <Field label="Persona de contacto"><input className="input-form" value={form.contacto} onChange={e=>setForm({...form,contacto:e.target.value})}/></Field>
  <Field label="Teléfono"><input type="tel" className="input-form" value={form.telefono} onChange={e=>setForm({...form,telefono:e.target.value})}/></Field>
  <Field label="Email"><input type="email" className="input-form" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></Field>
  <Field label="NIF/CIF"><input className="input-form" value={form.nif} onChange={e=>setForm({...form,nif:e.target.value})}/></Field>
  <Field label="Canal de entrada"><input required list="lead-canals" className="input-form" value={form.canal} onChange={e=>setForm({...form,canal:e.target.value})}/></Field>
  <Field label="Fecha de entrada"><input required type="date" className="input-form" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})}/></Field>
  <datalist id="lead-canals">{ORIGENES_CRM.map(c=><option key={c} value={c}/>)}</datalist>
 </FormGroup>
 <FormGroup title="Evento">
  <div className="field field-wide"><span className="field-label">Tipo de evento</span>
   <Chips label="Tipo de evento" value={form.servicio} onChange={v=>setForm({...form,servicio:v})} options={Object.entries(SERVICIOS_CRM).filter(([k])=>k!=='sin_clasificar'||form.servicio==='sin_clasificar').map(([k,v])=>({value:k,label:v}))}/></div>
  {hasServicios&&<div className="field field-wide"><span className="field-label">Servicio</span>
   <div className="chips">{SERVICIOS_OFRECIDOS.map(sv=>{const on=(form.servicios_ofrecidos??[]).includes(sv);return <button key={sv} type="button" role="checkbox" aria-checked={on} className="chip" onClick={()=>setForm({...form,servicios_ofrecidos:on?(form.servicios_ofrecidos??[]).filter(x=>x!==sv):[...(form.servicios_ofrecidos??[]),sv]})}>{sv}</button>;})}</div></div>}
  <Field label="Fecha del evento"><input type="date" className="input-form" value={form.fecha_evento??''} onChange={e=>setForm({...form,fecha_evento:e.target.value||null})}/></Field>
  <span className="hidden sm:block"/>
  <Field label="Primer contacto"><input type="date" className="input-form" value={form.primer_contacto??''} onChange={e=>setForm({...form,primer_contacto:e.target.value||null})}/></Field>
  <Field label="Último contacto"><input type="date" className="input-form" value={form.ultimo_contacto??''} onChange={e=>setForm({...form,ultimo_contacto:e.target.value||null})}/></Field>
 </FormGroup>
 <FormGroup title="Resultado">
  <div className="field field-wide"><Chips label="Resultado" value={form.estado} onChange={v=>setForm({...form,estado:v as Lead['estado'],cierre:v==='pendiente'?null:form.cierre||new Date().toISOString().slice(0,10)})} options={[{value:'pendiente',label:'Pendiente'},{value:'convertido',label:'Convertido'},{value:'no_convertido',label:'No convertido'}]}/></div>
  {form.estado==='convertido'&&<>
   <Field label="Importe de la reserva (€)"><input type="number" inputMode="decimal" min="0" step="0.01" className="input-form num" value={form.reserva_importe??''} onChange={e=>setForm({...form,reserva_importe:e.target.value===''?null:Number(e.target.value)})}/></Field>
   <Field label="Precio acordado (€)"><input type="number" inputMode="decimal" min="0" step="0.01" className="input-form num" value={form.precio_acordado??''} onChange={e=>setForm({...form,precio_acordado:e.target.value===''?null:Number(e.target.value)})}/></Field>
  </>}
  {form.estado==='no_convertido'&&<Field label="Motivo" wide><textarea required className="input-form" rows={2} value={form.motivo} onChange={e=>setForm({...form,motivo:e.target.value})}/></Field>}
  <Field label="Comentarios" wide><textarea className="input-form" rows={3} value={form.notas} onChange={e=>setForm({...form,notas:e.target.value})}/></Field>
 </FormGroup>
 </fieldset>
 <div className="sheet-actions">{!newRow&&remove&&<Btn type="button" variant="danger" size="lg" disabled={busy} onClick={()=>{const r=form;setForm(null);setDeleting(r);}}>Borrar</Btn>}{(newRow?create:edit)&&<Btn type="submit" variant="primary" size="lg" disabled={busy}>Guardar contacto</Btn>}</div>
</form>}</Modal>
 <Modal isOpen={!!deleting} onClose={()=>!busy&&setDeleting(null)} title="Borrar contacto CRM"><p>¿Borrar a {deleting?.nombre}? Su ficha independiente en Clientes no se modifica.</p><div className="flex gap-2 mt-4"><Button2 disabled={busy} onClick={()=>setDeleting(null)}>Cancelar</Button2><Button2 disabled={busy} variant="danger" onClick={deleteRow}>Confirmar borrado</Button2></div>{error&&<p role="alert">{error}</p>}</Modal>
 </div>;
}
