/**
 * MontadaSound.tsx — Página principal de La Montada Sound
 * Tabs: Resumen | Ingresos | Gastos generales
 *
 * INGRESOS:
 *  - Clic en fila → EventoDetailModal (edición + costes + pagos + resumen)
 *  - "Nuevo ingreso" → modal sencillo de creación → al guardar abre detalle
 *  - Listado: concepto/cliente/fecha, tipo, base, IVA, total, factura, estado, costes, beneficio
 *
 * GASTOS GENERALES:
 *  - Separados de los costes de evento
 *  - Para gastos de empresa: marketing, software, gestoría, etc.
 */
import { useState, useMemo } from 'react';
import { Plus, ChevronLeft, ChevronRight, Trash2, Edit2, Check, X, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import * as XLSX from 'xlsx';
import { useStore } from '../store/useStore';
import {
  fmt, fmtShort, fmtDate, uid, buildMonthlyTable, getAvailableYears, getMonthName,
  EVENT_TYPE_LABELS, EVENT_TYPE_COLORS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS,
  GASTO_CATEGORIAS, METODO_PAGO_LABELS, calcIVA, useYearMonth,
} from '../utils/helpers';
import { Modal } from '../components/ui/Modal';
import { EventoDetailModal } from '../components/ui/EventoDetailModal';
import { useConfirmStore } from '../store/useConfirmStore';
import type { Ingreso, Gasto, GastoEvento } from '../types';

// ── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'resumen' | 'ingresos' | 'gastos';
const TABS: { id: Tab; label: string }[] = [
  { id: 'resumen',   label: 'Resumen' },
  { id: 'ingresos',  label: 'Ingresos' },
  { id: 'gastos',    label: 'Gastos generales' },
];

// ── Plantillas ────────────────────────────────────────────────────────────────

const emptyIngreso = (): Omit<Ingreso, 'id' | 'createdAt'> => ({
  area: 'montada', concepto: '', cliente: '', tipoEvento: 'boda',
  fechaEvento: new Date().toISOString().slice(0, 10),
  baseImponible: 0, porcentajeIVA: 21, importeIVA: 0, total: 0,
  metodoPago: 'transferencia', estadoPago: 'pendiente', pagosRecibidos: 0, facturaEmitida: false,
});

const emptyGasto = (): Omit<Gasto, 'id' | 'createdAt'> => ({
  area: 'montada', fecha: new Date().toISOString().slice(0, 10),
  concepto: '', categoria: 'Otros', tipo: 'variable',
  baseImponible: 0, porcentajeIVA: 21, importeIVA: 0, total: 0,
  metodoPago: 'transferencia', facturaRecibida: false, deducible: true,
});

// ── Página principal ──────────────────────────────────────────────────────────

export const MontadaSound = () => {
  const { ingresos, gastos, gastosEvento, addIngreso, updateIngreso, deleteIngreso, addGasto, updateGasto, deleteGasto } = useStore();
  const [tab, setTab] = useState<Tab>('ingresos');

  const montadaIngresos     = useMemo(() => ingresos.filter((i) => i.area === 'montada'), [ingresos]);
  const montadaGastos       = useMemo(() => gastos.filter((g) => g.area === 'montada'), [gastos]);
  const montadaGastosEvento = useMemo(() => gastosEvento.filter((g) => g.area === 'montada'), [gastosEvento]);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">La Montada Sound</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Empresa de eventos — sonido, iluminación y producción</p>
      </div>
      <div className="flex gap-1 bg-surface-800 border border-surface-400/20 rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-gold-500/15 text-gold-400' : 'text-zinc-500 hover:text-zinc-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'resumen' && (
        <ResumenTab ingresos={montadaIngresos} gastos={montadaGastos} gastosEvento={montadaGastosEvento} />
      )}
      {tab === 'ingresos' && (
        <IngresosTab
          ingresos={montadaIngresos}
          onAdd={addIngreso}
          onUpdate={updateIngreso}
          onDelete={deleteIngreso}
        />
      )}
      {tab === 'gastos' && (
        <GastosTab
          gastos={montadaGastos}
          onAdd={(g) => addGasto({ ...g, id: uid(), createdAt: new Date().toISOString().slice(0, 10) })}
          onUpdate={updateGasto}
          onDelete={deleteGasto}
        />
      )}
    </div>
  );
};

// ── Resumen ───────────────────────────────────────────────────────────────────

