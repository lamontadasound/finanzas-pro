import { useState, useMemo } from 'react';
import { Plus, ChevronLeft, ChevronRight, Trash2, Edit2, Check, X, Download, BarChart2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import * as XLSX from 'xlsx';
import { useStore } from '../store/useStore';
import { fmt, fmtShort, fmtDate, uid, buildMonthlyTable, getAvailableYears, getMonthName, EVENT_TYPE_LABELS, EVENT_TYPE_COLORS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS, GASTO_CATEGORIAS, METODO_PAGO_LABELS, calcIVA, useYearMonth } from '../utils/helpers';
import { Modal } from '../components/ui/Modal';
import { EventoDetailModal } from '../components/ui/EventoDetailModal';
import { useConfirmStore } from '../store/useConfirmStore';
import type { Ingreso, Gasto, Suplido } from '../types';

type Tab = 'resumen' | 'ingresos' | 'gastos' | 'suplidos';
const TABS: { id: Tab; label: string }[] = [{ id: 'resumen', label: 'Resumen' }, { id: 'ingresos', label: 'Ingresos' }, { id: 'gastos', label: 'Gastos' }, { id: 'suplidos', label: 'Suplidos' }];

const emptyIngreso = (): Omit<Ingreso, 'id' | 'createdAt'> => ({
  area: 'dj', concepto: '', cliente: '', tipoEvento: 'dj_personal',
  fechaEvento: new Date().toISOString().slice(0, 10),
  baseImponible: 0, porcentajeIVA: 21, importeIVA: 0, total: 0,
  metodoPago: 'efectivo', estadoPago: 'pendiente', pagosRecibidos: 0, facturaEmitida: false,
});

const emptyGasto = (): Omit<Gasto, 'id' | 'createdAt'> => ({
  area: 'dj', fecha: new Date().toISOString().slice(0, 10),
  concepto: '', categoria: 'Otros', tipo: 'variable',
  baseImponible: 0, porcentajeIVA: 21, importeIVA: 0, total: 0,
  metodoPago: 'efectivo', facturaRecibida: false, deducible: true,
});

const emptySuplido = (): Omit<Suplido, 'id' | 'createdAt'> => ({
  area: 'dj', fecha: new Date().toISOString().slice(0, 10),
  cliente: '', concepto: '', importe: 0, metodoPago: 'efectivo', justificante: false,
});


const MonthNav = ({ year, years, month, prevMonth, nextMonth, setYear }: { year: number; years: number[]; month: number; prevMonth: () => void; nextMonth: () => void; setYear: (y: number) => void }) => (
  <div className="flex items-center gap-2">
    <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="bg-surface-700 border border-surface-400/30 text-white text-sm rounded-lg px-3 py-1.5 outline-none">
      {years.map((y) => <option key={y} value={y}>{y}</option>)}
    </select>
    <button onClick={prevMonth} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-surface-600"><ChevronLeft size={16} /></button>
    <span className="px-3 py-1 bg-surface-700 border border-surface-400/30 rounded-lg text-white text-sm font-medium min-w-[100px] text-center">{getMonthName(month)}</span>
    <button onClick={nextMonth} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-surface-600"><ChevronRight size={16} /></button>
  </div>
);

export const DJPersonal = () => {
  const { ingresos, gastos, suplidos, addIngreso, updateIngreso, deleteIngreso, addGasto, updateGasto, deleteGasto, addSuplido, updateSuplido, deleteSuplido } = useStore();
  const [tab, setTab] = useState<Tab>('resumen');
  const djIngresos = useMemo(() => ingresos.filter((i) => i.area === 'dj'), [ingresos]);
  const djGastos = useMemo(() => gastos.filter((g) => g.area === 'dj'), [gastos]);
  const djSuplidos = useMemo(() => suplidos.filter((s) => s.area === 'dj'), [suplidos]);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">DJ Personal</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Actividad independiente de DJ — separada de la empresa</p>
      </div>
      <div className="flex gap-1 bg-surface-800 border border-surface-400/20 rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-gold-500/15 text-gold-400' : 'text-zinc-500 hover:text-zinc-200'}`}>{t.label}</button>
        ))}
      </div>
      {tab === 'resumen' && <ResumenTab ingresos={djIngresos} gastos={djGastos} />}
      {tab === 'ingresos' && <IngresosTab ingresos={djIngresos} onAdd={(i) => addIngreso({ ...i, id: uid(), createdAt: new Date().toISOString().slice(0, 10) })} onUpdate={updateIngreso} onDelete={deleteIngreso} />}
      {tab === 'gastos' && <GastosTab gastos={djGastos} onAdd={(g) => addGasto({ ...g, id: uid(), createdAt: new Date().toISOString().slice(0, 10) })} onUpdate={updateGasto} onDelete={deleteGasto} />}
      {tab === 'suplidos' && <SuplidosTab suplidos={djSuplidos} onAdd={(s) => addSuplido({ ...s, id: uid(), createdAt: new Date().toISOString().slice(0, 10) })} onUpdate={updateSuplido} onDelete={deleteSuplido} />}
    </div>
  );
};

