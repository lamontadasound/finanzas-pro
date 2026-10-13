import {useStore} from '../../../store/useStore';
import {resolveLinea} from '../../../config/resolveLinea';
import {Link} from 'react-router-dom';
const fmt=(n:number)=>n.toLocaleString('es-ES',{style:'currency',currency:'EUR',useGrouping:'always'} as Intl.NumberFormatOptions);
export const InstallationsResumen=()=>{
 const incomes=useStore(s=>s.ingresos).filter(i=>resolveLinea(i)==='montada_installations');
 const expenses=useStore(s=>s.gastos).filter(g=>resolveLinea(g)==='montada_installations');
 const costs=useStore(s=>s.gastosEvento).filter(g=>incomes.some(i=>i.id===g.ingresoId));
 const revenue=incomes.reduce((a,i)=>a+i.baseImponible,0);
 const spending=expenses.reduce((a,g)=>a+g.baseImponible,0)+costs.reduce((a,g)=>a+(g.baseImponible??g.importe),0);
 const pending=incomes.reduce((a,i)=>a+Math.max(0,i.total-i.pagosRecibidos),0);
 return <div className="space-y-6"><div><p className="text-sm text-gray-500">Installations · {incomes.length} proyectos</p><h1 className="text-2xl font-semibold tracking-tight">Tu actividad, de un vistazo</h1></div><section className="rounded-3xl bg-white border border-gray-100 p-7"><p className="text-sm text-gray-500">Beneficio operativo</p><p className="mt-3 text-4xl font-semibold tracking-tight tabular-nums">{fmt(revenue-spending)}</p><div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-8">{[['Ingresos sin IVA',revenue],['Costes sin IVA',spending],['Pendiente de cobrar',pending]].map(([label,value])=><div key={label}><p className="text-xs text-gray-500">{label}</p><p className="text-xl font-semibold mt-1">{fmt(Number(value))}</p></div>)}</div></section><Link to="/lineas/installations/ingresos" className="inline-flex rounded-full bg-accent-600 text-white px-5 py-3 text-sm">Ver proyectos</Link></div>;
};
