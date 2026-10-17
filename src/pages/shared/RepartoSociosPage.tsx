import {LimitedList} from '../../components/kit/LimitedList';
import {PageHeader,YearStepper} from '../../components/kit';
import {useMemo,useState} from 'react';
import {Plus,Edit2,Trash2} from 'lucide-react';
import {useStore} from '../../store/useStore';
import {useAuthStore} from '../../store/useAuthStore';
import {useConfirmStore} from '../../store/useConfirmStore';
import {Modal} from '../../components/ui/Modal';
import {Button} from '../../components/ui/Button';
import {resolveLinea} from '../../config/resolveLinea';
import {uid} from '../../utils/helpers';
import type {MovimientoSocio,MovimientoSocioTipo} from '../../types';
const euro=(n:number)=>n.toLocaleString('es-ES',{style:'currency',currency:'EUR',useGrouping:'always'} as Intl.NumberFormatOptions);

const labels:Record<MovimientoSocioTipo,string>={aportacion_personal:'Aportación de capital',reintegro_aportacion:'Retirada de capital',beneficio_reinvertido:'Beneficio reinvertido',reparto_beneficio_cobrado:'Reparto de beneficio',adelanto_socio:'Adelanto del socio',devolucion_adelanto:'Devolución de adelanto',ajuste:'Ajuste histórico'};
export function RepartoSociosPage({linea='montada_sound'}:{linea?:'montada_sound'|'montada_installations'}){return <RepartoBody key={linea} linea={linea}/>;}
function RepartoBody({linea}:{linea:'montada_sound'|'montada_installations'}){
 const store=useStore();const auth=useAuthStore();const confirm=useConfirmStore(s=>s.show);
 const sound=linea==='montada_sound';const today=new Date();
 const [year,setYear]=useState(today.getFullYear());
 const [showHistory,setShowHistory]=useState(false);const [form,setForm]=useState<MovimientoSocio|null>(null);const [editing,setEditing]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const start=`${year}-01-01`,end=`${year}-12-31`,periodLabel='Anual';
 const inPeriod=(date:string)=>date>=start&&date<=end;
 const socios=useMemo(()=>store.socios.filter(s=>(s.lineaNegocio??'montada_sound')===linea),[store.socios,linea]);
 const ids=new Set(socios.map(s=>s.id));
 const movements=store.movimientosSocios.filter(m=>ids.has(m.socioId));
 const visible=movements.filter(m=>showHistory||inPeriod(m.fecha)).sort((a,b)=>b.fecha.localeCompare(a.fecha));
 const active=socios.filter(s=>s.activo!==false);
 const parents=new Map(store.ingresos.map(i=>[i.id,i]));
 const profit=store.ingresos.filter(i=>resolveLinea(i)===linea&&inPeriod(i.fechaEvento)).reduce((n,i)=>n+i.baseImponible,0)-store.gastos.filter(g=>resolveLinea(g)===linea&&inPeriod(g.fecha)).reduce((n,g)=>n+g.baseImponible,0)-store.gastosEvento.filter(g=>resolveLinea(parents.get(g.ingresoId)??g)===linea&&inPeriod(g.fecha)).reduce((n,g)=>n+g.importe,0);
 const distributed=movements.filter(m=>m.tipo==='reparto_beneficio_cobrado'&&inPeriod(m.fecha)).reduce((n,m)=>n+m.cantidad,0);
 const years=[...new Set([today.getFullYear(),year,...movements.map(m=>Number(m.fecha.slice(0,4))),...store.ingresos.map(i=>Number(i.fechaEvento.slice(0,4)))])].sort((a,b)=>b-a);
 const allowedTypes:MovimientoSocioTipo[]=sound?['reparto_beneficio_cobrado','aportacion_personal','reintegro_aportacion']:['reparto_beneficio_cobrado'];
 const newMovement=(socioId:string,tipo:MovimientoSocioTipo='reparto_beneficio_cobrado')=>{setError('');setEditing(false);setForm({id:uid(),socioId,tipo,fecha:inPeriod(today.toISOString().slice(0,10))?today.toISOString().slice(0,10):end,cantidad:0,concepto:tipo==='reparto_beneficio_cobrado'?`Reparto ${periodLabel} ${year}`:'',createdAt:new Date().toISOString()});};
 const save=async()=>{
  if(!form||busy)return;
  if(!ids.has(form.socioId)||!form.fecha||!Number.isFinite(form.cantidad)||form.cantidad<=0||!form.concepto.trim()){setError('Selecciona socio, fecha, concepto e importe mayor que cero.');return;}
  if(!(editing?auth.canEditLinea(linea):auth.canCreateLinea(linea))){setError('No tienes permiso para guardar.');return;}
  setBusy(true);setError('');try{const ok=editing?await store.updateMovimientoSocio(form.id,form):await store.addMovimientoSocio(form);if(ok)setForm(null);else setError('No se pudo guardar. Revisa el aviso y vuelve a intentarlo.');}catch{setError('No se pudo guardar el movimiento.');}finally{setBusy(false);}
 };
 return <div className="space-y-6">
 <PageHeader title="Reparto"><YearStepper year={year} years={years} onChange={setYear}/></PageHeader>
 <section className="widget hero-card p-6"><p className="text-sm opacity-75">Beneficio anual · {periodLabel} {year}</p><p className="text-4xl font-semibold mt-2">{euro(profit)}</p><div className="flex flex-wrap gap-6 mt-5 text-sm"><span>Repartido: <b>{euro(distributed)}</b></span><span>Pendiente de repartir: <b>{euro(profit-distributed)}</b></span></div></section>
 <p className="text-sm text-gray-500">El beneficio sirve de referencia: no se divide automáticamente. Registra cada reparto cuando se reciba; puedes editarlo después. La diferencia no equivale al saldo bancario.</p>
 {distributed>profit&&<p className="rounded-2xl bg-amber-50 text-amber-900 p-4 text-sm">El reparto supera el beneficio de este periodo. Puede corresponder a beneficios anteriores; indícalo en el concepto.</p>}
 <div className="grid md:grid-cols-3 gap-4">{active.map(s=>{
  const ms=movements.filter(m=>m.socioId===s.id);const paid=ms.filter(m=>m.tipo==='reparto_beneficio_cobrado'&&inPeriod(m.fecha)).reduce((n,m)=>n+m.cantidad,0);
  const capital=ms.filter(m=>m.fecha<=end);const contributed=capital.filter(m=>m.tipo==='aportacion_personal'||m.tipo==='adelanto_socio').reduce((n,m)=>n+m.cantidad,0);const withdrawn=capital.filter(m=>m.tipo==='reintegro_aportacion'||m.tipo==='devolucion_adelanto').reduce((n,m)=>n+m.cantidad,0);
  return <section key={s.id} className="widget p-5 space-y-4"><h2 className="font-semibold text-lg">{s.nombre}</h2><div><p className="text-xs text-gray-500">Retirado en repartos este año</p><p className="text-3xl font-semibold mt-1">{euro(paid)}</p></div>{sound&&<dl className="text-sm space-y-2 border-t pt-4"><div className="flex justify-between"><dt>Capital aportado</dt><dd>{euro(contributed)}</dd></div><div className="flex justify-between"><dt>Capital retirado</dt><dd>{euro(withdrawn)}</dd></div><div className="flex justify-between font-medium"><dt>Capital pendiente</dt><dd>{euro(contributed-withdrawn)}</dd></div><p className="text-xs text-gray-400">Acumulado hasta {end}.</p></dl>}{auth.canCreateLinea(linea)&&<div className="flex flex-wrap gap-2"><Button size="sm" onClick={()=>newMovement(s.id)} icon={<Plus size={14}/>}>Registrar reparto</Button>{sound&&<><Button size="sm" variant="secondary" onClick={()=>newMovement(s.id,'aportacion_personal')}>Aportar capital</Button><Button size="sm" variant="secondary" onClick={()=>newMovement(s.id,'reintegro_aportacion')}>Retirar capital</Button></>}</div>}</section>;
 })}</div>
 {active.length===0&&<p className="rounded-2xl bg-white p-5">No hay socios activos configurados para esta línea.</p>}
 <section className="widget p-5"><div className="flex justify-between flex-wrap gap-3 mb-4"><h2 className="font-semibold">Histórico</h2><label className="text-sm flex gap-2"><input type="checkbox" checked={showHistory} onChange={e=>setShowHistory(e.target.checked)}/>Todo el historial</label></div><div className="divide-y">{visible.length===0&&<p className="py-6 text-sm text-gray-500">Todavía no hay movimientos en este periodo.</p>}<LimitedList>{visible.map(m=><div key={m.id} className="list-row flex-wrap"><div><p className="font-medium">{socios.find(s=>s.id===m.socioId)?.nombre} · {labels[m.tipo]??m.tipo}</p><p className="text-sm text-gray-500">{m.fecha} · {m.concepto}</p>{m.observaciones&&<p className="text-sm text-gray-500">{m.observaciones}</p>}</div><div className="flex gap-3 items-center"><span className="font-semibold">{euro(m.cantidad)}</span>{auth.canEditLinea(linea)&&<button aria-label={`Editar ${m.concepto}`} className="p-2 rounded-xl hover:bg-accent-50" onClick={()=>{setEditing(true);setError('');setForm({...m});}}><Edit2 size={16}/></button>}{auth.canDeleteLinea(linea)&&<button aria-label={`Eliminar ${m.concepto}`} className="p-2 text-red-600 rounded-xl hover:bg-red-50" onClick={()=>confirm('¿Eliminar este movimiento de socio?',()=>store.deleteMovimientoSocio(m.id))}><Trash2 size={16}/></button>}</div></div>)}</LimitedList></div></section>
 <p className="text-xs text-gray-500">Aportaciones, retiradas y repartos no cambian los ingresos ni los gastos operativos. El resumen de Julia incluye solo sus repartos de beneficio, en el mes de la fecha indicada.</p>
 <Modal isOpen={!!form} onClose={()=>{if(!busy)setForm(null);}} title={editing?'Editar importe y movimiento':'Registrar movimiento'} size="sm">{form&&<div className="space-y-4"><label className="block text-sm">Socio<select className="input-form mt-1" value={form.socioId} onChange={e=>setForm({...form,socioId:e.target.value})}>{socios.map(s=><option key={s.id} value={s.id}>{s.nombre}{s.activo===false?' (archivado)':''}</option>)}</select></label><label className="block text-sm">Movimiento<select className="input-form mt-1" value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value as MovimientoSocioTipo})}>{[...new Set([...allowedTypes,...(editing?[form.tipo]:[])])].map(t=><option key={t} value={t}>{labels[t]}</option>)}</select></label><label className="block text-sm">Fecha del movimiento<input type="date" className="input-form mt-1" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})}/></label><label className="block text-sm">Importe (€)<input type="number" min="0.01" step="0.01" className="input-form mt-1" value={form.cantidad} onChange={e=>setForm({...form,cantidad:Number(e.target.value)})}/></label><label className="block text-sm">Concepto<input className="input-form mt-1" value={form.concepto} onChange={e=>setForm({...form,concepto:e.target.value})}/></label><label className="block text-sm">Notas<textarea className="input-form mt-1" value={form.observaciones??''} onChange={e=>setForm({...form,observaciones:e.target.value})}/></label>{error&&<p role="alert" className="text-sm text-red-600">{error}</p>}<Button disabled={busy} onClick={save}>{busy?'Guardando…':'Guardar movimiento'}</Button></div>}</Modal>
 </div>;
}
