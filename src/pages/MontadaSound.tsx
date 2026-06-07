import { useState, useMemo } from 'react';
import { Plus, ChevronLeft, ChevronRight, Trash2, Edit2, Check, X, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import * as XLSX from 'xlsx';
import { useStore } from '../store/useStore';
import { fmt, fmtShort, fmtDate, uid, buildMonthlyTable, getAvailableYears, getMonthName, EVENT_TYPE_LABELS, EVENT_TYPE_COLORS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS, GASTO_CATEGORIAS, METODO_PAGO_LABELS, calcIVA, useYearMonth } from '../utils/helpers';
import { Modal } from '../components/ui/Modal';
import { useConfirmStore } from '../store/useConfirmStore';
import type { Ingreso, Gasto } from '../types';

type Tab = 'resumen' | 'ingresos' | 'gastos';
const TABS: { id: Tab; label: string }[] = [{ id: 'resumen', label: 'Resumen' }, { id: 'ingresos', label: 'Ingresos' }, { id: 'gastos', label: 'Gastos' }];

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


export const MontadaSound = () => {
  const { ingresos, gastos, addIngreso, updateIngreso, deleteIngreso, addGasto, updateGasto, deleteGasto } = useStore();
  const [tab, setTab] = useState<Tab>('resumen');
  const montadaIngresos = useMemo(() => ingresos.filter((i) => i.area === 'montada'), [ingresos]);
  const montadaGastos = useMemo(() => gastos.filter((g) => g.area === 'montada'), [gastos]);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">La Montada Sound</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Empresa de eventos — sonido, iluminación y producción</p>
      </div>
      <div className="flex gap-1 bg-surface-800 border border-surface-400/20 rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-gold-500/15 text-gold-400' : 'text-zinc-500 hover:text-zinc-200'}`}>{t.label}</button>
        ))}
      </div>
      {tab === 'resumen' && <ResumenTab ingresos={montadaIngresos} gastos={montadaGastos} />}
      {tab === 'ingresos' && <IngresosTab ingresos={montadaIngresos} onAdd={(i) => addIngreso({ ...i, id: uid(), createdAt: new Date().toISOString().slice(0, 10) })} onUpdate={updateIngreso} onDelete={deleteIngreso} />}
      {tab === 'gastos' && <GastosTab gastos={montadaGastos} onAdd={(g) => addGasto({ ...g, id: uid(), createdAt: new Date().toISOString().slice(0, 10) })} onUpdate={updateGasto} onDelete={deleteGasto} />}
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
            <Bar dataKey="ingresos" name="Ingresos" fill="#f59e0b" radius={[4, 4, 0, 0]} />
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
                <td className="px-4 py-2.5 text-right text-green-400">{row.ing > 0 ? fmt(row.ing) : '—'}</td>
                <td className="px-4 py-2.5 text-right text-zinc-400">{row.gFijo > 0 ? fmt(row.gFijo) : '—'}</td>
                <td className="px-4 py-2.5 text-right text-zinc-400">{row.gVar > 0 ? fmt(row.gVar) : '—'}</td>
                <td className={`px-4 py-2.5 text-right font-semibold ${row.balance >= 0 ? 'text-gold-400' : 'text-red-400'}`}>{row.ing > 0 || row.gTotal > 0 ? fmt(row.balance) : '—'}</td>
                <td className={`px-4 py-2.5 text-right font-semibold ${acum >= 0 ? 'text-blue-400' : 'text-red-400'}`}>{fmt(acum)}</td>
              </tr>
            ); })}
          </tbody>
          <tfoot><tr className="bg-surface-700/50 font-semibold">
            <td className="px-4 py-3 text-zinc-300">TOTAL</td>
            <td className="px-4 py-3 text-right text-green-400">{fmt(totIng)}</td>
            <td className="px-4 py-3 text-right text-zinc-400">{fmt(monthly.reduce((s, r) => s + r.gFijo, 0))}</td>
            <td className="px-4 py-3 text-right text-zinc-400">{fmt(monthly.reduce((s, r) => s + r.gVar, 0))}</td>
            <td className={`px-4 py-3 text-right ${totIng - totGas >= 0 ? 'text-gold-400' : 'text-red-400'}`}>{fmt(totIng - totGas)}</td>
            <td className="px-4 py-3 text-right text-blue-400">{fmt(acum)}</td>
          </tr></tfoot>
        </table>
      </div>
    </div>
  );
};