const ResumenTab = ({
  ingresos,
  gastos,
  gastosEvento,
}: {
  ingresos: Ingreso[];
  gastos: Gasto[];
  gastosEvento: GastoEvento[];
}) => {
  const years   = useMemo(() => getAvailableYears([...ingresos, ...gastos]), [ingresos, gastos]);
  const [year, setYear]           = useState(years[0] ?? new Date().getFullYear());
  const [cobrosOpen, setCobrosOpen] = useState<number | null>(null); // mes expandido en cobros
  const monthly   = useMemo(() => buildMonthlyTable(ingresos, gastos, year), [ingresos, gastos, year]);

  // Enriquecer cada fila mensual con costes de evento, beneficio real y cobros
  const monthlyEnriched = useMemo(() => monthly.map((row) => {
    const ingMes = ingresos.filter((i) => {
      const d = new Date(i.fechaEvento);
      return d.getFullYear() === year && d.getMonth() + 1 === row.num;
    });
    const costesEvento  = ingMes.reduce((s, i) =>
      s + gastosEvento.filter((g) => g.ingresoId === i.id).reduce((s2, g) => s2 + g.importe, 0), 0);
    const beneficioReal = ingMes.reduce((s, i) => s + i.baseImponible, 0) - costesEvento;
    const cobrados      = ingMes.filter((i) => i.estadoPago === 'pagado');
    const pendientes    = ingMes.filter((i) => i.estadoPago !== 'pagado');
    const totalCobrado  = cobrados.reduce((s, i) => s + i.total, 0);
    const totalPendiente = pendientes.reduce((s, i) => s + Math.max(0, i.total - i.pagosRecibidos), 0);
    return { ...row, costesEvento, beneficioReal, cobrados, pendientes, totalCobrado, totalPendiente, ingMes };
  }), [monthly, ingresos, gastosEvento, year]);

  const totIng          = monthlyEnriched.reduce((s, r) => s + r.ing, 0);
  const totGas          = monthlyEnriched.reduce((s, r) => s + r.gTotal, 0);
  const totBenefReal    = monthlyEnriched.reduce((s, r) => s + r.beneficioReal, 0);
  const totPendiente    = monthlyEnriched.reduce((s, r) => s + r.totalPendiente, 0);
  const chartData       = monthlyEnriched.map((r) => ({ mes: r.label.slice(0, 3), ingresos: r.ing, gastos: r.gTotal, 'benef. real': r.beneficioReal }));
  let acum = 0;

  return (
    <div className="space-y-5">
      {/* ── KPIs rápidos ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-surface-800 border border-surface-400/20 rounded-xl px-4 py-3">
          <p className="text-xs text-zinc-500 mb-1">Ingresos (base)</p>
          <p className="text-lg font-bold text-green-400">{fmt(totIng)}</p>
        </div>
        <div className="bg-surface-800 border border-surface-400/20 rounded-xl px-4 py-3">
          <p className="text-xs text-zinc-500 mb-1">Gastos gles.</p>
          <p className="text-lg font-bold text-red-400">{fmt(totGas)}</p>
        </div>
        <div className="bg-surface-800 border border-surface-400/20 rounded-xl px-4 py-3">
          <p className="text-xs text-zinc-500 mb-1">Beneficio real eventos</p>
          <p className={`text-lg font-bold ${totBenefReal >= 0 ? 'text-gold-400' : 'text-red-400'}`}>{fmt(totBenefReal)}</p>
          <p className="text-xs text-zinc-600 mt-0.5">Base − costes evento</p>
        </div>
        <div className="bg-surface-800 border border-surface-400/20 rounded-xl px-4 py-3">
          <p className="text-xs text-zinc-500 mb-1">Pendiente de cobro</p>
          <p className={`text-lg font-bold ${totPendiente > 0 ? 'text-yellow-400' : 'text-green-400'}`}>{fmt(totPendiente)}</p>
          <p className="text-xs text-zinc-600 mt-0.5">{monthlyEnriched.flatMap((r) => r.pendientes).length} evento(s)</p>
        </div>
      </div>

      {/* Selector de año */}
      <div>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="bg-surface-700 border border-surface-400/30 text-white text-sm rounded-lg px-3 py-1.5 outline-none">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Gráfico */}
      <div className="bg-surface-800 border border-surface-400/20 rounded-xl p-5">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="mes" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtShort(Number(v))} />
            <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="ingresos" name="Ingresos" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            <Bar dataKey="gastos"   name="Gastos gles" fill="#ef4444" radius={[4, 4, 0, 0]} />
            <Bar dataKey="benef. real" name="Benef. real" fill="#22c55e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabla mensual enriquecida */}
      <div className="bg-surface-800 border border-surface-400/20 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead><tr className="border-b border-surface-400/20">
            <th className="text-left px-4 py-3 text-zinc-500">Mes</th>
            <th className="text-right px-4 py-3 text-zinc-500">Ingresos</th>
            <th className="text-right px-4 py-3 text-zinc-500">Costes ev.</th>
            <th className="text-right px-4 py-3 text-zinc-500">Benef. real</th>
            <th className="text-right px-4 py-3 text-zinc-500">G. Gles</th>
            <th className="text-right px-4 py-3 text-zinc-500">Cobrado</th>
            <th className="text-right px-4 py-3 text-zinc-500">Pendiente</th>
            <th className="text-right px-4 py-3 text-zinc-500">Acumulado</th>
          </tr></thead>
          <tbody>
            {monthlyEnriched.map((row) => { acum += row.balance; const hasData = row.ing > 0 || row.gTotal > 0; return (
              <tr key={row.num} className={`border-b border-surface-400/10 hover:bg-surface-700/50 ${!hasData ? 'opacity-40' : ''}`}>
                <td className="px-4 py-2.5 text-zinc-300 font-medium">{row.label}</td>
                <td className="px-4 py-2.5 text-right text-green-400">{row.ing > 0 ? fmt(row.ing) : '—'}</td>
                <td className="px-4 py-2.5 text-right text-red-400">{row.costesEvento > 0 ? fmt(row.costesEvento) : '—'}</td>
                <td className={`px-4 py-2.5 text-right font-semibold ${row.ing > 0 ? (row.beneficioReal >= 0 ? 'text-gold-400' : 'text-red-400') : 'text-zinc-600'}`}>
                  {row.ing > 0 ? fmt(row.beneficioReal) : '—'}
                </td>
                <td className="px-4 py-2.5 text-right text-zinc-400">{row.gTotal > 0 ? fmt(row.gTotal) : '—'}</td>
                <td className="px-4 py-2.5 text-right text-green-400">{row.totalCobrado > 0 ? fmt(row.totalCobrado) : '—'}</td>
                <td className="px-4 py-2.5 text-right">
                  {row.totalPendiente > 0
                    ? <span className="text-yellow-400 font-semibold">{fmt(row.totalPendiente)}</span>
                    : <span className="text-zinc-600">—</span>
                  }
                </td>
                <td className={`px-4 py-2.5 text-right font-semibold ${acum >= 0 ? 'text-blue-400' : 'text-red-400'}`}>{fmt(acum)}</td>
              </tr>
            ); })}
          </tbody>
          <tfoot><tr className="bg-surface-700/50 font-semibold">
            <td className="px-4 py-3 text-zinc-300">TOTAL</td>
            <td className="px-4 py-3 text-right text-green-400">{fmt(totIng)}</td>
            <td className="px-4 py-3 text-right text-red-400">{fmt(monthlyEnriched.reduce((s, r) => s + r.costesEvento, 0))}</td>
            <td className={`px-4 py-3 text-right ${totBenefReal >= 0 ? 'text-gold-400' : 'text-red-400'}`}>{fmt(totBenefReal)}</td>
            <td className="px-4 py-3 text-right text-zinc-400">{fmt(totGas)}</td>
            <td className="px-4 py-3 text-right text-green-400">{fmt(monthlyEnriched.reduce((s, r) => s + r.totalCobrado, 0))}</td>
            <td className={`px-4 py-3 text-right ${totPendiente > 0 ? 'text-yellow-400' : 'text-zinc-400'}`}>{fmt(totPendiente)}</td>
            <td className="px-4 py-3 text-right text-blue-400">{fmt(acum)}</td>
          </tr></tfoot>
        </table>
      </div>

      {/* ── Cobros pendientes por mes ── */}
      <div className="bg-surface-800 border border-surface-400/20 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-400/20 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Cobros pendientes {year}</h3>
          {totPendiente > 0 && (
            <span className="px-3 py-1 bg-yellow-500/10 text-yellow-400 text-sm font-semibold rounded-lg">{fmt(totPendiente)} por cobrar</span>
          )}
        </div>
        {monthlyEnriched.filter((r) => r.pendientes.length > 0 || r.cobrados.length > 0).length === 0 ? (
          <p className="p-8 text-center text-zinc-600 text-sm">Sin ingresos registrados en {year}</p>
        ) : (
          <div className="divide-y divide-surface-400/10">
            {monthlyEnriched.filter((r) => r.ingMes.length > 0).map((row) => (
              <div key={row.num}>
                {/* Cabecera del mes */}
                <button
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-700/40 transition-colors text-left"
                  onClick={() => setCobrosOpen(cobrosOpen === row.num ? null : row.num)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-zinc-300">{row.label}</span>
                    <span className="text-xs text-zinc-500">{row.ingMes.length} evento(s)</span>
                    {row.pendientes.length > 0 && (
                      <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 text-xs rounded-full font-medium">
                        {row.pendientes.length} pendiente(s)
                      </span>
                    )}
                    {row.pendientes.length === 0 && row.cobrados.length > 0 && (
                      <span className="px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded-full font-medium">✓ Todo cobrado</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-zinc-500">Cobrado: <span className="text-green-400 font-medium">{fmt(row.totalCobrado)}</span></span>
                    {row.totalPendiente > 0 && (
                      <span className="text-zinc-500">Pendiente: <span className="text-yellow-400 font-semibold">{fmt(row.totalPendiente)}</span></span>
                    )}
                    <span className={`text-zinc-400 transition-transform ${cobrosOpen === row.num ? 'rotate-90' : ''}`}>›</span>
                  </div>
                </button>

                {/* Detalle del mes */}
                {cobrosOpen === row.num && (
                  <div className="bg-surface-700/30 px-5 py-3 space-y-2">
                    {/* Cobrados */}
                    {row.cobrados.map((i) => (
                      <div key={i.id} className="flex items-center justify-between py-1.5 border-b border-surface-400/5 last:border-0">
                        <div className="flex items-center gap-3">
                          <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-zinc-200">{i.concepto}</p>
                            <p className="text-xs text-zinc-500">{i.cliente} · {fmtDate(i.fechaEvento)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-green-400">{fmt(i.total)}</p>
                          <p className="text-xs text-green-400/70">Cobrado ✓</p>
                        </div>
                      </div>
                    ))}
                    {/* Pendientes */}
                    {row.pendientes.map((i) => {
                      const restante = Math.max(0, i.total - i.pagosRecibidos);
                      const isParcial = i.estadoPago === 'parcial';
                      return (
                        <div key={i.id} className="flex items-center justify-between py-1.5 border-b border-surface-400/5 last:border-0">
                          <div className="flex items-center gap-3">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isParcial ? 'bg-orange-400' : 'bg-red-400'}`} />
                            <div>
                              <p className="text-sm text-zinc-200">{i.concepto}</p>
                              <p className="text-xs text-zinc-500">{i.cliente} · {fmtDate(i.fechaEvento)}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-white">{fmt(i.total)}</p>
                            <p className={`text-xs font-medium ${isParcial ? 'text-orange-400' : 'text-red-400'}`}>
                              {isParcial ? `${fmt(i.pagosRecibidos)} cobrado · ${fmt(restante)} pendiente` : 'Sin cobrar'}
                            </p>
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
    </div>
  );
};

// ── Ingresos ──────────────────────────────────────────────────────────────────

const IngresosTab = ({
  ingresos,
  onAdd,
  onUpdate,
  onDelete,
}: {
  ingresos: Ingreso[];
  onAdd: (i: Ingreso) => void;
  onUpdate: (id: string, i: Partial<Ingreso>) => void;
  onDelete: (id: string) => void;
}) => {
  const { gastosEvento } = useStore();
  const { year, setYear, month, prevMonth, nextMonth, years } = useYearMonth(ingresos);
  const showConfirm = useConfirmStore((s) => s.show);

  // Modal creación
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Omit<Ingreso, 'id' | 'createdAt'>>(emptyIngreso());

  // Modal detalle
  const [detailIngreso, setDetailIngreso] = useState<Ingreso | null>(null);

  const filtered = useMemo(() => {
    return ingresos
      .filter((i) => {
        const d = new Date(i.fechaEvento);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      })
      .sort((a, b) => b.fechaEvento.localeCompare(a.fechaEvento));
  }, [ingresos, year, month]);

  const totBase  = filtered.reduce((s, i) => s + i.baseImponible, 0);
  const totIVA   = filtered.reduce((s, i) => s + i.importeIVA, 0);
  const totTotal = filtered.reduce((s, i) => s + i.total, 0);

  const exportXlsx = () => {
    const all = ingresos.filter((i) => new Date(i.fechaEvento).getFullYear() === year);
    const rows = all.map((i) => {
      const costes = gastosEvento.filter((g) => g.ingresoId === i.id).reduce((s, g) => s + g.importe, 0);
      return {
        Fecha: i.fechaEvento, Concepto: i.concepto, Cliente: i.cliente, Tipo: i.tipoEvento,
        'Base imp.': i.baseImponible, 'IVA %': i.porcentajeIVA, IVA: i.importeIVA, Total: i.total,
        'Factura': i.facturaEmitida ? 'Sí' : 'No', 'Nº Factura': i.numeroFactura ?? '',
        Estado: i.estadoPago, Costes: costes, Beneficio: i.baseImponible - costes,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ingresos Montada');
    XLSX.writeFile(wb, `montada-ingresos-${year}.xlsx`);
  };

  const setField = (k: keyof typeof form, v: unknown) => setForm((f) => {
    const next = { ...f, [k]: v };
    if (k === 'baseImponible' || k === 'porcentajeIVA') {
      const r = calcIVA(Number(next.baseImponible), Number(next.porcentajeIVA));
      return { ...next, ...r };
    }
    return next;
  });

  const saveNew = () => {
    const newId = uid();
    const newIngreso: Ingreso = { ...form, id: newId, createdAt: new Date().toISOString().slice(0, 10) };
    onAdd(newIngreso);
    setModal(false);
    setForm(emptyIngreso());
    // Abrir detalle automáticamente para que el usuario pueda añadir costes
    setDetailIngreso(newIngreso);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="bg-surface-700 border border-surface-400/30 text-white text-sm rounded-lg px-3 py-1.5 outline-none">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-surface-600"><ChevronLeft size={16} /></button>
          <span className="px-3 py-1 bg-surface-700 border border-surface-400/30 rounded-lg text-white text-sm font-medium min-w-[100px] text-center">{getMonthName(month)}</span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-surface-600"><ChevronRight size={16} /></button>
        </div>
        <div className="flex gap-3 ml-1 text-sm text-zinc-400 flex-wrap">
          <span>Base: <span className="text-green-400 font-semibold">{fmt(totBase)}</span></span>
          <span>IVA: <span className="text-zinc-300">{fmt(totIVA)}</span></span>
          <span>Total: <span className="text-white font-semibold">{fmt(totTotal)}</span></span>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={exportXlsx} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-700 border border-surface-400/30 text-zinc-300 text-sm rounded-lg hover:text-white">
            <Download size={13} /> Excel
          </button>
          <button
            onClick={() => { setForm(emptyIngreso()); setModal(true); }}
            className="flex items-center gap-2 px-3 py-1.5 bg-gold-500 text-black text-sm font-semibold rounded-lg hover:bg-gold-400"
          >
            <Plus size={15} /> Nuevo ingreso
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-surface-800 border border-surface-400/20 rounded-xl overflow-hidden overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">Sin ingresos en {getMonthName(month)} {year}</div>
        ) : (
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-surface-400/20">
                <th className="text-left px-4 py-3 text-zinc-500">Concepto / Cliente</th>
                <th className="text-left px-4 py-3 text-zinc-500">Tipo</th>
                <th className="text-right px-4 py-3 text-zinc-500">Base imp.</th>
                <th className="text-right px-4 py-3 text-zinc-500">IVA</th>
                <th className="text-right px-4 py-3 text-zinc-500">Total</th>
                <th className="text-center px-4 py-3 text-zinc-500">Factura</th>
                <th className="text-left px-4 py-3 text-zinc-500">Estado</th>
                <th className="text-right px-4 py-3 text-zinc-500">Costes</th>
                <th className="text-right px-4 py-3 text-zinc-500">Beneficio</th>
                <th className="px-4 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => {
                const costes    = gastosEvento.filter((g) => g.ingresoId === i.id).reduce((s, g) => s + g.importe, 0);
                const beneficio = i.baseImponible - costes;
                const hasCostes = costes > 0;

                return (
                  <tr
                    key={i.id}
                    className="border-b border-surface-400/10 hover:bg-surface-700/40 cursor-pointer transition-colors"
                    onClick={() => setDetailIngreso(i)}
                  >
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{i.concepto}</p>
                      <p className="text-xs text-zinc-500">{i.cliente} · {fmtDate(i.fechaEvento)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${EVENT_TYPE_COLORS[i.tipoEvento] ?? 'bg-zinc-500/10 text-zinc-400'}`}>
                        {EVENT_TYPE_LABELS[i.tipoEvento]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-green-400 font-medium">{fmt(i.baseImponible)}</td>
                    <td className="px-4 py-3 text-right text-zinc-400 text-xs">{i.porcentajeIVA}%<br />{fmt(i.importeIVA)}</td>
                    <td className="px-4 py-3 text-right text-white font-semibold">{fmt(i.total)}</td>
                    <td className="px-4 py-3 text-center">
                      {i.facturaEmitida
                        ? <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-500/15 text-green-400">{i.numeroFactura ? i.numeroFactura : 'Sí'}</span>
                        : <span className="px-2 py-0.5 rounded text-xs font-medium bg-zinc-500/10 text-zinc-500">No</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${PAYMENT_STATUS_COLORS[i.estadoPago]}`}>
                        {PAYMENT_STATUS_LABELS[i.estadoPago]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {hasCostes
                        ? <span className="text-red-400 font-medium">{fmt(costes)}</span>
                        : <span className="text-zinc-600 text-xs">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right">
                      {hasCostes
                        ? <span className={`font-semibold ${beneficio >= 0 ? 'text-gold-400' : 'text-red-400'}`}>{fmt(beneficio)}</span>
                        : <span className="text-zinc-600 text-xs">—</span>
                      }
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={(e) => { e.stopPropagation(); setDetailIngreso(i); }}
                          className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-surface-600"
                          title="Editar / ver detalle"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); showConfirm('¿Eliminar este ingreso? Esta acción no se puede deshacer.', () => onDelete(i.id)); }}
                          className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-400/10"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Nota */}
      <p className="text-xs text-zinc-600">Haz clic en cualquier fila para editar el evento, gestionar costes y pagos, y ver el resumen financiero.</p>

      {/* Modal nuevo ingreso */}
      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo ingreso" width="max-w-2xl">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-xs text-zinc-400 mb-1 block">Concepto *</label>
            <input value={form.concepto} onChange={(e) => setField('concepto', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-gold-500/50" placeholder="Ej: Sonorización boda García, DJ Set privado..." />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Cliente *</label>
            <input value={form.cliente} onChange={(e) => setField('cliente', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Tipo de evento</label>
            <select value={form.tipoEvento} onChange={(e) => setField('tipoEvento', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none">
              {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Fecha del evento *</label>
            <input type="date" value={form.fechaEvento} onChange={(e) => setField('fechaEvento', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Base imponible (€)</label>
            <input type="number" value={form.baseImponible || ''} onChange={(e) => setField('baseImponible', Number(e.target.value))} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" placeholder="0.00" />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">% IVA</label>
            <select value={form.porcentajeIVA} onChange={(e) => setField('porcentajeIVA', Number(e.target.value))} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none">
              {[0, 4, 10, 21].map((p) => <option key={p} value={p}>{p}%</option>)}
            </select>
          </div>
          <div className="col-span-2 bg-surface-600/50 rounded-lg px-4 py-2.5 flex gap-6 text-sm">
            <span className="text-zinc-400">IVA: <span className="text-white">{fmt(form.importeIVA)}</span></span>
            <span className="text-zinc-400">Total: <span className="text-gold-400 font-bold">{fmt(form.total)}</span></span>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Método de pago</label>
            <select value={form.metodoPago} onChange={(e) => setField('metodoPago', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none">
              {Object.entries(METODO_PAGO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Estado de cobro</label>
            <select value={form.estadoPago} onChange={(e) => setField('estadoPago', e.target.value as Ingreso['estadoPago'])} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none">
              <option value="pendiente">Pendiente</option>
              <option value="parcial">Parcial</option>
              <option value="pagado">Cobrado</option>
            </select>
          </div>
          <div className="col-span-2 flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.facturaEmitida} onChange={(e) => setField('facturaEmitida', e.target.checked)} className="accent-gold-500 w-4 h-4" />
              <span className="text-sm font-medium text-white">Factura emitida: <span className={form.facturaEmitida ? 'text-green-400' : 'text-zinc-500'}>{form.facturaEmitida ? 'Sí' : 'No'}</span></span>
            </label>
            {form.facturaEmitida && (
              <input value={form.numeroFactura ?? ''} onChange={(e) => setField('numeroFactura', e.target.value)} className="flex-1 bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none font-mono" placeholder="Nº factura" />
            )}
          </div>
          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">Cancelar</button>
            <button onClick={saveNew} className="px-4 py-2 bg-gold-500 text-black text-sm font-semibold rounded-lg hover:bg-gold-400">
              Crear ingreso →
            </button>
          </div>
        </div>
        <p className="text-xs text-zinc-600 mt-3 text-center">Al guardar podrás añadir costes del evento en el detalle</p>
      </Modal>

      {/* Modal detalle */}
      <EventoDetailModal
        ingreso={detailIngreso}
        onClose={() => setDetailIngreso(null)}
        onUpdate={onUpdate}
      />
    </div>
  );
};

// ── Gastos generales ──────────────────────────────────────────────────────────

const GastosTab = ({
  gastos, onAdd, onUpdate, onDelete,
}: {
  gastos: Gasto[];
  onAdd: (g: Omit<Gasto, 'id' | 'createdAt'>) => void;
  onUpdate: (id: string, g: Partial<Gasto>) => void;
  onDelete: (id: string) => void;
}) => {
  const { year, setYear, month, prevMonth, nextMonth, years } = useYearMonth(gastos);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Omit<Gasto, 'id' | 'createdAt'>>(emptyGasto());
  const [editId, setEditId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [cellVal, setCellVal] = useState('');
  const showConfirm = useConfirmStore((s) => s.show);

  const filtered = useMemo(() =>
    gastos
      .filter((g) => { const d = new Date(g.fecha); return d.getFullYear() === year && d.getMonth() + 1 === month; })
      .sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [gastos, year, month],
  );

  const totBase = filtered.reduce((s, g) => s + g.baseImponible, 0);
  const totIVA  = filtered.reduce((s, g) => s + g.importeIVA, 0);

  const exportXlsx = () => {
    const all = gastos.filter((g) => new Date(g.fecha).getFullYear() === year);
    const rows = all.map((g) => ({ Fecha: g.fecha, Concepto: g.concepto, Categoría: g.categoria, Tipo: g.tipo, 'Base imp.': g.baseImponible, 'IVA %': g.porcentajeIVA, IVA: g.importeIVA, Total: g.total, Proveedor: g.proveedor ?? '', Deducible: g.deducible ? 'Sí' : 'No' }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Gastos Montada');
    XLSX.writeFile(wb, `montada-gastos-${year}.xlsx`);
  };

  const openNew  = () => { setForm(emptyGasto()); setEditId(null); setModal(true); };
  const openEdit = (g: Gasto) => { setForm({ ...g }); setEditId(g.id); setModal(true); };
  const setField = (k: keyof typeof form, v: unknown) => setForm((f) => {
    const next = { ...f, [k]: v };
    if (k === 'baseImponible' || k === 'porcentajeIVA') { const r = calcIVA(Number(next.baseImponible), Number(next.porcentajeIVA)); return { ...next, ...r }; }
    return next;
  });
  const save = () => { if (editId) onUpdate(editId, form); else onAdd(form); setModal(false); };

  const startEdit  = (g: Gasto, field: string, val: string) => { setEditingCell({ id: g.id, field }); setCellVal(val); };
  const commitEdit = (g: Gasto) => {
    if (!editingCell) return;
    const { field } = editingCell;
    if (field === 'concepto') onUpdate(g.id, { concepto: cellVal });
    else if (field === 'baseImponible') { const base = Number(cellVal); const r = calcIVA(base, g.porcentajeIVA); onUpdate(g.id, { baseImponible: base, ...r }); }
    else if (field === 'proveedor') onUpdate(g.id, { proveedor: cellVal });
    setEditingCell(null);
  };

  const EC = ({ g, field, val, right = false }: { g: Gasto; field: string; val: string; right?: boolean }) => {
    const active = editingCell?.id === g.id && editingCell?.field === field;
    if (active) return (
      <td className={`px-3 py-2 ${right ? 'text-right' : ''}`}>
        <div className="flex items-center gap-1">
          <input autoFocus value={cellVal} onChange={(e) => setCellVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(g); if (e.key === 'Escape') setEditingCell(null); }} className="w-full bg-surface-600 border border-gold-500/50 rounded px-2 py-1 text-white text-xs outline-none" />
          <button onClick={() => commitEdit(g)} className="text-green-400 flex-shrink-0"><Check size={12} /></button>
          <button onClick={() => setEditingCell(null)} className="text-zinc-500 flex-shrink-0"><X size={12} /></button>
        </div>
      </td>
    );
    return <td className={`px-3 py-2 ${right ? 'text-right' : ''} cursor-pointer hover:bg-surface-600/50 group`} onDoubleClick={() => startEdit(g, field, val)}><span className="group-hover:text-gold-400 transition-colors">{val}</span></td>;
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl px-4 py-3 text-xs text-blue-400">
        <strong>Gastos generales de empresa</strong> — Marketing, software, gestoría, material de oficina, etc.
        Los costes de cada evento se registran dentro del propio evento (pestaña Ingresos → clic en fila).
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="bg-surface-700 border border-surface-400/30 text-white text-sm rounded-lg px-3 py-1.5 outline-none">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-surface-600"><ChevronLeft size={16} /></button>
          <span className="px-3 py-1 bg-surface-700 border border-surface-400/30 rounded-lg text-white text-sm font-medium min-w-[100px] text-center">{getMonthName(month)}</span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-surface-600"><ChevronRight size={16} /></button>
        </div>
        <div className="flex gap-3 ml-2 text-sm text-zinc-400">
          <span>Base: <span className="text-red-400 font-semibold">{fmt(totBase)}</span></span>
          <span>IVA: <span className="text-zinc-300">{fmt(totIVA)}</span></span>
          <span className="text-xs text-zinc-600">Doble clic para editar inline</span>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={exportXlsx} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-700 border border-surface-400/30 text-zinc-300 text-sm rounded-lg hover:text-white"><Download size={13} />Excel</button>
          <button onClick={openNew} className="flex items-center gap-2 px-3 py-1.5 bg-gold-500 text-black text-sm font-semibold rounded-lg hover:bg-gold-400"><Plus size={15} /> Nuevo gasto</button>
        </div>
      </div>

      <div className="bg-surface-800 border border-surface-400/20 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">Sin gastos generales en {getMonthName(month)} {year}</div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-surface-400/20">
              <th className="text-left px-3 py-3 text-zinc-500">Fecha</th>
              <th className="text-left px-3 py-3 text-zinc-500">Concepto</th>
              <th className="text-left px-3 py-3 text-zinc-500">Cat.</th>
              <th className="text-left px-3 py-3 text-zinc-500">Tipo</th>
              <th className="text-right px-3 py-3 text-zinc-500">Base</th>
              <th className="text-right px-3 py-3 text-zinc-500">IVA</th>
              <th className="text-right px-3 py-3 text-zinc-500">Total</th>
              <th className="text-left px-3 py-3 text-zinc-500">Proveedor</th>
              <th className="text-center px-3 py-3 text-zinc-500">Ded.</th>
              <th className="px-3 py-3"></th>
            </tr></thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.id} className="border-b border-surface-400/10 hover:bg-surface-700/30 text-xs">
                  <td className="px-3 py-2 text-zinc-400">{fmtDate(g.fecha)}</td>
                  <EC g={g} field="concepto" val={g.concepto} />
                  <td className="px-3 py-2 text-zinc-500">{g.categoria}</td>
                  <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs ${g.tipo === 'fijo' ? 'bg-blue-500/10 text-blue-400' : 'bg-orange-500/10 text-orange-400'}`}>{g.tipo}</span></td>
                  <EC g={g} field="baseImponible" val={g.baseImponible.toFixed(2)} right />
                  <td className="px-3 py-2 text-right text-zinc-500">{g.porcentajeIVA}% · {fmt(g.importeIVA)}</td>
                  <td className="px-3 py-2 text-right text-red-400 font-medium">{fmt(g.total)}</td>
                  <EC g={g} field="proveedor" val={g.proveedor ?? '—'} />
                  <td className="px-3 py-2 text-center">{g.deducible ? <Check size={12} className="text-green-400 mx-auto" /> : <X size={12} className="text-zinc-600 mx-auto" />}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(g)} className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-surface-600"><Edit2 size={12} /></button>
                      <button onClick={() => showConfirm('¿Eliminar este gasto? Esta acción no se puede deshacer.', () => onDelete(g.id))} className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-400/10"><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Editar gasto general' : 'Nuevo gasto general'} width="max-w-2xl">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Fecha *</label>
            <input type="date" value={form.fecha} onChange={(e) => setField('fecha', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Categoría</label>
            <select value={form.categoria} onChange={(e) => setField('categoria', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none">
              {GASTO_CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-zinc-400 mb-1 block">Concepto *</label>
            <input value={form.concepto} onChange={(e) => setField('concepto', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Tipo</label>
            <select value={form.tipo} onChange={(e) => setField('tipo', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none">
              <option value="fijo">Fijo</option>
              <option value="variable">Variable</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Proveedor</label>
            <input value={form.proveedor ?? ''} onChange={(e) => setField('proveedor', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Base imponible (€)</label>
            <input type="number" value={form.baseImponible || ''} onChange={(e) => setField('baseImponible', Number(e.target.value))} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" placeholder="0.00" />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">% IVA</label>
            <select value={form.porcentajeIVA} onChange={(e) => setField('porcentajeIVA', Number(e.target.value))} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none">
              {[0, 4, 10, 21].map((p) => <option key={p} value={p}>{p}%</option>)}
            </select>
          </div>
          <div className="col-span-2 bg-surface-600/50 rounded-lg px-4 py-2 flex gap-6 text-sm">
            <span className="text-zinc-400">IVA: <span className="text-white">{fmt(form.importeIVA)}</span></span>
            <span className="text-zinc-400">Total: <span className="text-red-400 font-bold">{fmt(form.total)}</span></span>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Método de pago</label>
            <select value={form.metodoPago} onChange={(e) => setField('metodoPago', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none">
              {Object.entries(METODO_PAGO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2 pt-4">
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
              <input type="checkbox" checked={form.facturaRecibida} onChange={(e) => setField('facturaRecibida', e.target.checked)} className="accent-gold-500" /> Factura recibida
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
              <input type="checkbox" checked={form.deducible} onChange={(e) => setField('deducible', e.target.checked)} className="accent-gold-500" /> IVA deducible
            </label>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-zinc-400 mb-1 block">Observaciones</label>
            <textarea value={form.observaciones ?? ''} onChange={(e) => setField('observaciones', e.target.value)} rows={2} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none resize-none" />
          </div>
          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">Cancelar</button>
            <button onClick={save} className="px-4 py-2 bg-gold-500 text-black text-sm font-semibold rounded-lg hover:bg-gold-400">{editId ? 'Guardar cambios' : 'Añadir gasto'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
