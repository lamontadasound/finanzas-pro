import { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { Area, Ingreso } from '../../types';

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtFull = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

type Rango = 'mes' | 'trimestre' | 'año' | 'personalizado';

interface Props { area: Area }

// ── KPI Card ──────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, color, icon: Icon }: {
  label: string; value: string; sub?: string; color: string; icon: typeof TrendingUp;
}) => (
  <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
    <div className="flex items-start justify-between mb-3">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={15} className="text-white" />
      </div>
    </div>
    <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
    {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
  </div>
);

// ── Mini bar chart ─────────────────────────────────────────────────────────────
const BarChart = ({ data }: { data: { label: string; ing: number; gas: number }[] }) => {
  const max = Math.max(...data.flatMap((d) => [d.ing, d.gas]), 1);
  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((d) => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-0.5">
          <div className="w-full flex flex-col items-center gap-0.5 justify-end" style={{ height: 112 }}>
            <div
              className="w-full bg-amber-400 rounded-t-sm min-h-[2px]"
              style={{ height: `${(d.ing / max) * 100}%` }}
              title={`Ingresos: ${fmt(d.ing)}`}
            />
            <div
              className="w-full bg-red-400 rounded-t-sm min-h-[2px]"
              style={{ height: `${(d.gas / max) * 100}%` }}
              title={`Gastos: ${fmt(d.gas)}`}
            />
          </div>
          <span className="text-[9px] text-gray-400">{d.label}</span>
        </div>
      ))}
    </div>
  );
};

