import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Receipt, Clock, CheckCircle, CreditCard, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { useStore } from '../store/useStore';
import { fmt, fmtShort, fmtDate, buildMonthlyTable, getAvailableYears, getMonthName } from '../utils/helpers';
import type { Area as AreaType } from '../types';

type AreaFilter = 'todos' | AreaType;

const KPI = ({ label, value, sub, icon: Icon, color, textColor }: {
  label: string; value: string; sub?: string; icon: typeof TrendingUp; color: string; textColor?: string;
}) => (
  <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col gap-2">
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
        <Icon size={15} className="text-white" />
      </div>
    </div>
    <p className={`text-xl font-bold ${textColor ?? 'text-gray-900'}`}>{value}</p>
    {sub && <p className="text-xs text-gray-500">{sub}</p>}
  </div>
);

export const Dashboard = () => {
  const { ingresos, gastos, facturas, gastosEvento } = useStore();
  const [cobrosOpen, setCobrosOpen] = useState<number | null>(null);
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
  const pendienteCobro = filteredIngresos.filter((i) => i.estadoPago !== 'pagado').reduce((s, i) => s + Math.max(0, i.total - i.pagosRecibidos), 0);
  const facturasEmitidas   = filteredFacturas.filter((f) => f.tipo === 'emitida').length;
  const facturasRecibidas  = filteredFacturas.filter((f) => f.tipo === 'recibida').length;
  const facturasNoPagadas  = filteredFacturas.filter((f) => f.tipo === 'emitida' && !f.pagada).length;

  const filteredIngresoIds = useMemo(() => new Set(filteredIngresos.map((i) => i.id)), [filteredIngresos]);
  const costesEventoTotal  = useMemo(
    () => gastosEvento.filter((g) => filteredIngresoIds.has(g.ingresoId)).reduce((s, g) => s + g.importe, 0),
    [gastosEvento, filteredIngresoIds],
  );
  const beneficioReal = totalIngresos - costesEventoTotal;

  const ingresosAnio = useMemo(() =>
    (area === 'todos' ? ingresos : ingresos.filter((i) => i.area === area))
      .filter((i) => new Date(i.fechaEvento).getFullYear() === year),
    [ingresos, area, year]
  );

  const cobrosMensuales = useMemo(() => Array.from({ length: 12 }, (_, idx) => {
    const num = idx + 1;
    const ingMes    = ingresosAnio.filter((i) => new Date(i.fechaEvento).getMonth() + 1 === num);
    const cobrados  = ingMes.filter((i) => i.estadoPago === 'pagado');
    const pendientes = ingMes.filter((i) => i.estadoPago !== 'pagado');
    const totalCobrado   = cobrados.reduce((s, i) => s + i.total, 0);
    const totalPendiente = pendientes.reduce((s, i) => s + Math.max(0, i.total - i.pagosRecibidos), 0);
    return { num, label: getMonthName(num), ingMes, cobrados, pendientes, totalCobrado, totalPendiente };
  }).filter((r) => r.ingMes.length > 0), [ingresosAnio]);

  const monthlyData = useMemo(() => buildMonthlyTable(
    area === 'todos' ? ingresos : ingresos.filter((i) => i.area === area),
    area === 'todos' ? gastos : gastos.filter((g) => g.area === area),
    year
  ), [ingresos, gastos, year, area]);

  const months = Array.from({ length: 12 }, (_, i) => ({ num: i + 1, label: getMonthName(i + 1) }));

  // Mini bar chart using pure CSS
  const chartMax = Math.max(...monthlyData.flatMap((r) => [r.ing, r.gTotal]), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Resumen financiero global</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="border border-gray-200 text-gray-700 text-sm rounded-xl px-3 py-1.5 outline-none bg-white focus:border-amber-400">
            {allYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={month} onChange={(e) => setMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="border border-gray-200 text-gray-700 text-sm rounded-xl px-3 py-1.5 outline-none bg-white focus:border-amber-400">
            <option value="all">Todo el año</option>
            {months.map((m) => <option key={m.num} value={m.num}>{m.label}</option>)}
          </select>
          {(['todos', 'montada', 'dj'] as AreaFilter[]).map((a) => (
            <button
              key={a}
              onClick={() => setArea(a)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all border ${
                area === a
                  ? 'bg-amber-500 text-black border-amber-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300 hover:text-gray-900'
              }`}
            >
              {a === 'todos' ? 'Conjunto' : a === 'montada' ? 'La Montada' : 'DJs'}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <KPI label="Ingresos (s/IVA)" value={fmtShort(totalIngresos)} icon={TrendingUp} color="bg-green-500" />
        <KPI label="Gastos (s/IVA)" value={fmtShort(totalGastos)} icon={TrendingDown} color="bg-red-500" />
        <KPI label="Beneficio bruto" value={fmtShort(beneficioBruto)} sub="Sin impuestos" icon={DollarSign} color={beneficioBruto >= 0 ? 'bg-amber-500' : 'bg-red-500'} textColor={beneficioBruto >= 0 ? 'text-gray-900' : 'text-red-600'} />
        <KPI label="Benef. real eventos" value={fmtShort(beneficioReal)} sub={`Costes ev: ${fmtShort(costesEventoTotal)}`} icon={DollarSign} color={beneficioReal >= 0 ? 'bg-teal-500' : 'bg-red-500'} textColor={beneficioReal >= 0 ? 'text-gray-900' : 'text-red-600'} />
        <KPI label="Beneficio (IS 25%)" value={fmtShort(beneficioNeto)} sub={`IS est: ${fmtShort(is25)}`} icon={DollarSign} color="bg-blue-500" />
        <KPI label="Pendiente cobro" value={fmtShort(pendienteCobro)} sub={`${ingresosAnio.filter((i) => i.estadoPago !== 'pagado').length} evento(s)`} icon={Clock} color={pendienteCobro > 0 ? 'bg-orange-500' : 'bg-green-500'} textColor={pendienteCobro > 0 ? 'text-orange-600' : 'text-gray-900'} />
      </div>

      {/* KPIs row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPI label="IVA repercutido" value={fmtShort(ivaRep)} sub="En facturas emitidas" icon={Receipt} color="bg-emerald-500" />
        <KPI label="IVA soportado" value={fmtShort(ivaSop)} sub="Deducible" icon={Receipt} color="bg-orange-500" />
        <KPI label={ivaLiquidar >= 0 ? 'IVA a pagar' : 'IVA a compensar'} value={fmtShort(Math.abs(ivaLiquidar))} sub={ivaLiquidar >= 0 ? 'A ingresar en Hacienda' : 'A compensar'} icon={CreditCard} color={ivaLiquidar >= 0 ? 'bg-red-500' : 'bg-green-500'} />
        <KPI label="Facturas emitidas" value={String(facturasEmitidas)} sub={`${facturasNoPagadas} sin cobrar`} icon={FileText} color="bg-purple-500" />
        <KPI label="Facturas recibidas" value={String(facturasRecibidas)} sub="Proveedores" icon={CheckCircle} color="bg-gray-500" />
      </div>

      {/* Mini chart */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800 mb-1">Evolución mensual {year} — base imponible</h3>
        <p className="text-xs text-gray-400 mb-5">Barras: <span className="text-amber-500 font-medium">■ Ingresos</span> / <span className="text-red-400 font-medium">■ Gastos</span></p>
        <div className="flex items-end gap-1 h-36">
          {monthlyData.map((row) => (
            <div key={row.num} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full flex flex-col items-center gap-0.5 justify-end" style={{ height: 120 }}>
                <div className="w-full bg-amber-400 rounded-t-sm min-h-[2px]" style={{ height: `${(row.ing / chartMax) * 100}%` }} title={`Ingresos: ${fmt(row.ing)}`} />
                <div className="w-full bg-red-400 rounded-t-sm min-h-[2px]" style={{ height: `${(row.gTotal / chartMax) * 100}%` }} title={`Gastos: ${fmt(row.gTotal)}`} />
              </div>
              <span className="text-[9px] text-gray-400">{row.label.slice(0, 3)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Cobros pendientes */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Cobros pendientes {year}</h3>
            <p className="text-xs text-gray-400 mt-0.5">Estado de cobro por mes y evento</p>
          </div>
          {pendienteCobro > 0 && (
            <span className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold rounded-xl">
              {fmt(pendienteCobro)} por cobrar
            </span>
          )}
          {pendienteCobro === 0 && cobrosMensuales.length > 0 && (
            <span className="px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 text-sm font-semibold rounded-xl">✓ Todo cobrado</span>
          )}
        </div>
        {cobrosMensuales.length === 0 ? (
          <p className="p-8 text-center text-gray-400 text-sm">Sin ingresos en {year}</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {cobrosMensuales.map((row) => (
              <div key={row.num}>
                <button
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors text-left"
                  onClick={() => setCobrosOpen(cobrosOpen === row.num ? null : row.num)}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    {cobrosOpen === row.num ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                    <span className="text-sm font-medium text-gray-700">{row.label}</span>
                    <span className="text-xs text-gray-400">{row.ingMes.length} evento(s)</span>
                    {row.pendientes.length > 0
                      ? <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">{row.pendientes.length} pendiente(s)</span>
                      : <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">✓ Cobrado</span>}
                  </div>
                  <div className="flex items-center gap-5 text-sm">
                    <span className="text-gray-400">Cobrado: <span className="text-green-700 font-semibold">{fmt(row.totalCobrado)}</span></span>
                    {row.totalPendiente > 0 && (
                      <span className="text-gray-400">Pendiente: <span className="text-amber-700 font-semibold">{fmt(row.totalPendiente)}</span></span>
                    )}
                  </div>
                </button>
                {cobrosOpen === row.num && (
                  <div className="bg-gray-50 border-t border-gray-100 divide-y divide-gray-100">
                    {[...row.cobrados, ...row.pendientes].sort((a, b) => b.fechaEvento.localeCompare(a.fechaEvento)).map((i) => {
                      const pagado = i.estadoPago === 'pagado';
                      const isParcial = i.estadoPago === 'parcial';
                      const restante = Math.max(0, i.total - i.pagosRecibidos);
                      return (
                        <div key={i.id} className="flex items-center justify-between px-8 py-2.5">
                          <div className="flex items-center gap-3">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${pagado ? 'bg-green-500' : isParcial ? 'bg-orange-400' : 'bg-red-400'}`} />
                            <div>
                              <p className="text-sm text-gray-800">{i.concepto}</p>
                              <p className="text-xs text-gray-400">{i.cliente} · {fmtDate(i.fechaEvento)} · {i.area === 'montada' ? 'La Montada' : 'DJ'}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-gray-900">{fmt(i.total)}</p>
                            {pagado && <p className="text-xs text-green-600">Cobrado ✓</p>}
                            {isParcial && <p className="text-xs text-orange-600">{fmt(i.pagosRecibidos)} cobrado · {fmt(restante)} pendiente</p>}
                            {!pagado && !isParcial && <p className="text-xs text-red-500">Sin cobrar</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabla mensual */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">Resumen mensual — base imponible (sin IVA)</h3>
          <p className="text-xs text-gray-400 mt-0.5">Benef. real = base ingresos − costes de eventos registrados</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Mes</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ingresos</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">G. Fijos</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">G. Variables</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total gastos</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Balance</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">IVA rep.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">IVA sop.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {monthlyData.map((row) => (
                <tr key={row.num} className={`hover:bg-gray-50 ${row.ing === 0 && row.gTotal === 0 ? 'opacity-40' : ''}`}>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{row.label}</td>
                  <td className="px-4 py-2.5 text-right text-green-700">{row.ing > 0 ? fmt(row.ing) : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-gray-500">{row.gFijo > 0 ? fmt(row.gFijo) : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-gray-500">{row.gVar > 0 ? fmt(row.gVar) : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-red-600">{row.gTotal > 0 ? fmt(row.gTotal) : '—'}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${row.balance >= 0 ? 'text-amber-600' : 'text-red-600'}`}>{row.ing > 0 || row.gTotal > 0 ? fmt(row.balance) : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-gray-400">{row.ivaRep > 0 ? fmt(row.ivaRep) : '—'}</td>
                  <td className="px-4 py-2.5 text-right text-gray-400">{row.ivaSop > 0 ? fmt(row.ivaSop) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
              <tr>
                <td className="px-4 py-3 text-gray-700">TOTAL</td>
                <td className="px-4 py-3 text-right text-green-700">{fmt(monthlyData.reduce((s, r) => s + r.ing, 0))}</td>
                <td className="px-4 py-3 text-right text-gray-500">{fmt(monthlyData.reduce((s, r) => s + r.gFijo, 0))}</td>
                <td className="px-4 py-3 text-right text-gray-500">{fmt(monthlyData.reduce((s, r) => s + r.gVar, 0))}</td>
                <td className="px-4 py-3 text-right text-red-600">{fmt(monthlyData.reduce((s, r) => s + r.gTotal, 0))}</td>
                <td className={`px-4 py-3 text-right ${monthlyData.reduce((s, r) => s + r.balance, 0) >= 0 ? 'text-amber-600' : 'text-red-600'}`}>{fmt(monthlyData.reduce((s, r) => s + r.balance, 0))}</td>
                <td className="px-4 py-3 text-right text-gray-500">{fmt(monthlyData.reduce((s, r) => s + r.ivaRep, 0))}</td>
                <td className="px-4 py-3 text-right text-gray-500">{fmt(monthlyData.reduce((s, r) => s + r.ivaSop, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
