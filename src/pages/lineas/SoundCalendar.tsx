import {useMemo,useState} from 'react';
import {ChevronLeft,ChevronRight,CalendarDays} from 'lucide-react';
import {useStore} from '../../store/useStore';
import {PageHeader,Widget,Btn,Pill} from '../../components/kit';
import {Modal} from '../../components/ui/Modal';
import {localDate,monthDays,soundCalendarEvents,type CalendarEvent} from '../../lib/soundCalendar';
const longDate=(d:string)=>new Date(`${d}T12:00:00`).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const label=(s:string)=>s.replaceAll('_',' ');
export function SoundCalendar(){
 const incomes=useStore(s=>s.ingresos),events=useStore(s=>s.eventos);
 const all=useMemo(()=>soundCalendarEvents(incomes,events),[incomes,events]);
 const [selected,setSelected]=useState(()=>localDate(new Date()));
 const [month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1,12));
 const [detail,setDetail]=useState<CalendarEvent|null>(null);
 const monthKey=localDate(month).slice(0,7),monthly=all.filter(e=>e.date.startsWith(monthKey)),daily=all.filter(e=>e.date===selected);
 const groups=new Map<string,CalendarEvent[]>();for(const e of monthly)groups.set(e.date,[...(groups.get(e.date)??[]),e]);
 const move=(by:number)=>{const d=new Date(month.getFullYear(),month.getMonth()+by,1,12);setMonth(d);setSelected(localDate(d));};
 const today=()=>{const d=new Date();setMonth(new Date(d.getFullYear(),d.getMonth(),1,12));setSelected(localDate(d));};
 return <div className="space-y-5"><PageHeader title="Calendario"><Btn onClick={today}>Hoy</Btn></PageHeader>
  <Widget><div className="flex items-center justify-between gap-2 mb-5"><Btn aria-label="Mes anterior" onClick={()=>move(-1)}><ChevronLeft size={18}/></Btn><h2 className="font-semibold capitalize text-center" aria-live="polite">{month.toLocaleDateString('es-ES',{month:'long',year:'numeric'})}</h2><Btn aria-label="Mes siguiente" onClick={()=>move(1)}><ChevronRight size={18}/></Btn></div>
  <p className="text-sm text-ink-3 mb-4">{monthly.length} eventos</p>
  <div className="grid grid-cols-7 gap-1" aria-label="Días del mes">{['L','M','X','J','V','S','D'].map(d=><span key={d} className="text-center text-xs text-ink-3 pb-2" aria-hidden>{d}</span>)}{monthDays(month.getFullYear(),month.getMonth()).map(d=>{const rows=groups.get(d.date)??[];return <button key={d.date} disabled={!d.inMonth} aria-label={`${longDate(d.date)} · ${rows.length} eventos`} aria-pressed={selected===d.date} onClick={()=>setSelected(d.date)} className={`min-w-0 min-h-14 sm:min-h-24 rounded-xl p-1 sm:p-2 text-center transition-colors ${selected===d.date?'bg-[var(--tint-a)] text-[var(--tint-ink)]':'hover:bg-black/5'} ${!d.inMonth?'opacity-25':''}`}><span className="font-semibold text-sm">{d.day}</span>{rows.length>0&&<><span className="block text-[10px] sm:hidden">{rows.length} ev.</span><span className="hidden sm:block text-[11px] truncate">{rows[0].title||rows[0].client}</span>{rows.length>1&&<span className="hidden sm:block text-[10px]">+{rows.length-1}</span>}</>}</button>;})}</div></Widget>
  <Widget title={longDate(selected)} pad><div className="divide-y">{daily.length?daily.map(e=><button key={e.id} onClick={()=>setDetail(e)} className="list-row w-full text-left !px-0"><CalendarDays size={20} className="shrink-0 text-[var(--tint-a)]"/><span className="list-main"><b>{e.title||e.client}</b><small>{e.client} · {label(e.type)}</small></span><ChevronRight size={18}/></button>):<p className="text-sm text-ink-3 py-4">No hay eventos este día.</p>}</div></Widget>
  <Modal isOpen={!!detail} onClose={()=>setDetail(null)} title={detail?.title||'Evento'}>{detail&&<div className="space-y-4"><p className="capitalize">{longDate(detail.date)}</p><h3 className="font-semibold">{detail.client}</h3><div className="flex flex-wrap gap-2"><Pill>{label(detail.type)}</Pill><Pill>{label(detail.status)}</Pill></div><p className="text-2xl font-semibold">{detail.total.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}</p>{detail.notes&&<p className="whitespace-pre-wrap break-words">{detail.notes}</p>}</div>}</Modal>
 </div>;
}