const ResumenTab = ({ ingresos, gastos }: { ingresos: Ingreso[]; gastos: Gasto[] }) => {
  const years = useMemo(() => getAvailableYears([...ingresos, ...gastos]), [ingresos, gastos]);
  const [year, setYear] = useState(years[0] ?? new Date().getFullYear());
  const monthly = useMemo(() => buildMonthlyTable(ingresos, gastos, year), [ingresos, gastos, year]);
  const chartData = monthly.map((r) => ({ mes: r.label.slice(0, 3), ingresos: r.ing, gastos: r.gTotal }));
  const totIng = monthly.reduce((s, r) => s + r.ing, 0);
  const totGas = monthly.reduce((s, r) => s + r.gTotal, 0);
  let acum = 0;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="bg-surface-700 border border-surface-400/30 text-white text-sm rounded-lg px-3 py-1.5 outline-none">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="text-sm text-zinc-400">Ingresos: <span className="text-green-400 font-semibold">{fmt(totIng)}</span></span>
        <span className="text-sm text-zinc-400">Gastos: <span className="text-red-400 font-semibold">{fmt(totGas)}</span></span>
        <span className="text-sm text-zinc-400">Balance: <span className={`font-semibold ${totIng - totGas >= 0 ? 'text-gold-400' : 'text-red-400'}`}>{fmt(totIng - totGas)}</span></span>
      </div>
      <div className="bg-surface-800 border border-surface-400/20 rounded-xl p-5">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="mes" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: any) => fmtShort(Number(v))} />
            <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="ingresos" name="Ingresos" fill="#a78bfa" radius={[4, 4, 0, 0]} />
            <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-surface-800 border border-surface-400/20 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-surface-400/20">
            <th className="text-left px-4 py-3 text-zinc-500">Mes</th>
            <th className="text-right px-4 py-3 text-zinc-500">Ingresos</th>
            <th className="text-right px-4 py-3 text-zinc-500">G. Fijos</th>
            <th className="text-right px-4 py-3 text-zinc-500">G. Variables</th>
            <th className="text-right px-4 py-3 text-zinc-500">Balance</th>
            <th className="text-right px-4 py-3 text-zinc-500">Acumulado</th>
          </tr></thead>
          <tbody>
            {monthly.map((row) => { acum += row.balance; return (
              <tr key={row.num} className={`border-b border-surface-400/10 hover:bg-surface-700/50 ${row.ing === 0 && row.gTotal === 0 ? 'opacity-40' : ''}`}>
                <td className="px-4 py-2.5 text-zinc-300 font-medium">{row.label}</td>
                <td className="px-4 py-2.5 text-right text-purple-400">{row.ing > 0 ? fmt(row.ing) : '—'}</td>
                <td className="px-4 py-2.5 text-right text-red-400">{row.gFijo > 0 ? fmt(row.gFijo) : '—'}</td>
                <td className="px-4 py-2.5 text-right text-orange-400">{row.gVar > 0 ? fmt(row.gVar) : '—'}</td>
                <td className={`px-4 py-2.5 text-right font-semibold ${row.balance >= 0 ? 'text-gold-400' : 'text-red-400'}`}>{row.ing > 0 || row.gTotal > 0 ? fmt(row.balance) : '—'}</td>
                <td className={`px-4 py-2.5 text-right font-semibold ${acum >= 0 ? 'text-blue-400' : 'text-red-400'}`}>{fmt(acum)}</td>
              </tr>
            ); })}
          </tbody>
          <tfoot><tr className="bg-surface-700/50 font-semibold">
            <td className="px-4 py-3 text-zinc-300">TOTAL</td>
            <td className="px-4 py-3 text-right text-purple-400">{fmt(totIng)}</td>
            <td className="px-4 py-3 text-right text-red-400">{fmt(monthly.reduce((s, r) => s + r.gFijo, 0))}</td>
            <td className="px-4 py-3 text-right text-orange-400">{fmt(monthly.reduce((s, r) => s + r.gVar, 0))}</td>
            <td className={`px-4 py-3 text-right ${totIng - totGas >= 0 ? 'text-gold-400' : 'text-red-400'}`}>{fmt(totIng - totGas)}</td>
            <td className="px-4 py-3 text-right text-blue-400">{fmt(acum)}</td>
          </tr></tfoot>
        </table>
      </div>
    </div>
  );
};

