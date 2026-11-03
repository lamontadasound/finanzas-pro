import {useState,type CSSProperties} from 'react';
import {Link} from 'react-router-dom';
import {useStore} from '../store/useStore';
import {useAuthStore} from '../store/useAuthStore';
import {BUSINESS_LINES,LINEA_IDS} from '../config/businessLines';
import {juliaSummary} from '../lib/juliaSummary';
import {SPACES} from '../components/shell/spaces';
import {motion} from 'framer-motion';
import {ArrowUpRight} from 'lucide-react';
import {PageHeader,YearStepper,Widget,Money} from '../components/kit';
import {GlowCard,StripedBars} from '../components/kit/dash';
const monthName=(m:number)=>new Date(2026,m,1).toLocaleDateString('es-ES',{month:'long'});
export function Dashboard(){
 const {ingresos,gastos,gastosEvento,socios,movimientosSocios}=useStore();
 const profile=useAuthStore(s=>s.profile),allowed=useAuthStore(s=>s.lineasVisibles());
 const [year,setYear]=useState(new Date().getFullYear()),[selectedMonth,setSelectedMonth]=useState(new Date().getMonth());
 const years=[...new Set([new Date().getFullYear(),year,...ingresos.map(i=>Number(i.fechaEvento.slice(0,4))),...gastos.map(g=>Number(g.fecha.slice(0,4))),...gastosEvento.map(g=>Number(g.fecha.slice(0,4))),...movimientosSocios.map(m=>Number(m.fecha.slice(0,4)))])].filter(Number.isFinite);
 const months=juliaSummary(year,ingresos,gastos,gastosEvento,socios,movimientosSocios),annual=months.reduce((n,m)=>n+m.total,0),selected=months[selectedMonth];
 const admin=profile?.rol==='admin';
 return <div><PageHeader title={admin?`Tu Resumen Julia: ${year}`:'Mis proyectos'}>{admin&&<YearStepper year={year} years={years} onChange={setYear}/>}</PageHeader>
 <div className="dash-wrap"><div className="dash">
 {admin&&<GlowCard className="d-6" delay={0.03} label="Resumen anual"><div className="flex flex-col h-full"><p className="text-[13px] opacity-70">Tu beneficio total · {year}</p><p className="hero-value premium-annual mt-3"><Money value={annual} cents/></p><div className="mt-auto pt-6 flex flex-wrap gap-5 text-[13.5px] font-medium"><Link to="/contabilidad/informes">Ver informes →</Link><Link to="/contabilidad/pagos">Gestionar pagos →</Link></div></div></GlowCard>}
 <div className={`${admin?'d-6':''} grid grid-cols-2 gap-3.5`}>{(admin?LINEA_IDS:allowed).map((line,idx)=>{const space=SPACES.find(s=>s.linea===line)!;const Icon=space.icon;return <motion.div key={line} className="min-w-0" initial={{opacity:0,y:14,filter:'blur(10px)'}} animate={{opacity:1,y:0,filter:'blur(0px)'}} whileHover={{y:-3}} transition={{type:'spring',bounce:0,duration:.6,delay:.06+idx*.03}}><Link className="line-card" to={BUSINESS_LINES[line].routeBase+'/resumen'} style={{'--tint-a':space.tint.from,'--tint-b':space.tint.to,'--tint-ink':space.tint.ink??'#fff'} as CSSProperties}><span className="line-card-icon"><Icon size={17}/></span><ArrowUpRight size={15} className="line-card-go"/><b className="block mt-3 text-[14.5px]">{BUSINESS_LINES[line].shortLabel}</b>{admin&&<p className="text-[11.5px] text-ink-3">{line==='dj'||line==='real_madrid'?'Beneficio':'Repartos de Julia'}</p>}{admin&&<p className="num text-[19px] font-semibold tracking-[-0.02em] mt-1"><Money value={months.reduce((n,m)=>n+(m.amounts[line]??0),0)}/></p>}</Link></motion.div>;})}</div>
 {admin&&<><Widget className="d-8" title="Mes a mes" delay={0.14}><StripedBars year={year} data={months.map(m=>({cobrado:Math.max(0,m.total),pendiente:0}))} labels={['Tu beneficio','']} selected={selectedMonth} onSelect={setSelectedMonth}/></Widget>
 <Widget className="d-4" delay={0.17} aria-label="Detalle del mes"><div role="tablist" aria-label="Mes" className="month-picker">{months.map(m=><button key={m.month} role="tab" aria-selected={m.month===selectedMonth} aria-label={monthName(m.month)} onClick={()=>setSelectedMonth(m.month)}>{monthName(m.month).slice(0,1).toUpperCase()}</button>)}</div><h2 className="widget-title capitalize mt-3">{monthName(selectedMonth)}</h2><p className="hero-value premium-month-total mt-2" style={{fontSize:32}}><Money value={selected.total} cents/></p><dl className="mt-3">{LINEA_IDS.map(line=><div key={line} className="activity-row justify-between text-[14px]"><dt className="text-ink-2">{BUSINESS_LINES[line].shortLabel}</dt><dd className="num font-semibold"><Money value={selected.amounts[line]??0} cents/></dd></div>)}</dl></Widget></>}
 </div></div>
 </div>;
}
