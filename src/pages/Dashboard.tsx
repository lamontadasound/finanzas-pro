import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Receipt, Clock, CheckCircle, CreditCard, FileText } from 'lucide-react';
import { AreaChart, Area as RechartArea, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useStore } from '../store/useStore';
import { fmt, fmtShort, buildMonthlyTable, getAvailableYears, getMonthName } from '../utils/helpers';
import type { Area as AreaType } from '../types';

type AreaFilter = 'todos' | AreaType;

const KPI = ({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: any; color: string }) => (
  <div className="bg-surface-800 border border-surface-400/20 rounded-xl p-4 flex flex-col gap-2">
    <div className="flex items-center justify-between">
      <span className="text-xs text-zinc-500 font-medium uppercase tracking-wide">{label}</span>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
        <Icon size={15} />
      </div>
    </div>
    <p className="text-xl font-bold text-white">{value}</p>
    {sub && <p className="text-xs text-zinc-500">{sub}</p>}
  </div>
);

export const Dashboard = () => {
  const { ingresos, gastos, facturas } = useStore();
  const allYears = useMemo(() => getAvailableYears([...ingresos, ...gastos]), [ingresos, gastos]);
  const [year, setYear] = useState(allYears[0] ?? new Date().getFullYear());
  const [month, setMonth] = useState<number | 'all'>('all');
  const [area, setArea] = useState<AreaFilter>('todos');

  const filteredIngresos = useMemo(() => ingresos.filter((i) => {
    const y = new Date(i.fechaEvento).getFullYear();
    const m = new Date(i.fechaEvento).getMonth() + 1;
    if (y !== year) return false;
    if (month !== 'all' && m !== month) return false;
    if (area !== 'todos' && i.area !== area) return false;
    return true;
  }), [ingresos, year, month, area]);

  const filteredGastos = useMemo(() => gastos.filter((g) => {
    const y = new Date(g.fecha).getFullYear();
    const m = new Date(g.fecha).getMonth() + 1;
    if (y !== year) return false;
    if (month !== 'all' && m !== month) return false;
    if (area !== 'todos' && g.area !== area) return false;
    return true;
  }), [gastos, year, month, area]);

  const filteredFacturas = useMemo(() => facturas.filter((f) => {
    const y = new Date(f.fecha).getFullYear();
    const m = new Date(f.fecha).getMonth() + 1;
    if (y !== year) return false;
    if (month !== 'all' && m !== month) return false;
    if (area !== 'todos' && f.area !== area) return false;
    return true;
  }), [facturas, year, month, area]);

  const totalIngresos = filteredIngresos.reduce((s, i) => s + i.baseImponible, 0);
  const totalGastos = filteredGastos.reduce((s, g) => s + g.baseImponible, 0);
  const beneficioBruto = totalIngresos - totalGastos;
  const is25 = Math.max(0, beneficioBruto * 0.25);
  const beneficioNeto = beneficioBruto - is25;
  const ivaRep = filteredIngresos.reduce((s, i) => s + i.importeIVA, 0);
  const ivaSop = filteredGastos.filter((g) => g.deducible).reduce((s, g) => s + g.importeIVA, 0);
  const ivaLiquidar = ivaRep - ivaSop;
  const pendienteCobro = filteredIngresos.filter((i) => i.estadoPago !== 'pagado').reduce((s, i) => s + (i.total - i.pagosRecibidos), 0);
  const facturasEmitidas = filteredFacturas.filter((f) => f.tipo === 'emitida').length;
  const facturasRecibidas = filteredFacturas.filter((f) => f.tipo === 'recibida').length;
  const facturasNoPagadas = filteredFacturas.filter((f) => f.tipo === 'emitida' && !f.pagada).length;

  const monthlyData = useMemo(() => buildMonthlyTable(
    area === 'todos' ? ingresos : ingresos.filter((i) => i.area === area),
    area === 'todos' ? gastos : gastos.filter((g) => g.area === area),
    year
  ), [ingresos, gastos, year, area]);

  const chartData = monthlyData.map((r) => ({ mes: r.label.slice(0, 3), ingresos: r.ing, gastos: r.gTotal, beneficio: r.balance }));

  const months = Array.from({ length: 12 }, (_, i) => ({ num: i + 1, label: getMonthName(i + 1) }));

  return (
    <div className="p-6 space-y-6">
      {/* Header + filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Resumen financiero global</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="bg-surface-700 border border-surface-400/30 text-white text-sm rounded-lg px-3 py-1.5 outline-none">
            {allYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={month} onChange={(e) => setMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="bg-surface-700 border border-surface-400/30 text-white text-sm rounded-lg px-3 py-1.5 outline-none">
            <option value="all">Todo el año</option>
            {months.map((m) => <option key={m.num} value={m.num}>{m.label}</option>)}
          </select>
          {(['todos', 'montada', 'dj'] as AreaFilter[]).map((a) => (
            <button key={a} onClick={() => setArea(a)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${area === a ? 'bg-gold-500/15 text-gold-400 border border-gold-500/20' : 'bg-surface-700 text-zinc-400 border border-surface-400/30 hover:text-zinc-200'}`}>
              {a === 'todos' ? 'Conjunto' : a === 'montada' ? 'La Montada' : 'DJ Personal'}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPI label="Ingresos (s/IVA)" value={fmtShort(totalIngresos)} icon={TrendingUp} color="bg-green-500/10 text-green-400" />
        <KPI label="Gastos (s/IVA)" value={fmtShort(totalGastos)} icon={TrendingDown} color="bg-red-500/10 text-red-400" />
        <KPI label="Beneficio bruto" value={fmtShort(beneficioBruto)} sub="Sin impuestos" icon={DollarSign} color={beneficioBruto >= 0 ? 'bg-gold-500/10 text-gold-400' : 'bg-red-500/10 text-red-400'} />
        <KPI label="Beneficio (IS 25%)" value={fmtShort(beneficioNeto)} sub={`IS estimado: ${fmtShort(is25)}`} icon={DollarSign} color="bg-blue-500/10 text-blue-400" />
        <KPI label="Pendiente cobro" value={fmtShort(pendienteCobro)} icon={Clock} color="bg-yellow-500/10 text-yellow-400" />
      </div>

      {/* KPIs row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPI label="IVA repercutido" value={fmtShort(ivaRep)} sub="En facturas emitidas" icon={Receipt} color="bg-emerald-500/10 text-emerald-400" />
        <KPI label="IVA soportado" value={fmtShort(ivaSop)} sub="Deducible" icon={Receipt} color="bg-orange-500/10 text-orange-400" />
        <KPI label={ivaLiquidar >= 0 ? 'IVA a pagar' : 'IVA a compensar'} value={fmtShort(Math.abs(ivaLiquidar))} sub={ivaLiquidar >= 0 ? 'A ingresar en Hacienda' : 'A compensar'} icon={CreditCard} color={ivaLiquidar >= 0 ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'} />
        <KPI label="Facturas emitidas" value={String(facturasEmitidas)} sub={`${facturasNoPagadas} sin cobrar`} icon={FileText} color="bg-purple-500/10 text-purple-400" />
        <KPI label="Facturas recibidas" value={String(facturasRecibidas)} sub="Proveedores" icon={CheckCircle} color="bg-zinc-500/10 text-zinc-400" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-surface-800 border border-surface-400/20 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Evolución mensual {year} — base imponible</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="mes" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: any) => fmtShort(Number(v))} />
              <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} labelStyle={{ color: '#e4e4e7' }} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#71717a' }} />
              <Bar dataKey="ingresos" name="Ingresos" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-surface-800 border border-surface-400/20 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Beneficio mensual {year}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gradBen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="mes" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: any) => fmtShort(Number(v))} />
              <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} />
              <RechartArea type="monotone" dataKey="beneficio" name="Beneficio" stroke="#f59e0b" fill="url(#gradBen)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly summary table */}
      <div className="bg-surface-800 border border-surface-400/20 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-surface-400/20">
          <h3 className="text-sm font-semibold text-white">Resumen mensual — base imponible (sin IVA)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-400/20">
                <th className="text-left px-4 py-3 text-zinc-500 font-medium">Mes</th>
                <th className="text-right px-4 py-3 text-zinc-500 font-medium">Ingresos</th>
                <th className="text-right px-4 py-3 text-zinc-500 font-medium">G. Fijos</th>
                <th className="text-right px-4 py-3 text-zinc-500 font-medium">G. Variables</th>
                <th className="text-right px-4 py-3 text-zinc-500 font-medium">Total gastos</th>
                <th className="text-right px-4 py-3 text-zinc-500 font-medium">Balance</th>
                <th className="text-right px-4 py-3 text-zinc-500 font-medium">IVA rep.</th>
                <th className="text-right px-4 py-3 text-zinc-500 font-medium">IVA sop.</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((row) => (
                <tr key={row.num} className={`border-b border-surface-400/10 hover:bg-surface-700/50 ${row.ing === 0 && row.gTotal === 0 ? 'opacity-40' : ''}`}>
                  <td className="px-4 py-2.5 text-zinc-300 font-medium">{row.label}</td>
                  <td className="px-4 py-2.5 text-right text-green-400">{row.ing > 0 ? fmt(row.ing) : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-zinc-400">{row.gFijo > 0 ? fmt(row.gFijo) : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-zinc-400">{row.gVar > 0 ? fmt(row.gVar) : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-red-400">{row.gTotal > 0 ? fmt(row.gTotal) : '—'}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${row.balance >= 0 ? 'text-gold-400' : 'text-red-400'}`}>{row.ing > 0 || row.gTotal > 0 ? fmt(row.balance) : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-zinc-500">{row.ivaRep > 0 ? fmt(row.ivaRep) : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-zinc-500">{row.ivaSop > 0 ? fmt(row.ivaSop) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-700/50 font-semibold">
                <td className="px-4 py-3 text-zinc-300">TOTAL</td>
                <td className="px-4 py-3 text-right text-green-400">{fmt(monthlyData.reduce((s, r) => s + r.ing, 0))}</td>
                <td className="px-4 py-3 text-right text-zinc-400">{fmt(monthlyData.reduce((s, r) => s + r.gFijo, 0))}</td>
                <td className="px-4 py-3 text-right text-zinc-400">{fmt(monthlyData.reduce((s, r) => s + r.gVar, 0))}</td>
                <td className="px-4 py-3 text-right text-red-400">{fmt(monthlyData.reduce((s, r) => s + r.gTotal, 0))}</td>
                <td className={`px-4 py-3 text-right ${monthlyData.reduce((s, r) => s + r.balance, 0) >= 0 ? 'text-gold-400' : 'text-red-400'}`}>{fmt(monthlyData.reduce((s, r) => s + r.balance, 0))}</td>
                <td className="px-4 py-3 text-right text-zinc-500">{fmt(monthlyData.reduce((s, r) => s + r.ivaRep, 0))}</td>
                <td className="px-4 py-3 text-right text-zinc-500">{fmt(monthlyData.reduce((s, r) => s + r.ivaSop, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