const IngresosTab = ({ ingresos, onAdd, onUpdate, onDelete }: { ingresos: Ingreso[]; onAdd: (i: Omit<Ingreso, 'id' | 'createdAt'>) => void; onUpdate: (id: string, i: Partial<Ingreso>) => void; onDelete: (id: string) => void }) => {
  const { gastosEvento, pagosEvento } = useStore();
  const { year, setYear, month, prevMonth, nextMonth, years } = useYearMonth(ingresos);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Omit<Ingreso, 'id' | 'createdAt'>>(emptyIngreso());
  const [editId, setEditId] = useState<string | null>(null);
  const [detailIngreso, setDetailIngreso] = useState<Ingreso | null>(null);
  const showConfirm = useConfirmStore((s) => s.show);

  const filtered = useMemo(() => ingresos.filter((i) => { const d = new Date(i.fechaEvento); return d.getFullYear() === year && d.getMonth() + 1 === month; }), [ingresos, year, month]);
  const totBase = filtered.reduce((s, i) => s + i.baseImponible, 0);
  const totTotal = filtered.reduce((s, i) => s + i.total, 0);

  const exportXlsx = () => {
    const all = ingresos.filter((i) => new Date(i.fechaEvento).getFullYear() === year);
    const rows = all.map((i) => ({ Fecha: i.fechaEvento, Concepto: i.concepto, Cliente: i.cliente, 'Base imp.': i.baseImponible, 'IVA %': i.porcentajeIVA, IVA: i.importeIVA, Total: i.total, Estado: i.estadoPago }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ingresos DJ');
    XLSX.writeFile(wb, `dj-ingresos-${year}.xlsx`);
  };

  const openNew = () => { setForm(emptyIngreso()); setEditId(null); setModal(true); };
  const openEdit = (i: Ingreso) => { setForm({ ...i }); setEditId(i.id); setModal(true); };
  const openDetail = (i: Ingreso) => setDetailIngreso(i);
  const setField = (k: keyof typeof form, v: any) => setForm((f) => {
    const next = { ...f, [k]: v };
    if (k === 'baseImponible' || k === 'porcentajeIVA') { const r = calcIVA(Number(next.baseImponible), Number(next.porcentajeIVA)); return { ...next, ...r }; }
    return next;
  });
  const save = () => { if (editId) onUpdate(editId, form); else onAdd(form); setModal(false); };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <MonthNav year={year} years={years} month={month} prevMonth={prevMonth} nextMonth={nextMonth} setYear={setYear} />
        <div className="flex gap-3 ml-2 text-sm text-zinc-400">
          <span>Base: <span className="text-purple-400 font-semibold">{fmt(totBase)}</span></span>
          <span>Total c/IVA: <span className="text-white font-semibold">{fmt(totTotal)}</span></span>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={exportXlsx} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-700 border border-surface-400/30 text-zinc-300 text-sm rounded-lg hover:text-white"><Download size={13} />Excel</button>
          <button onClick={openNew} className="flex items-center gap-2 px-3 py-1.5 bg-gold-500 text-black text-sm font-semibold rounded-lg hover:bg-gold-400"><Plus size={15} /> Nuevo ingreso</button>
        </div>
      </div>
      <div className="bg-surface-800 border border-surface-400/20 rounded-xl overflow-hidden">
        {filtered.length === 0 ? <div className="p-12 text-center text-zinc-500">Sin ingresos en {getMonthName(month)} {year}</div> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-surface-400/20">
              <th className="text-left px-4 py-3 text-zinc-500">Concepto / Cliente</th>
              <th className="text-left px-4 py-3 text-zinc-500">Tipo</th>
              <th className="text-right px-4 py-3 text-zinc-500">Base imp.</th>
              <th className="text-right px-4 py-3 text-zinc-500">Total</th>
              <th className="text-right px-4 py-3 text-zinc-500">Cobrado</th>
              <th className="text-right px-4 py-3 text-zinc-500">Costes</th>
              <th className="text-right px-4 py-3 text-zinc-500">Beneficio</th>
              <th className="text-right px-4 py-3 text-zinc-500">Margen</th>
              <th className="text-left px-4 py-3 text-zinc-500">Estado</th>
              <th className="px-4 py-3"></th>
            </tr></thead>
            <tbody>
              {filtered.map((i) => {
                const costes = gastosEvento.filter((g) => g.ingresoId === i.id).reduce((s, g) => s + g.importe, 0);
                const cobrado = pagosEvento.filter((p) => p.ingresoId === i.id).reduce((s, p) => s + p.importe, 0);
                const beneficio = i.baseImponible - costes;
                const margen = i.baseImponible > 0 ? (beneficio / i.baseImponible) * 100 : 0;
                return (
                  <tr key={i.id} className="border-b border-surface-400/10 hover:bg-surface-700/50">
                    <td className="px-4 py-3"><p className="text-white font-medium">{i.concepto}</p><p className="text-xs text-zinc-500">{i.cliente} · {fmtDate(i.fechaEvento)}</p></td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${EVENT_TYPE_COLORS[i.tipoEvento] ?? 'bg-zinc-500/10 text-zinc-400'}`}>{EVENT_TYPE_LABELS[i.tipoEvento]}</span></td>
                    <td className="px-4 py-3 text-right text-purple-400 font-medium">{fmt(i.baseImponible)}</td>
                    <td className="px-4 py-3 text-right text-white font-semibold">{fmt(i.total)}</td>
                    <td className="px-4 py-3 text-right text-blue-400">{cobrado > 0 ? fmt(cobrado) : <span className="text-zinc-600">—</span>}</td>
                    <td className="px-4 py-3 text-right text-red-400">{costes > 0 ? fmt(costes) : <span className="text-zinc-600">—</span>}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${costes > 0 ? (beneficio >= 0 ? 'text-gold-400' : 'text-red-400') : 'text-zinc-600'}`}>{costes > 0 ? fmt(beneficio) : '—'}</td>
                    <td className={`px-4 py-3 text-right text-xs font-semibold ${costes > 0 ? (margen >= 30 ? 'text-green-400' : margen >= 10 ? 'text-gold-400' : 'text-red-400') : 'text-zinc-600'}`}>{costes > 0 ? `${margen.toFixed(0)}%` : '—'}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${PAYMENT_STATUS_COLORS[i.estadoPago]}`}>{PAYMENT_STATUS_LABELS[i.estadoPago]}</span></td>
                    <td className="px-4 py-3"><div className="flex gap-1">
                      <button onClick={() => openDetail(i)} className="p-1.5 rounded text-zinc-500 hover:text-gold-400 hover:bg-gold-500/10" title="Ver detalle financiero"><BarChart2 size={13} /></button>
                      <button onClick={() => openEdit(i)} className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-surface-600"><Edit2 size={13} /></button>
                      <button onClick={() => showConfirm('¿Eliminar este ingreso? Esta acción no se puede deshacer.', () => onDelete(i.id))} className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-400/10"><Trash2 size={13} /></button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Editar ingreso' : 'Nuevo ingreso DJ'} width="max-w-2xl">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="text-xs text-zinc-400 mb-1 block">Concepto *</label><input value={form.concepto} onChange={(e) => setField('concepto', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" /></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Cliente *</label><input value={form.cliente} onChange={(e) => setField('cliente', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" /></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Tipo</label><select value={form.tipoEvento} onChange={(e) => setField('tipoEvento', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none">{Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Fecha *</label><input type="date" value={form.fechaEvento} onChange={(e) => setField('fechaEvento', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" /></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Base imponible (€)</label><input type="number" value={form.baseImponible} onChange={(e) => setField('baseImponible', Number(e.target.value))} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" /></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">% IVA</label><select value={form.porcentajeIVA} onChange={(e) => setField('porcentajeIVA', Number(e.target.value))} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none">{[0, 4, 10, 21].map((p) => <option key={p} value={p}>{p}%</option>)}</select></div>
          <div className="col-span-2 bg-surface-600/50 rounded-lg px-4 py-2 flex gap-6 text-sm"><span className="text-zinc-400">IVA: <span className="text-white">{fmt(form.importeIVA)}</span></span><span className="text-zinc-400">Total: <span className="text-gold-400 font-bold">{fmt(form.total)}</span></span></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Método pago</label><select value={form.metodoPago} onChange={(e) => setField('metodoPago', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none">{Object.entries(METODO_PAGO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Estado</label><select value={form.estadoPago} onChange={(e) => setField('estadoPago', e.target.value as any)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none"><option value="pendiente">Pendiente</option><option value="parcial">Parcial</option><option value="pagado">Pagado</option></select></div>
          <div className="col-span-2 flex items-center gap-2"><input type="checkbox" checked={form.facturaEmitida} onChange={(e) => setField('facturaEmitida', e.target.checked)} className="accent-gold-500" /><label className="text-sm text-zinc-300">Factura emitida</label></div>
          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">Cancelar</button>
            <button onClick={save} className="px-4 py-2 bg-gold-500 text-black text-sm font-semibold rounded-lg hover:bg-gold-400">{editId ? 'Guardar' : 'Añadir'}</button>
          </div>
        </div>
      </Modal>

      <EventoDetailModal
        ingreso={detailIngreso}
        onClose={() => setDetailIngreso(null)}
        onEdit={(i) => { setDetailIngreso(null); openEdit(i); }}
      />
    </div>
  );
};

const GastosTab = ({ gastos, onAdd, onUpdate, onDelete }: { gastos: Gasto[]; onAdd: (g: Omit<Gasto, 'id' | 'createdAt'>) => void; onUpdate: (id: string, g: Partial<Gasto>) => void; onDelete: (id: string) => void }) => {
  const { year, setYear, month, prevMonth, nextMonth, years } = useYearMonth(gastos);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Omit<Gasto, 'id' | 'createdAt'>>(emptyGasto());
  const [editId, setEditId] = useState<string | null>(null);
  const showConfirm = useConfirmStore((s) => s.show);

  const exportXlsx = () => {
    const all = gastos.filter((g) => new Date(g.fecha).getFullYear() === year);
    const rows = all.map((g) => ({ Fecha: g.fecha, Concepto: g.concepto, Categoría: g.categoria, 'Base imp.': g.baseImponible, 'IVA %': g.porcentajeIVA, IVA: g.importeIVA, Total: g.total, Deducible: g.deducible ? 'Sí' : 'No' }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Gastos DJ');
    XLSX.writeFile(wb, `dj-gastos-${year}.xlsx`);
  };

  const filtered = useMemo(() => gastos.filter((g) => { const d = new Date(g.fecha); return d.getFullYear() === year && d.getMonth() + 1 === month; }).sort((a, b) => a.fecha.localeCompare(b.fecha)), [gastos, year, month]);
  const totBase = filtered.reduce((s, g) => s + g.baseImponible, 0);

  const openNew = () => { setForm(emptyGasto()); setEditId(null); setModal(true); };
  const openEdit = (g: Gasto) => { setForm({ ...g }); setEditId(g.id); setModal(true); };
  const setField = (k: keyof typeof form, v: any) => setForm((f) => {
    const next = { ...f, [k]: v };
    if (k === 'baseImponible' || k === 'porcentajeIVA') { const r = calcIVA(Number(next.baseImponible), Number(next.porcentajeIVA)); return { ...next, ...r }; }
    return next;
  });
  const save = () => { if (editId) onUpdate(editId, form); else onAdd(form); setModal(false); };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <MonthNav year={year} years={years} month={month} prevMonth={prevMonth} nextMonth={nextMonth} setYear={setYear} />
        <span className="ml-2 text-sm text-zinc-400">Base: <span className="text-red-400 font-semibold">{fmt(totBase)}</span></span>
        <div className="ml-auto flex gap-2">
          <button onClick={exportXlsx} className="flex items-center gap-2 px-3 py-1.5 border border-surface-400/30 text-zinc-400 hover:text-zinc-200 text-sm rounded-lg hover:bg-surface-700"><Download size={14} /> Excel</button>
          <button onClick={openNew} className="flex items-center gap-2 px-3 py-1.5 bg-gold-500 text-black text-sm font-semibold rounded-lg hover:bg-gold-400"><Plus size={15} /> Nuevo gasto</button>
        </div>
      </div>
      <div className="bg-surface-800 border border-surface-400/20 rounded-xl overflow-hidden">
        {filtered.length === 0 ? <div className="p-12 text-center text-zinc-500">Sin gastos en {getMonthName(month)} {year}</div> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-surface-400/20">
              <th className="text-left px-4 py-3 text-zinc-500">Fecha</th>
              <th className="text-left px-4 py-3 text-zinc-500">Concepto</th>
              <th className="text-left px-4 py-3 text-zinc-500">Cat.</th>
              <th className="text-right px-4 py-3 text-zinc-500">Base</th>
              <th className="text-right px-4 py-3 text-zinc-500">Total</th>
              <th className="px-4 py-3"></th>
            </tr></thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.id} className="border-b border-surface-400/10 hover:bg-surface-700/50 text-sm">
                  <td className="px-4 py-3 text-zinc-400">{fmtDate(g.fecha)}</td>
                  <td className="px-4 py-3 text-white">{g.concepto}</td>
                  <td className="px-4 py-3 text-zinc-500">{g.categoria}</td>
                  <td className="px-4 py-3 text-right text-red-400">{fmt(g.baseImponible)}</td>
                  <td className="px-4 py-3 text-right text-zinc-300">{fmt(g.total)}</td>
                  <td className="px-4 py-3"><div className="flex gap-1">
                    <button onClick={() => openEdit(g)} className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-surface-600"><Edit2 size={13} /></button>
                    <button onClick={() => showConfirm('¿Eliminar este gasto? Esta acción no se puede deshacer.', () => onDelete(g.id))} className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-400/10"><Trash2 size={13} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Editar gasto' : 'Nuevo gasto DJ'} width="max-w-xl">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs text-zinc-400 mb-1 block">Fecha</label><input type="date" value={form.fecha} onChange={(e) => setField('fecha', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" /></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Categoría</label><select value={form.categoria} onChange={(e) => setField('categoria', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none">{GASTO_CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div className="col-span-2"><label className="text-xs text-zinc-400 mb-1 block">Concepto</label><input value={form.concepto} onChange={(e) => setField('concepto', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" /></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Base imponible (€)</label><input type="number" value={form.baseImponible} onChange={(e) => setField('baseImponible', Number(e.target.value))} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" /></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">% IVA</label><select value={form.porcentajeIVA} onChange={(e) => setField('porcentajeIVA', Number(e.target.value))} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none">{[0, 4, 10, 21].map((p) => <option key={p} value={p}>{p}%</option>)}</select></div>
          <div className="col-span-2 bg-surface-600/50 rounded-lg px-4 py-2 flex gap-6 text-sm"><span className="text-zinc-400">IVA: <span className="text-white">{fmt(form.importeIVA)}</span></span><span className="text-zinc-400">Total: <span className="text-red-400 font-bold">{fmt(form.total)}</span></span></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Tipo</label><select value={form.tipo} onChange={(e) => setField('tipo', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none"><option value="fijo">Fijo</option><option value="variable">Variable</option></select></div>
          <div className="flex flex-col gap-2 pt-4"><label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer"><input type="checkbox" checked={form.deducible} onChange={(e) => setField('deducible', e.target.checked)} className="accent-gold-500" />IVA deducible</label></div>
          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">Cancelar</button>
            <button onClick={save} className="px-4 py-2 bg-gold-500 text-black text-sm font-semibold rounded-lg hover:bg-gold-400">{editId ? 'Guardar' : 'Añadir'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

const SuplidosTab = ({ suplidos, onAdd, onUpdate, onDelete }: { suplidos: Suplido[]; onAdd: (s: Omit<Suplido, 'id' | 'createdAt'>) => void; onUpdate: (id: string, s: Partial<Suplido>) => void; onDelete: (id: string) => void }) => {
  const { year, setYear, month, prevMonth, nextMonth, years } = useYearMonth(suplidos);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Omit<Suplido, 'id' | 'createdAt'>>(emptySuplido());
  const [editId, setEditId] = useState<string | null>(null);
  const showConfirm = useConfirmStore((s) => s.show);

  const exportXlsx = () => {
    const all = suplidos.filter((s) => new Date(s.fecha).getFullYear() === year);
    const rows = all.map((s) => ({ Fecha: s.fecha, Concepto: s.concepto, Cliente: s.cliente, Importe: s.importe, Método: METODO_PAGO_LABELS[s.metodoPago], Justificante: s.justificante ? 'Sí' : 'No', Observaciones: s.observaciones ?? '' }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Suplidos DJ');
    XLSX.writeFile(wb, `dj-suplidos-${year}.xlsx`);
  };

  const filtered = useMemo(() => suplidos.filter((s) => { const d = new Date(s.fecha); return d.getFullYear() === year && d.getMonth() + 1 === month; }), [suplidos, year, month]);
  const total = filtered.reduce((s, sp) => s + sp.importe, 0);

  const openNew = () => { setForm(emptySuplido()); setEditId(null); setModal(true); };
  const openEdit = (s: Suplido) => { setForm({ ...s }); setEditId(s.id); setModal(true); };
  const setField = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const save = () => { if (editId) onUpdate(editId, form); else onAdd(form); setModal(false); };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 flex-col sm:flex-row sm:items-center">
        <div>
          <h3 className="text-sm font-semibold text-white">Suplidos</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Gastos pagados por cuenta del cliente que se recuperan sin IVA</p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <MonthNav year={year} years={years} month={month} prevMonth={prevMonth} nextMonth={nextMonth} setYear={setYear} />
        <span className="ml-2 text-sm text-zinc-400">Total: <span className="text-orange-400 font-semibold">{fmt(total)}</span></span>
        <div className="ml-auto flex gap-2">
          <button onClick={exportXlsx} className="flex items-center gap-2 px-3 py-1.5 border border-surface-400/30 text-zinc-400 hover:text-zinc-200 text-sm rounded-lg hover:bg-surface-700"><Download size={14} /> Excel</button>
          <button onClick={openNew} className="flex items-center gap-2 px-3 py-1.5 bg-gold-500 text-black text-sm font-semibold rounded-lg hover:bg-gold-400"><Plus size={15} /> Nuevo suplido</button>
        </div>
      </div>
      <div className="bg-surface-800 border border-surface-400/20 rounded-xl overflow-hidden">
        {filtered.length === 0 ? <div className="p-12 text-center text-zinc-500">Sin suplidos en {getMonthName(month)} {year}</div> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-surface-400/20">
              <th className="text-left px-4 py-3 text-zinc-500">Fecha</th>
              <th className="text-left px-4 py-3 text-zinc-500">Concepto</th>
              <th className="text-left px-4 py-3 text-zinc-500">Cliente</th>
              <th className="text-right px-4 py-3 text-zinc-500">Importe</th>
              <th className="text-left px-4 py-3 text-zinc-500">Método</th>
              <th className="text-center px-4 py-3 text-zinc-500">Justificante</th>
              <th className="px-4 py-3"></th>
            </tr></thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-surface-400/10 hover:bg-surface-700/50">
                  <td className="px-4 py-3 text-zinc-400">{fmtDate(s.fecha)}</td>
                  <td className="px-4 py-3 text-white">{s.concepto}</td>
                  <td className="px-4 py-3 text-zinc-400">{s.cliente}</td>
                  <td className="px-4 py-3 text-right text-orange-400 font-medium">{fmt(s.importe)}</td>
                  <td className="px-4 py-3 text-zinc-500">{METODO_PAGO_LABELS[s.metodoPago]}</td>
                  <td className="px-4 py-3 text-center">{s.justificante ? <Check size={14} className="text-green-400 mx-auto" /> : <X size={14} className="text-zinc-600 mx-auto" />}</td>
                  <td className="px-4 py-3"><div className="flex gap-1">
                    <button onClick={() => openEdit(s)} className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-surface-600"><Edit2 size={13} /></button>
                    <button onClick={() => showConfirm('¿Eliminar este suplido? Esta acción no se puede deshacer.', () => onDelete(s.id))} className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-400/10"><Trash2 size={13} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Editar suplido' : 'Nuevo suplido'} width="max-w-lg">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs text-zinc-400 mb-1 block">Fecha *</label><input type="date" value={form.fecha} onChange={(e) => setField('fecha', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" /></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Cliente *</label><input value={form.cliente} onChange={(e) => setField('cliente', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" /></div>
          <div className="col-span-2"><label className="text-xs text-zinc-400 mb-1 block">Concepto *</label><input value={form.concepto} onChange={(e) => setField('concepto', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" /></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Importe (€)</label><input type="number" value={form.importe} onChange={(e) => setField('importe', Number(e.target.value))} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" /></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Método pago</label><select value={form.metodoPago} onChange={(e) => setField('metodoPago', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none">{Object.entries(METODO_PAGO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="col-span-2 flex items-center gap-2"><input type="checkbox" checked={form.justificante} onChange={(e) => setField('justificante', e.target.checked)} className="accent-gold-500" /><label className="text-sm text-zinc-300">Justificante obtenido</label></div>
          <div className="col-span-2"><label className="text-xs text-zinc-400 mb-1 block">Observaciones</label><textarea value={form.observaciones ?? ''} onChange={(e) => setField('observaciones', e.target.value)} rows={2} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none resize-none" /></div>
          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">Cancelar</button>
            <button onClick={save} className="px-4 py-2 bg-gold-500 text-black text-sm font-semibold rounded-lg hover:bg-gold-400">{editId ? 'Guardar' : 'Añadir'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
