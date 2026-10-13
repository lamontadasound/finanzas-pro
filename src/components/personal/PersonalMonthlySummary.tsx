import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { supabase } from '../../lib/supabase';
const lines = [{id:'dj',name:'DJ · 100% para ti'}, {id:'montada_sound',name:'La Montada Sound'}, {id:'real_madrid',name:'Real Madrid'}, {id:'montada_installations',name:'Installations'}];
type Amounts = Record<string,{assigned:string;received:string}>;
const empty = ():Amounts => Object.fromEntries(lines.map(l=>[l.id,{assigned:'',received:''}]));
const euros=(n:number)=>n.toLocaleString('es-ES',{style:'currency',currency:'EUR',useGrouping:'always'} as Intl.NumberFormatOptions);
export function PersonalMonthlySummary(){
 const profile=useAuthStore(s=>s.profile);
 if(profile?.rol!=='admin')return null;
 return <MonthlyEditor key={profile.id} userId={profile.id}/>;
}
function MonthlyEditor({userId}:{userId:string}){
 const [month,setMonth]=useState(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;});
 const [values,setValues]=useState<Amounts>(empty);
 const [loading,setLoading]=useState(userId!=='fx-admin'),[saving,setSaving]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 const [loadFailed,setLoadFailed]=useState(false);
 const preview=userId==='fx-admin';
 useEffect(()=>{let current=true;
 if(preview)return;
 supabase.from('personal_monthly_income').select('line_id,assigned,received').eq('user_id',userId).eq('month',month+'-01').then(({data,error:err})=>{if(!current)return;setLoading(false);if(err){setLoadFailed(true);setError('No se pudo cargar el mes. Cambia de mes para reintentar.');return;}const next=empty();for(const row of data??[])if(next[row.line_id])next[row.line_id]={assigned:String(row.assigned),received:String(row.received)};setValues(next);});
 return()=>{current=false;};},[month,userId,preview]);
 const assigned=Object.values(values).reduce((s,v)=>s+(Number(v.assigned)||0),0);
 const received=Object.values(values).reduce((s,v)=>s+(Number(v.received)||0),0);
 const save=async()=>{if(saving||loading||loadFailed||preview)return;const rows=lines.map(l=>({user_id:userId,month:month+'-01',line_id:l.id,assigned:Number(values[l.id].assigned),received:Number(values[l.id].received)}));if(rows.some(r=>!Number.isFinite(r.assigned)||!Number.isFinite(r.received)||r.assigned<0||r.received<0)){setError('Introduce importes válidos, iguales o mayores que cero.');return;}setSaving(true);setError('');try{const {error:err}=await supabase.from('personal_monthly_income').upsert(rows,{onConflict:'user_id,month,line_id'});if(err)throw err;setSaved(true);}catch{setError('No se han guardado los cambios. Puedes volver a intentarlo.');}finally{setSaving(false);}};
 return <section className="rounded-3xl bg-white border border-gray-100 p-5 sm:p-7 space-y-5">
 <div className="flex flex-wrap gap-4 items-center justify-between"><div><h2 className="text-xl font-semibold">Mi resumen mensual</h2><p className="text-sm text-gray-500">Tu parte personal, separada del resultado de la empresa.</p></div><input aria-label="Mes del resumen personal" type="month" value={month} disabled={saving} onChange={e=>{if(e.target.value){setMonth(e.target.value);setLoading(!preview);setLoadFailed(false);setError('');setSaved(false);setValues(empty());}}} className="rounded-xl border p-2"/></div>
 <div className="grid grid-cols-2 gap-4"><div><p className="text-sm text-gray-500">Me corresponde</p><p className="text-2xl font-semibold">{loading?'…':euros(assigned)}</p></div><div><p className="text-sm text-gray-500">Me he llevado este mes</p><p className="text-2xl font-semibold text-accent-600">{loading?'…':euros(received)}</p></div></div>
 <p className="text-sm text-gray-500">Introduce tu importe de DJ y tu reparto de cada proyecto. En «Cobrado» anota lo que realmente has recibido durante el mes, aunque corresponda a trabajos anteriores. No incluye reinversión ni dinero de otros socios.</p>
 <div className="space-y-3">{lines.map(l=><div key={l.id} className="grid grid-cols-2 sm:grid-cols-3 items-center gap-3 rounded-2xl bg-gray-50 p-3"><span className="col-span-2 sm:col-span-1 font-medium text-sm">{l.name}</span>{(['assigned','received'] as const).map(field=><label className="text-sm text-gray-500" key={field}>{field==='assigned'?'Me corresponde (€)':'Cobrado (€)'}<input aria-label={`${l.name}: ${field==='assigned'?'me corresponde':'cobrado'}`} type="number" min="0" step="0.01" placeholder="Sin indicar" disabled={loading||saving} value={values[l.id][field]} onChange={e=>{setSaved(false);setValues({...values,[l.id]:{...values[l.id],[field]:e.target.value}});}} className="block w-full rounded-xl border border-gray-200 bg-white p-2 text-gray-900 mt-1"/></label>)}</div>)}</div>
 {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}{saved&&<p role="status" className="text-sm text-accent-700">Mes guardado.</p>}
 <button disabled={loading||saving||loadFailed||preview} onClick={save} className="rounded-full bg-accent-600 text-white px-5 py-2 disabled:opacity-50">{preview?'Vista previa · no guarda':saving?'Guardando…':'Guardar mi resumen'}</button>
 <p className="text-xs text-gray-400">Registro personal manual. No modifica ingresos, gastos, facturas ni movimientos de socios. Los meses sin registrar no tienen importes confirmados.</p>
 </section>;
}
