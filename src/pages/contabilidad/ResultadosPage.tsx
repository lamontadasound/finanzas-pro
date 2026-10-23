import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {PageHeader,Widget,Segmented,Money} from '../../components/kit';
import {supabase} from '../../lib/supabase';
import {useAuthStore} from '../../store/useAuthStore';
import {usePermittedFinancialData} from '../../hooks/usePermittedFinancialData';
import {driveAccounting,accountingTotals,type AccountingFile} from '../../lib/driveAccounting';
import type {DriveExpenseAmount} from '../../lib/driveExpenses';
import {soundResults} from '../../lib/resultados';
export function ResultadosPage({soundOnly=false}:{soundOnly?:boolean}){
 const {ingresos,gastos,gastosEvento,facturas,lineasVisibles}=usePermittedFinancialData();
 const user=useAuthStore(s=>s.user?.id);
 const [selectedSource,setSource]=useState('drive'),[view,setView]=useState('resultados'),[year,setYear]=useState(String(new Date().getFullYear()));
 const [drive,setDrive]=useState<{owner:string|undefined;files:AccountingFile[];expenses:DriveExpenseAmount[];incomes:DriveExpenseAmount[]}|null>(null),[error,setError]=useState('');
 useEffect(()=>{if(soundOnly)return;let active=true;Promise.all([supabase.from('drive_invoice_files').select('*'),supabase.from('drive_expense_amounts').select('*'),supabase.from('drive_income_amounts').select('*')]).then(([f,e,i])=>{if(!active)return;if(f.error||e.error||i.error){setError('No se pudieron cargar los importes de Drive.');return;}setError('');setDrive({owner:user,files:f.data??[],expenses:e.data??[],incomes:i.data??[]});}).catch(()=>{if(active)setError('No se pudieron cargar los importes de Drive.');});return()=>{active=false;};},[user,soundOnly]);
 const source=soundOnly?'sound':selectedSource;
 const files=drive?.owner===user?drive?.files??[]:[];
 const rows=driveAccounting(files,drive?.expenses??[],facturas,drive?.incomes??[]).filter(r=>year==='todos'||String(r.anio)===year);
 const sound=soundResults(ingresos,gastos,gastosEvento,year),totals=source==='drive'?accountingTotals(rows):sound;
 const years=[...new Set([new Date().getFullYear(),...files.map(f=>f.anio),...ingresos.map(i=>Number(i.fechaEvento?.slice(0,4))),...gastos.map(g=>Number(g.fecha.slice(0,4)))])].filter(Boolean).sort((a,b)=>b-a);
 const card=(label:string,value:number,tone?:string)=><Widget title={label}><div className={tone??''}><Money value={value}/></div></Widget>;
 return <div className="space-y-5"><PageHeader title="Resultados"><Link className="btn btn-secondary" to="/contabilidad/facturas">Ver facturas</Link></PageHeader>
 <div className="flex flex-wrap gap-3">{!soundOnly&&<Segmented id="results-source" value={source} onChange={setSource} options={[{value:'drive',label:'Facturas de Drive'},...(lineasVisibles.includes('montada_sound')?[{value:'sound',label:'La Montada'}]:[])]}/>} <select aria-label="Año" className="input-form max-w-40" value={year} onChange={e=>setYear(e.target.value)}><option value="todos">Todos los años</option>{years.map(y=><option key={y}>{y}</option>)}</select></div>
 <Segmented id="results-view" value={view} onChange={setView} options={[{value:'resultados',label:'Estado de resultados'},{value:'balance',label:'Balance'}]}/>
 {source==='drive'&&error?<p role="alert">{error}</p>:source==='drive'&&(!drive||drive.owner!==user)?<p role="status">Cargando importes…</p>:<>
 <p className="text-sm text-ink-3">{source==='drive'?'Solo documentos del archivo Drive; agrupados por el mes de su carpeta.':'Actividad de La Montada: ingresos, gastos por evento y gastos generales; según la fecha de cada registro.'}</p>
 {totals.pending>0&&<p role="alert" className="bg-amber-50 text-amber-900 rounded-xl p-4">{source==='drive'?`Resultado parcial: ${totals.pending} documentos pendientes de lectura. No se consideran importes cero.`:`${totals.pending} gastos de evento sin desglose de IVA. El resultado usa su coste registrado y requiere revisión.`}</p>}
 {view==='resultados'?<div className="grid sm:grid-cols-2 gap-4">{card('Ingresos sin IVA',totals.income,'text-emerald-700')}{card('Gastos sin IVA',totals.expenses,'text-red-700')}{card('Resultado antes de impuestos',totals.result,totals.result>=0?'text-emerald-700':'text-red-700')}{card('Saldo de IVA estimado',totals.vat)}</div>:<>
 <Widget title="Balance provisional"><p className="text-sm text-ink-3">Resumen documental, no un balance contable completo. Faltan bancos, caja, patrimonio, préstamos y saldos iniciales; no se suponen cero.</p></Widget>
 <div className="grid sm:grid-cols-2 gap-4">{card('Facturado / ingresos con IVA',totals.incomeTotal)}{card('Gastos con IVA',totals.expenseTotal)}{card('IVA repercutido',totals.outputVat)}{card('IVA soportado documentado',totals.inputVat)}{source==='sound'?<>{card('Pendiente de cobrar',sound.receivable)}{card('Pendiente de pagar',sound.payable)}</>:<Widget className="sm:col-span-2" title="Cobros y pagos"><p>Las facturas de Drive no acreditan por sí solas el cobro o pago. Saldos de clientes y proveedores sin determinar.</p></Widget>}</div>
 </>}
 </>}
 </div>;
}
