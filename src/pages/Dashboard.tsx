import {useState,type CSSProperties} from 'react';
import {Link} from 'react-router-dom';
import {useStore} from '../store/useStore';
import {useAuthStore} from '../store/useAuthStore';
import {BUSINESS_LINES,LINEA_IDS} from '../config/businessLines';
import {juliaSummary} from '../lib/juliaSummary';
import {SPACES} from '../components/shell/spaces';
import {PageHeader,YearStepper,Widget,Metric,Money,Segmented} from '../components/kit';
import {MonthlyBars} from '../components/kit/MonthlyBars';
const monthName=(m:number)=>new Date(2026,m,1).toLocaleDateString('es-ES',{month:'long'});
export function Dashboard(){
 const {ingresos,gastos,gastosEvento,socios,movimientosSocios}=useStore();
 const profile=useAuthStore(s=>s.profile),allowed=useAuthStore(s=>s.lineasVisibles());
 const [year,setYear]=useState(new Date().getFullYear()),[selectedMonth,setSelectedMonth]=useState(new Date().getMonth());
 const years=[...new Set([new Date().getFullYear(),year,...ingresos.map(i=>Number(i.fechaEvento.slice(0,4))),...gastos.map(g=>Number(g.fecha.slice(0,4))),...gastosEvento.map(g=>Number(g.fecha.slice(0,4))),...movimientosSocios.map(m=>Number(m.fecha.slice(0,4)))])].filter(Number.isFinite);
 const months=juliaSummary(year,ingresos,gastos,gastosEvento,socios,movimientosSocios),annual=months.reduce((n,m)=>n+m.total,0),selected=months[selectedMonth];
 const partnerTotal=months.reduce((n,m)=>n+(m.amounts.montada_sound??0)+(m.amounts.montada_installations??0),0),directTotal=annual-partnerTotal;
 const admin=profile?.rol==='admin';
 return <div><PageHeader title={admin?`Tu Resumen Julia: ${year}`:'Mis proyectos'}>{admin&&<YearStepper year={year} years={years} onChange={setYear}/>}</PageHeader>
 {admin&&<div className="bento mb-4"><Widget className="span-2 hero-card" aria-label="Resumen anual"><p>Tu total · {year}</p><p className="hero-value premium-annual mt-3"><Money value={annual} cents/></p><div className="flex flex-wrap gap-4 mt-5"><Link to="/contabilidad/informes">Ver informes →</Link><Link to="/contabilidad/pagos">Gestionar pagos →</Link></div></Widget><Metric label="DJ y Real Madrid" value={directTotal}/><Metric label="Sound e Instalaciones" value={partnerTotal}/></div>}
 <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">{(admin?LINEA_IDS:allowed).map(line=>{const space=SPACES.find(s=>s.linea===line)!;const Icon=space.icon;return <Link key={line} className="widget tile p-5" to={BUSINESS_LINES[line].routeBase+'/resumen'} style={{'--tint-a':space.tint.from,'--tint-b':space.tint.to,'--tint-ink':space.tint.ink??'#fff'} as CSSProperties}><Icon size={24} style={{color:'var(--tint-a)'}}/><b className="block mt-3">{BUSINESS_LINES[line].shortLabel}</b>{admin&&<p className="text-xl font-semibold mt-2"><Money value={months.reduce((n,m)=>n+(m.amounts[line]??0),0)}/></p>}</Link>;})}</div>
 {admin&&<><Widget title="Mes a mes" className="mb-4"><MonthlyBars year={year} data={months.map(m=>({total:m.total}))} series={[{key:'total',label:'Tu total',color:'var(--tint-a)'}]}/></Widget><Widget aria-label="Detalle del mes"><div className="mb-4"><Segmented id="summary-month" value={String(selectedMonth)} onChange={v=>setSelectedMonth(Number(v))} options={months.map(m=>({value:String(m.month),label:monthName(m.month)}))}/></div><h2 className="widget-title">{monthName(selectedMonth)}</h2><p className="hero-value premium-month-total"><Money value={selected.total} cents/></p><dl className="mt-4">{LINEA_IDS.map(line=><div key={line} className="list-row"><dt className="list-main">{BUSINESS_LINES[line].shortLabel}</dt><dd><Money value={selected.amounts[line]??0} cents/></dd></div>)}</dl></Widget></>}
 </div>;
}