const IngresosTab = ({ ingresos, onAdd, onUpdate, onDelete }: { ingresos: Ingreso[]; onAdd: (i: Omit<Ingreso, 'id' | 'createdAt'>) => void; onUpdate: (id: string, i: Partial<Ingreso>) => void; onDelete: (id: string) => void }) => {
  const { year, setYear, month, prevMonth, nextMonth, years } = useYearMonth(ingresos);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Omit<Ingreso, 'id' | 'createdAt'>>(emptyIngreso());
  const [editId, setEditId] = useState<string | null>(null);
  const showConfirm = useConfirmStore((s) => s.show);

  const filtered = useMemo(() => ingresos.filter((i) => { const d = new Date(i.fechaEvento); return d.getFullYear() === year && d.getMonth() + 1 === month; }), [ingresos, year, month]);
  const totBase = filtered.reduce((s, i) => s + i.baseImponible, 0);
  const totIVA = filtered.reduce((s, i) => s + i.importeIVA, 0);
  const totTotal = filtered.reduce((s, i) => s + i.total, 0);

  const exportXlsx = () => {
    const all = ingresos.filter((i) => new Date(i.fechaEvento).getFullYear() === year);
    const rows = all.map((i) => ({ Fecha: i.fechaEvento, Concepto: i.concepto, Cliente: i.cliente, Tipo: i.tipoEvento, 'Base imp.': i.baseImponible, 'IVA %': i.porcentajeIVA, IVA: i.importeIVA, Total: i.total, Método: i.metodoPago, Estado: i.estadoPago, Factura: i.numeroFactura ?? '' }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ingresos');
    XLSX.writeFile(wb, `montada-ingresos-${year}.xlsx`);
  };

  const openNew = () => { setForm(emptyIngreso()); setEditId(null); setModal(true); };
  const openEdit = (i: Ingreso) => { setForm({ ...i }); setEditId(i.id); setModal(true); };
  const setField = (k: keyof typeof form, v: any) => setForm((f) => {
    const next = { ...f, [k]: v };
    if (k === 'baseImponible' || k === 'porcentajeIVA') { const r = calcIVA(Number(next.baseImponible), Number(next.porcentajeIVA)); return { ...next, ...r }; }
    return next;
  });
  const save = () => { if (editId) onUpdate(editId, form); else onAdd(form); setModal(false); };

  return (
    <div className="space-y-4">
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
          <span>Base: <span className="text-green-400 font-semibold">{fmt(totBase)}</span></span>
          <span>IVA: <span className="text-zinc-300">{fmt(totIVA)}</span></span>
          <span>Total: <span className="text-white font-semibold">{fmt(totTotal)}</span></span>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={exportXlsx} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-700 border border-surface-400/30 text-zinc-300 text-sm rounded-lg hover:text-white"><Download size={13} />Excel</button>
          <button onClick={openNew} className="flex items-center gap-2 px-3 py-1.5 bg-gold-500 text-black text-sm font-semibold rounded-lg hover:bg-gold-400"><Plus size={15} /> Nuevo ingreso</button>
        </div>
      </div>
      <div className="bg-surface-800 border border-surface-400/20 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">Sin ingresos en {getMonthName(month)} {year}</div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-surface-400/20">
              <th className="text-left px-4 py-3 text-zinc-500">Concepto / Cliente</th>
              <th className="text-left px-4 py-3 text-zinc-500">Tipo</th>
              <th className="text-right px-4 py-3 text-zinc-500">Base imp.</th>
              <th className="text-right px-4 py-3 text-zinc-500">IVA</th>
              <th className="text-right px-4 py-3 text-zinc-500">Total</th>
              <th className="text-left px-4 py-3 text-zinc-500">Estado</th>
              <th className="text-left px-4 py-3 text-zinc-500">Factura</th>
              <th className="px-4 py-3"></th>
            </tr></thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id} className="border-b border-surface-400/10 hover:bg-surface-700/50">
                  <td className="px-4 py-3"><p className="text-white font-medium">{i.concepto}</p><p className="text-xs text-zinc-500">{i.cliente} · {fmtDate(i.fechaEvento)}</p></td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${EVENT_TYPE_COLORS[i.tipoEvento] ?? 'bg-zinc-500/10 text-zinc-400'}`}>{EVENT_TYPE_LABELS[i.tipoEvento]}</span></td>
                  <td className="px-4 py-3 text-right text-green-400 font-medium">{fmt(i.baseImponible)}</td>
                  <td className="px-4 py-3 text-right text-zinc-400">{i.porcentajeIVA}% · {fmt(i.importeIVA)}</td>
                  <td className="px-4 py-3 text-right text-white font-semibold">{fmt(i.total)}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${PAYMENT_STATUS_COLORS[i.estadoPago]}`}>{PAYMENT_STATUS_LABELS[i.estadoPago]}</span></td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{i.facturaEmitida ? (i.numeroFactura ?? '✓') : '—'}</td>
                  <td className="px-4 py-3"><div className="flex items-center gap-1">
                    <button onClick={() => openEdit(i)} className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-surface-600"><Edit2 size={13} /></button>
                    <button onClick={() => showConfirm('¿Eliminar este ingreso? Esta acción no se puede deshacer.', () => onDelete(i.id))} className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-400/10"><Trash2 size={13} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Editar ingreso' : 'Nuevo ingreso'} width="max-w-2xl">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="text-xs text-zinc-400 mb-1 block">Concepto *</label><input value={form.concepto} onChange={(e) => setField('concepto', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-gold-500/50" /></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Cliente *</label><input value={form.cliente} onChange={(e) => setField('cliente', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" /></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Tipo de evento</label><select value={form.tipoEvento} onChange={(e) => setField('tipoEvento', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none">{Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Fecha evento *</label><input type="date" value={form.fechaEvento} onChange={(e) => setField('fechaEvento', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" /></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Fecha factura</label><input type="date" value={form.fechaFactura ?? ''} onChange={(e) => setField('fechaFactura', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" /></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Base imponible (€)</label><input type="number" value={form.baseImponible} onChange={(e) => setField('baseImponible', Number(e.target.value))} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" /></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">% IVA</label><select value={form.porcentajeIVA} onChange={(e) => setField('porcentajeIVA', Number(e.target.value))} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none">{[0, 4, 10, 21].map((p) => <option key={p} value={p}>{p}%</option>)}</select></div>
          <div className="col-span-2 bg-surface-600/50 rounded-lg px-4 py-2 flex gap-6 text-sm"><span className="text-zinc-400">IVA: <span className="text-white">{fmt(form.importeIVA)}</span></span><span className="text-zinc-400">Total: <span className="text-gold-400 font-bold">{fmt(form.total)}</span></span></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Método de pago</label><select value={form.metodoPago} onChange={(e) => setField('metodoPago', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none">{Object.entries(METODO_PAGO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Estado de pago</label><select value={form.estadoPago} onChange={(e) => setField('estadoPago', e.target.value as any)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none"><option value="pendiente">Pendiente</option><option value="parcial">Parcial</option><option value="pagado">Pagado</option></select></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Pagos recibidos (€ con IVA)</label><input type="number" value={form.pagosRecibidos} onChange={(e) => setField('pagosRecibidos', Number(e.target.value))} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" /></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Nº factura</label><input value={form.numeroFactura ?? ''} onChange={(e) => setField('numeroFactura', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" /></div>
          <div className="col-span-2 flex items-center gap-2"><input type="checkbox" id="factEmitida" checked={form.facturaEmitida} onChange={(e) => setField('facturaEmitida', e.target.checked)} className="accent-gold-500" /><label htmlFor="factEmitida" className="text-sm text-zinc-300">Factura emitida</label></div>
          <div className="col-span-2"><label className="text-xs text-zinc-400 mb-1 block">Notas</label><textarea value={form.notas ?? ''} onChange={(e) => setField('notas', e.target.value)} rows={2} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none resize-none" /></div>
          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">Cancelar</button>
            <button onClick={save} className="px-4 py-2 bg-gold-500 text-black text-sm font-semibold rounded-lg hover:bg-gold-400">{editId ? 'Guardar cambios' : 'Añadir ingreso'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

const GastosTab = ({ gastos, onAdd, onUpdate, onDelete }: { gastos: Gasto[]; onAdd: (g: Omit<Gasto, 'id' | 'createdAt'>) => void; onUpdate: (id: string, g: Partial<Gasto>) => void; onDelete: (id: string) => void }) => {
  const { year, setYear, month, prevMonth, nextMonth, years } = useYearMonth(gastos);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Omit<Gasto, 'id' | 'createdAt'>>(emptyGasto());
  const [editId, setEditId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [cellVal, setCellVal] = useState('');
  const showConfirm = useConfirmStore((s) => s.show);

  const filtered = useMemo(() => gastos.filter((g) => { const d = new Date(g.fecha); return d.getFullYear() === year && d.getMonth() + 1 === month; }).sort((a, b) => a.fecha.localeCompare(b.fecha)), [gastos, year, month]);
  const totBase = filtered.reduce((s, g) => s + g.baseImponible, 0);
  const totIVA = filtered.reduce((s, g) => s + g.importeIVA, 0);

  const exportXlsx = () => {
    const all = gastos.filter((g) => new Date(g.fecha).getFullYear() === year);
    const rows = all.map((g) => ({ Fecha: g.fecha, Concepto: g.concepto, Categoría: g.categoria, Tipo: g.tipo, 'Base imp.': g.baseImponible, 'IVA %': g.porcentajeIVA, IVA: g.importeIVA, Total: g.total, Proveedor: g.proveedor ?? '', Deducible: g.deducible ? 'Sí' : 'No' }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Gastos');
    XLSX.writeFile(wb, `montada-gastos-${year}.xlsx`);
  };

  const openNew = () => { setForm(emptyGasto()); setEditId(null); setModal(true); };
  const openEdit = (g: Gasto) => { setForm({ ...g }); setEditId(g.id); setModal(true); };
  const setField = (k: keyof typeof form, v: any) => setForm((f) => {
    const next = { ...f, [k]: v };
    if (k === 'baseImponible' || k === 'porcentajeIVA') { const r = calcIVA(Number(next.baseImponible), Number(next.porcentajeIVA)); return { ...next, ...r }; }
    return next;
  });
  const save = () => { if (editId) onUpdate(editId, form); else onAdd(form); setModal(false); };

  const startEdit = (g: Gasto, field: string, val: string) => { setEditingCell({ id: g.id, field }); setCellVal(val); };
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
          <div className="p-12 text-center text-zinc-500">Sin gastos en {getMonthName(month)} {year}</div>
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
                  <td className="px-3 py-2"><div className="flex items-center gap-1">
                    <button onClick={() => openEdit(g)} className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-surface-600"><Edit2 size={12} /></button>
                    <button onClick={() => showConfirm('¿Eliminar este gasto? Esta acción no se puede deshacer.', () => onDelete(g.id))} className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-400/10"><Trash2 size={12} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Editar gasto' : 'Nuevo gasto'} width="max-w-2xl">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs text-zinc-400 mb-1 block">Fecha *</label><input type="date" value={form.fecha} onChange={(e) => setField('fecha', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" /></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Categoría</label><select value={form.categoria} onChange={(e) => setField('categoria', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none">{GASTO_CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div className="col-span-2"><label className="text-xs text-zinc-400 mb-1 block">Concepto *</label><input value={form.concepto} onChange={(e) => setField('concepto', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" /></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Tipo</label><select value={form.tipo} onChange={(e) => setField('tipo', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none"><option value="fijo">Fijo</option><option value="variable">Variable</option></select></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Proveedor</label><input value={form.proveedor ?? ''} onChange={(e) => setField('proveedor', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" /></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Base imponible (€)</label><input type="number" value={form.baseImponible} onChange={(e) => setField('baseImponible', Number(e.target.value))} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" /></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">% IVA</label><select value={form.porcentajeIVA} onChange={(e) => setField('porcentajeIVA', Number(e.target.value))} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none">{[0, 4, 10, 21].map((p) => <option key={p} value={p}>{p}%</option>)}</select></div>
          <div className="col-span-2 bg-surface-600/50 rounded-lg px-4 py-2 flex gap-6 text-sm"><span className="text-zinc-400">IVA: <span className="text-white">{fmt(form.importeIVA)}</span></span><span className="text-zinc-400">Total: <span className="text-red-400 font-bold">{fmt(form.total)}</span></span></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Método de pago</label><select value={form.metodoPago} onChange={(e) => setField('metodoPago', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none">{Object.entries(METODO_PAGO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="flex flex-col gap-2 pt-4">
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer"><input type="checkbox" checked={form.facturaRecibida} onChange={(e) => setField('facturaRecibida', e.target.checked)} className="accent-gold-500" />Factura recibida</label>
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer"><input type="checkbox" checked={form.deducible} onChange={(e) => setField('deducible', e.target.checked)} className="accent-gold-500" />IVA deducible</label>
          </div>
          <div className="col-span-2"><label className="text-xs text-zinc-400 mb-1 block">Observaciones</label><textarea value={form.observaciones ?? ''} onChange={(e) => setField('observaciones', e.target.value)} rows={2} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none resize-none" /></div>
          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">Cancelar</button>
            <button onClick={save} className="px-4 py-2 bg-gold-500 text-black text-sm font-semibold rounded-lg hover:bg-gold-400">{editId ? 'Guardar cambios' : 'Añadir gasto'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