// ── Cobros por mes ────────────────────────────────────────────────────────────
const CobrosMes = ({ ingresos }: { ingresos: Ingreso[] }) => {
  const [openMonth, setOpenMonth] = useState<string | null>(null);
  const year = new Date().getFullYear();

  const byMonth = useMemo(() => {
    const map: Record<string, { cobrado: number; pendiente: number; items: Ingreso[] }> = {};
    for (let m = 0; m < 12; m++) {
      const key = `${year}-${String(m + 1).padStart(2, '0')}`;
      map[key] = { cobrado: 0, pendiente: 0, items: [] };
    }
    ingresos.forEach((i) => {
      const key = i.fechaEvento.slice(0, 7);
      if (!map[key]) return;
      map[key].items.push(i);
      if (i.estadoPago === 'pagado') map[key].cobrado += i.total;
      else if (['pendiente', 'parcial'].includes(i.estadoPago)) map[key].pendiente += i.total - i.pagosRecibidos;
    });
    return map;
  }, [ingresos, year]);

  const months = Object.entries(byMonth).filter(([, v]) => v.items.length > 0);

  if (months.length === 0) return <p className="text-sm text-gray-400 py-6 text-center">Sin ingresos registrados</p>;

  return (
    <div className="space-y-2">
      {months.map(([key, val]) => {
        const [, m] = key.split('-');
        const mIdx = parseInt(m) - 1;
        const isOpen = openMonth === key;
        return (
          <div key={key} className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setOpenMonth(isOpen ? null : key)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-semibold text-gray-800">{MESES_FULL[mIdx]} {year}</span>
              <div className="flex items-center gap-4">
                <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full font-medium">
                  Cobrado: {fmt(val.cobrado)}
                </span>
                {val.pendiente > 0 && (
                  <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                    Pendiente: {fmt(val.pendiente)}
                  </span>
                )}
                <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-gray-100">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 text-gray-500 font-medium">Concepto</th>
                      <th className="text-left px-4 py-2 text-gray-500 font-medium">Cliente</th>
                      <th className="text-right px-4 py-2 text-gray-500 font-medium">Total</th>
                      <th className="text-center px-4 py-2 text-gray-500 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {val.items.map((i) => (
                      <tr key={i.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-800">{i.concepto}</td>
                        <td className="px-4 py-2 text-gray-500">{i.cliente}</td>
                        <td className="px-4 py-2 text-right font-mono text-gray-800">{fmtFull(i.total)}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            i.estadoPago === 'pagado' ? 'bg-green-100 text-green-700' :
                            i.estadoPago === 'parcial' ? 'bg-blue-100 text-blue-700' :
                            i.estadoPago === 'pendiente' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {i.estadoPago}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
export const ResumenPage = ({ area }: Props) => {
  const ingresos     = useStore((s) => s.ingresos.filter((i) => i.area === area));
  const gastos       = useStore((s) => s.gastos.filter((g) => g.area === area));
  const gastosEvento = useStore((s) => s.gastosEvento.filter((g) => g.area === area));
  const eventos      = useStore((s) => s.eventos.filter((e) => e.area === area));

  const [rango, setRango] = useState<Rango>('año');
  const [rangoYear, setRangoYear] = useState(new Date().getFullYear());
  const [rangoMes, setRangoMes] = useState(new Date().getMonth());
  const [trimestre, setTrimestre] = useState(Math.floor(new Date().getMonth() / 3));
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const inRange = (fecha: string) => {
    const d = new Date(fecha);
    if (rango === 'mes') return d.getFullYear() === rangoYear && d.getMonth() === rangoMes;
    if (rango === 'trimestre') {
      const q = Math.floor(d.getMonth() / 3);
      return d.getFullYear() === rangoYear && q === trimestre;
    }
    if (rango === 'año') return d.getFullYear() === rangoYear;
    if (rango === 'personalizado') {
      if (desde && d < new Date(desde)) return false;
      if (hasta && d > new Date(hasta)) return false;
      return true;
    }
    return true;
  };

  const ingFiltrados  = ingresos.filter((i) => inRange(i.fechaEvento));
  const gasFiltrados  = gastos.filter((g) => inRange(g.fecha));
  const gasEvFiltrados = gastosEvento.filter((g) => inRange(g.fecha));

  const totalIngresos    = ingFiltrados.reduce((a, i) => a + i.total, 0);
  const baseImponibleSum = ingFiltrados.reduce((a, i) => a + i.baseImponible, 0);
  const totalGastos      = gasFiltrados.reduce((a, g) => a + g.total, 0) + gasEvFiltrados.reduce((a, g) => a + g.importe, 0);
  const totalCostesEvento = gastosEvento.filter((g) => inRange(g.fecha)).reduce((a, g) => a + g.importe, 0);
  const beneficioReal    = baseImponibleSum - totalCostesEvento;
  const cobrado          = ingFiltrados.filter((i) => i.estadoPago === 'pagado').reduce((a, i) => a + i.total, 0);
  const pendiente        = ingFiltrados.filter((i) => ['pendiente', 'parcial'].includes(i.estadoPago)).reduce((a, i) => a + (i.total - i.pagosRecibidos), 0);
  const evConfirmados    = eventos.filter((e) => e.area === area && e.estado === 'confirmado').length;

  // Chart data (12 meses del año seleccionado)
  const chartData = MESES.map((label, m) => ({
    label,
    ing: ingresos.filter((i) => {
      const d = new Date(i.fechaEvento);
      return d.getFullYear() === rangoYear && d.getMonth() === m;
    }).reduce((a, i) => a + i.total, 0),
    gas: gastos.filter((g) => {
      const d = new Date(g.fecha);
      return d.getFullYear() === rangoYear && d.getMonth() === m;
    }).reduce((a, g) => a + g.total, 0),
  }));

  const label = area === 'montada' ? 'La Montada Sound' : 'DJ Personal';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{label} — Resumen</h1>
          <p className="text-sm text-gray-500">Vista financiera consolidada</p>
        </div>

        {/* Filtros de rango */}
        <div className="flex flex-wrap gap-2">
          {(['mes', 'trimestre', 'año', 'personalizado'] as Rango[]).map((r) => (
            <button
              key={r}
              onClick={() => setRango(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                rango === r ? 'bg-amber-500 text-black' : 'bg-white border border-gray-200 text-gray-600 hover:border-amber-400'
              }`}
            >
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Controles rango */}
      <div className="flex flex-wrap gap-3 items-center">
        {(rango === 'año' || rango === 'mes' || rango === 'trimestre') && (
          <div className="flex items-center gap-2">
            <button onClick={() => setRangoYear((v) => v - 1)} className="px-2 py-1 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">‹</button>
            <span className="text-sm font-semibold text-gray-700 w-12 text-center">{rangoYear}</span>
            <button onClick={() => setRangoYear((v) => v + 1)} className="px-2 py-1 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">›</button>
          </div>
        )}
        {rango === 'mes' && (
          <select value={rangoMes} onChange={(e) => setRangoMes(Number(e.target.value))} className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white">
            {MESES_FULL.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
        )}
        {rango === 'trimestre' && (
          <select value={trimestre} onChange={(e) => setTrimestre(Number(e.target.value))} className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white">
            <option value={0}>Q1 (Ene–Mar)</option>
            <option value={1}>Q2 (Abr–Jun)</option>
            <option value={2}>Q3 (Jul–Sep)</option>
            <option value={3}>Q4 (Oct–Dic)</option>
          </select>
        )}
        {rango === 'personalizado' && (
          <>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1" />
            <span className="text-gray-400 text-sm">→</span>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1" />
          </>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Ingresos totales" value={fmt(totalIngresos)} sub={`${ingFiltrados.length} eventos`} color="bg-green-500" icon={TrendingUp} />
        <KpiCard label="Gastos totales" value={fmt(totalGastos)} sub="Generales + evento" color="bg-red-500" icon={TrendingDown} />
        <KpiCard label="Beneficio real" value={fmt(beneficioReal)} sub="Base imp. − costes evento" color={beneficioReal >= 0 ? 'bg-amber-500' : 'bg-red-600'} icon={DollarSign} />
        <KpiCard label="Cobrado / Pendiente" value={fmt(cobrado)} sub={`Pendiente: ${fmt(pendiente)}`} color="bg-blue-500" icon={CheckCircle2} />
      </div>

      {/* Segunda fila KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard label="Eventos confirmados" value={String(evConfirmados)} color="bg-purple-500" icon={Clock} />
        <KpiCard label="Base imponible" value={fmt(baseImponibleSum)} sub="Ingresos sin IVA" color="bg-teal-500" icon={TrendingUp} />
        <KpiCard label="Costes por evento" value={fmt(totalCostesEvento)} sub="Personal, transporte, etc." color="bg-orange-500" icon={AlertCircle} />
      </div>

      {/* Chart */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-800">Ingresos vs Gastos por mes ({rangoYear})</h2>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-400 rounded-sm inline-block" /> Ingresos</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-400 rounded-sm inline-block" /> Gastos</span>
          </div>
        </div>
        <BarChart data={chartData} />
      </div>

      {/* Cobros por mes */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-800 mb-4">Cobros pendientes por mes</h2>
        <CobrosMes ingresos={ingresos} />
      </div>
    </div>
  );
};
