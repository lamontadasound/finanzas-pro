import { useEffect, useMemo, useState } from 'react';
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
  const [data, setData] = useState<{owner: string | undefined; files: AccountingFile[]; amounts: DriveExpenseAmount[]} | null>(null);
  const [error, setError] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [quarter, setQuarter] = useState('todos');
  const [month, setMonth] = useState('todos');
  useEffect(() => {
    let active = true;
    setData(null); setError('');
    Promise.all([supabase.from('drive_invoice_files').select('*'), supabase.from('drive_expense_amounts').select('*')]).then(([f,a]) => {
      if (!active) return;
      if (f.error || a.error) throw new Error('No se pudo cargar el archivo de facturas.');
      setData({owner, files: f.data ?? [], amounts: a.data ?? []});
    }).catch(() => { if (active) setError('No se pudo cargar el archivo de facturas. Recarga para volver a intentarlo.'); });
    return () => { active = false; };
  }, [owner]);
  const files = data?.owner === owner ? data?.files ?? [] : [];
  const rows = useMemo(() => driveAccounting(files, data?.amounts ?? [], facturas), [files, data, facturas]);
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
    <p className="text-sm text-gray-500">Previsión del archivo Drive importado{last ? ` · ${new Date(last).toLocaleString('es-ES')}` : ''}</p>
    <div className="flex flex-wrap gap-3">
      <select aria-label="Año" className="input-form" value={year} onChange={e => setYear(e.target.value)}><option value="todos">Todos los años</option>{years.map(y => <option key={y}>{y}</option>)}</select>
      <select aria-label="Trimestre" className="input-form" value={quarter} onChange={e => {setQuarter(e.target.value); setMonth('todos');}}><option value="todos">Todos los trimestres</option>{[1,2,3,4].map(q => <option key={q} value={q}>T{q}</option>)}</select>
      <select aria-label="Mes" className="input-form" value={month} onChange={e => {setMonth(e.target.value); setQuarter('todos');}}><option value="todos">Todos los meses</option>{months.map((m,i) => <option key={m} value={i+1}>{m}</option>)}</select>
    </div>
    {error ? <p role="alert" className="text-red-700">{error}</p> : !data || data.owner !== owner ? <p role="status">Cargando facturas…</p> : <>
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
