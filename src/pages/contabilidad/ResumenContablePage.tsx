import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Receipt, TrendingUp, TrendingDown, Scale } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { usePermittedFinancialData } from '../../hooks/usePermittedFinancialData';
import { StatCard2 } from '../../components/ui2/StatCard';
import { driveAccounting, accountingTotals, type AccountingFile } from '../../lib/driveAccounting';
import type { DriveExpenseAmount } from '../../lib/driveExpenses';
const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
export const ResumenContablePage = () => {
  const { facturas } = usePermittedFinancialData();
  const owner = useAuthStore(s => s.profile?.id);
  const [data, setData] = useState<{owner: string | undefined; files: AccountingFile[]; amounts: DriveExpenseAmount[]; incomeAmounts: DriveExpenseAmount[]} | null>(null);
  const [error, setError] = useState('');
  const admin=useAuthStore(s=>s.isAdmin());
  const [reading,setReading]=useState('');
  const [refreshing,setRefreshing]=useState(false);
  const busy=useRef(false);
  const generation=useRef(0);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [quarter, setQuarter] = useState('todos');
  const [month, setMonth] = useState('todos');
  const load=useCallback(async(current:number)=>{
    const [f,a,i]=await Promise.all([supabase.from('drive_invoice_files').select('*'),supabase.from('drive_expense_amounts').select('*'),supabase.from('drive_income_amounts').select('*')]);
    if(f.error||a.error||i.error)throw new Error('No se pudo cargar el archivo de facturas.');
    if(current===generation.current)setData({owner,files:f.data??[],amounts:a.data??[],incomeAmounts:i.data??[]});
  },[owner]);
  const refresh=useCallback(async(updateArchive=true)=>{
    if(!admin||busy.current)return;
    busy.current=true;const current=generation.current;setRefreshing(true);setError('');
    try{
      if(updateArchive){
        const {data,error:err}=await supabase.functions.invoke('drive-invoice-archive');
        if(err||!data?.ok){let message=data?.error;if(err&&'context' in err&&err.context instanceof Response)message=(await err.context.json().catch(()=>null))?.error??message;throw new Error(message||'No se pudo actualizar Drive.');}
      }
      try{await (await import('../../lib/readDriveExpenseDocuments')).readDriveExpenseDocuments(message=>{if(current===generation.current)setReading(message);},'emitida');}finally{await load(current);}
    }catch(e){if(current===generation.current)setError(e instanceof Error?e.message:'No se pudieron leer los ingresos.');}
    finally{busy.current=false;if(current===generation.current){setRefreshing(false);setReading('');}}
  },[admin,load]);
  useEffect(()=>{
    const current=++generation.current;setData(null);setError('');
    void load(current).then(()=>{if(current===generation.current)void refresh(false);}).catch(()=>{if(current===generation.current)setError('No se pudo cargar el archivo de facturas.');});
    return()=>{generation.current++;};
  },[load,refresh]);
  const files = data?.owner === owner ? data?.files ?? [] : [];
  const rows = useMemo(() => driveAccounting(files, data?.amounts ?? [], facturas, data?.incomeAmounts ?? []), [files, data, facturas]);
  const selected = rows.filter(r => (year === 'todos' || r.anio === Number(year)) && (quarter === 'todos' || Math.ceil(r.mes/3) === Number(quarter)) && (month === 'todos' || r.mes === Number(month)));
  const totals = accountingTotals(selected);
  const incomeKnown = !selected.some(r => r.tipo === 'emitida' && r.estado === 'pendiente') || selected.some(r => r.tipo === 'emitida' && r.estado === 'leido');
  const expensesKnown = !selected.some(r => r.tipo === 'recibida' && r.estado === 'pendiente') || selected.some(r => r.tipo === 'recibida' && r.estado === 'leido');
  const incomeFormat = incomeKnown ? fmt : () => 'Pendiente';
  const expenseFormat = expensesKnown ? fmt : () => 'Pendiente';
  const resultFormat = incomeKnown && expensesKnown ? fmt : () => 'Pendiente';
  const years = [...new Set([new Date().getFullYear(), ...files.map(f => f.anio)])].sort((a,b) => b-a);
  const last = files.reduce((s,f) => f.sincronizado_en > s ? f.sincronizado_en : s, '');
  return <div className="space-y-6">
    <div className="flex flex-wrap justify-between gap-3"><h1 className="text-2xl font-bold">Resumen contable</h1><Link className="text-blue-700 underline" to="/contabilidad/facturas">Ver facturas de Drive</Link></div>
    {admin&&<button disabled={refreshing} onClick={()=>void refresh()} className="border rounded-xl px-4 py-2 text-sm">{refreshing?'Leyendo facturas…':'Actualizar importes desde Drive'}</button>}
    {reading&&<p role="status" className="text-sm text-blue-700">{reading}</p>}
    <p className="text-sm text-gray-500">Previsión del archivo Drive importado{last ? ` · ${new Date(last).toLocaleString('es-ES')}` : ''}</p>
    <div className="flex flex-wrap gap-3">
      <select aria-label="Año" className="input-form" value={year} onChange={e => setYear(e.target.value)}><option value="todos">Todos los años</option>{years.map(y => <option key={y}>{y}</option>)}</select>
      <select aria-label="Trimestre" className="input-form" value={quarter} onChange={e => {setQuarter(e.target.value); setMonth('todos');}}><option value="todos">Todos los trimestres</option>{[1,2,3,4].map(q => <option key={q} value={q}>T{q}</option>)}</select>
      <select aria-label="Mes" className="input-form" value={month} onChange={e => {setMonth(e.target.value); setQuarter('todos');}}><option value="todos">Todos los meses</option>{months.map((m,i) => <option key={m} value={i+1}>{m}</option>)}</select>
    </div>
    {error&&<p role="alert" className="text-red-700">{error}</p>}
    {!data || data.owner !== owner ? <p role="status">Cargando facturas…</p> : <>
      {!selected.length ? <p>No hay facturas de Drive en este periodo.</p> : <>
        {totals.pending > 0 && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">Previsión parcial: {totals.pending} documentos sin importes confirmados. No se cuentan como 0 € ni se estiman a partir de los ingresos de eventos.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <StatCard2 label="Facturado sin IVA" value={totals.income} format={incomeFormat} icon={<TrendingUp size={18}/>} tone="success"/>
          <StatCard2 label="IVA facturado" value={totals.outputVat} format={incomeFormat} icon={<Receipt size={18}/>}/>
          <StatCard2 label="Facturado con IVA" value={totals.incomeTotal} format={incomeFormat} icon={<TrendingUp size={18}/>} tone="success"/>
          <StatCard2 label="Gastos sin IVA" value={totals.expenses} format={expenseFormat} icon={<TrendingDown size={18}/>} tone="danger"/>
          <StatCard2 label="IVA de los gastos" value={totals.inputVat} format={expenseFormat} icon={<Receipt size={18}/>}/>
          <StatCard2 label="Gastos con IVA" value={totals.expenseTotal} format={expenseFormat} icon={<TrendingDown size={18}/>} tone="danger"/>
        </div>
        <h2 className="text-lg font-semibold">Previsión</h2>
        <section className="grid sm:grid-cols-2 gap-3" aria-label="Previsión">
          <StatCard2 label="Resultado antes de impuestos" value={totals.result} format={resultFormat} sub="Facturado sin IVA − gastos sin IVA" icon={<Scale size={18}/>} tone={totals.result >= 0 ? 'success' : 'danger'}/>
          <StatCard2 label="Saldo de IVA estimado" value={totals.vat} format={resultFormat} sub="IVA facturado − IVA de gastos documentado" icon={<Scale size={18}/>}/>
        </section>
        <p className="text-xs text-gray-500">Agrupado por el mes de la carpeta de Drive. Solo importes identificados; el IVA deducible y los ajustes fiscales deben revisarse. No incluye gastos manuales ni facturas que no estén en Drive.</p>
      </>}
    </>}
  </div>;
};
