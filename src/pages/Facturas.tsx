import { useState, useMemo } from 'react';
import { Plus, Trash2, Edit2, Download, Check, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useStore } from '../store/useStore';
import { useConfirmStore } from '../store/useConfirmStore';
import { fmt, fmtDate, uid, getAvailableYears, getMonthName, calcIVA } from '../utils/helpers';
import { Modal } from '../components/ui/Modal';
import type { Factura, Area } from '../types';

type FacturaTipo = 'emitida' | 'recibida' | 'todas';

const empty = (tipo: 'emitida' | 'recibida' = 'emitida'): Omit<Factura, 'id'> => ({
  area: 'montada', tipo, numero: '',
  cliente: '', concepto: '',
  baseImponible: 0, porcentajeIVA: 21, importeIVA: 0, total: 0,
  fecha: new Date().toISOString().slice(0, 10),
  pagada: false, ivaDeducible: tipo === 'recibida',
});


export const Facturas = () => {
  const { facturas, addFactura, updateFactura, deleteFactura } = useStore();
  const showConfirm = useConfirmStore((s) => s.show);
  const allYears = useMemo(() => getAvailableYears(facturas), [facturas]);
  const [year, setYear] = useState(allYears[0] ?? new Date().getFullYear());
  const [month, setMonth] = useState<number | 'all'>('all');
  const [areaFilter, setAreaFilter] = useState<Area | 'todas'>('todas');
  const [tipoFilter, setTipoFilter] = useState<FacturaTipo>('todas');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Omit<Factura, 'id'>>(empty());
  const [editId, setEditId] = useState<string | null>(null);

  const filtered = useMemo(() => facturas.filter((f) => {
    const d = new Date(f.fecha);
    if (d.getFullYear() !== year) return false;
    if (month !== 'all' && d.getMonth() + 1 !== month) return false;
    if (areaFilter !== 'todas' && f.area !== areaFilter) return false;
    if (tipoFilter !== 'todas' && f.tipo !== tipoFilter) return false;
    return true;
  }).sort((a, b) => b.fecha.localeCompare(a.fecha)), [facturas, year, month, areaFilter, tipoFilter]);

  const emitidas = filtered.filter((f) => f.tipo === 'emitida');
  const recibidas = filtered.filter((f) => f.tipo === 'recibida');
  const ivaRepercutido = emitidas.reduce((s, f) => s + f.importeIVA, 0);
  const ivaSoportado = recibidas.filter((f) => f.ivaDeducible).reduce((s, f) => s + f.importeIVA, 0);
  const ivaLiquidar = ivaRepercutido - ivaSoportado;

  // Auto-number for emitidas
  const nextNumEmitida = (area: Area) => {
    const prefix = area === 'montada' ? 'F' : 'DJ';
    const existing = facturas
      .filter((f) => f.tipo === 'emitida' && f.area === area && f.numero.startsWith(prefix + year))
      .map((f) => parseInt(f.numero.split('-').pop() ?? '0', 10))
      .filter((n) => !isNaN(n));
    const next = existing.length ? Math.max(...existing) + 1 : 1;
    return `${prefix}${year}-${String(next).padStart(3, '0')}`;
  };

  const openNew = (tipo: 'emitida' | 'recibida' = 'emitida') => {
    const f = empty(tipo);
    if (tipo === 'emitida') f.numero = nextNumEmitida(f.area as Area);
    setForm(f); setEditId(null); setModal(true);
  };
  const openEdit = (f: Factura) => { setForm({ ...f }); setEditId(f.id); setModal(true); };
  const setField = (k: keyof typeof form, v: any) => setForm((f) => {
    const next = { ...f, [k]: v };
    if (k === 'area' && next.tipo === 'emitida') next.numero = nextNumEmitida(v as Area);
    if (k === 'baseImponible' || k === 'porcentajeIVA') { const r = calcIVA(Number(next.baseImponible), Number(next.porcentajeIVA)); return { ...next, ...r }; }
    return next;
  });
  const save = () => {
    if (editId) updateFactura(editId, form);
    else addFactura({ ...form, id: uid() });
    setModal(false);
  };

  const exportXlsx = () => {
    const rows = filtered.map((f) => ({ Área: f.area, Tipo: f.tipo, Número: f.numero, Cliente: f.cliente, Concepto: f.concepto, 'Base imp.': f.baseImponible, 'IVA %': f.porcentajeIVA, IVA: f.importeIVA, Total: f.total, Fecha: f.fecha, Pagada: f.pagada ? 'Sí' : 'No', 'IVA deducible': f.ivaDeducible ? 'Sí' : 'No' }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Facturas');
    XLSX.writeFile(wb, `facturas-${year}.xlsx`);
  };

  const months = Array.from({ length: 12 }, (_, i) => ({ num: i + 1, label: getMonthName(i + 1) }));

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Facturas & IVA</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Gestión de facturas emitidas y recibidas</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportXlsx} className="flex items-center gap-2 px-3 py-1.5 bg-surface-700 border border-surface-400/30 text-zinc-300 text-sm rounded-lg hover:text-white"><Download size={14} />Excel</button>
          <button onClick={() => openNew('recibida')} className="flex items-center gap-2 px-3 py-1.5 bg-surface-700 border border-surface-400/30 text-zinc-300 text-sm rounded-lg hover:text-white"><Plus size={14} />Recibida</button>
          <button onClick={() => openNew('emitida')} className="flex items-center gap-2 px-3 py-1.5 bg-gold-500 text-black text-sm font-semibold rounded-lg hover:bg-gold-400"><Plus size={14} />Emitida</button>
        </div>
      </div>

      {/* IVA Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-surface-800 border border-surface-400/20 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-1">IVA repercutido</p>
          <p className="text-2xl font-bold text-green-400">{fmt(ivaRepercutido)}</p>
          <p className="text-xs text-zinc-600 mt-1">{emitidas.length} facturas emitidas</p>
        </div>
        <div className="bg-surface-800 border border-surface-400/20 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-1">IVA soportado deducible</p>
          <p className="text-2xl font-bold text-orange-400">{fmt(ivaSoportado)}</p>
          <p className="text-xs text-zinc-600 mt-1">{recibidas.filter((f) => f.ivaDeducible).length} facturas deducibles</p>
        </div>
        <div className="bg-surface-800 border border-surface-400/20 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-1">{ivaLiquidar >= 0 ? 'IVA a pagar' : 'IVA a compensar'}</p>
          <p className={`text-2xl font-bold ${ivaLiquidar >= 0 ? 'text-red-400' : 'text-green-400'}`}>{fmt(Math.abs(ivaLiquidar))}</p>
          <p className="text-xs text-zinc-600 mt-1">Rep. {fmt(ivaRepercutido)} − Sop. {fmt(ivaSoportado)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="bg-surface-700 border border-surface-400/30 text-white text-sm rounded-lg px-3 py-1.5 outline-none">
          {allYears.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month} onChange={(e) => setMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="bg-surface-700 border border-surface-400/30 text-white text-sm rounded-lg px-3 py-1.5 outline-none">
          <option value="all">Todo el año</option>
          {months.map((m) => <option key={m.num} value={m.num}>{m.label}</option>)}
        </select>
        {(['todas', 'montada', 'dj'] as const).map((a) => (
          <button key={a} onClick={() => setAreaFilter(a)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${areaFilter === a ? 'bg-gold-500/15 text-gold-400 border border-gold-500/20' : 'bg-surface-700 text-zinc-400 border border-surface-400/30 hover:text-zinc-200'}`}>
            {a === 'todas' ? 'Todas' : a === 'montada' ? 'La Montada' : 'DJ'}
          </button>
        ))}
        {(['todas', 'emitida', 'recibida'] as const).map((t) => (
          <button key={t} onClick={() => setTipoFilter(t)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${tipoFilter === t ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'bg-surface-700 text-zinc-400 border border-surface-400/30 hover:text-zinc-200'}`}>
            {t === 'todas' ? 'Emitidas+Recibidas' : t === 'emitida' ? 'Emitidas' : 'Recibidas'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface-800 border border-surface-400/20 rounded-xl overflow-hidden">
        {filtered.length === 0 ? <div className="p-12 text-center text-zinc-500">Sin facturas con los filtros seleccionados</div> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-surface-400/20">
              <th className="text-left px-4 py-3 text-zinc-500">Nº Factura</th>
              <th className="text-left px-4 py-3 text-zinc-500">Tipo</th>
              <th className="text-left px-4 py-3 text-zinc-500">Cliente / Concepto</th>
              <th className="text-right px-4 py-3 text-zinc-500">Base imp.</th>
              <th className="text-right px-4 py-3 text-zinc-500">IVA</th>
              <th className="text-right px-4 py-3 text-zinc-500">Total</th>
              <th className="text-left px-4 py-3 text-zinc-500">Fecha</th>
              <th className="text-center px-4 py-3 text-zinc-500">Pagada</th>
              <th className="text-center px-4 py-3 text-zinc-500">IVA ded.</th>
              <th className="px-4 py-3"></th>
            </tr></thead>
            <tbody>
              {filtered.map((f) => (
                <tr key={f.id} className="border-b border-surface-400/10 hover:bg-surface-700/50">
                  <td className="px-4 py-3 font-mono text-zinc-300 text-xs">{f.numero}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${f.tipo === 'emitida' ? 'bg-green-500/10 text-green-400' : 'bg-orange-500/10 text-orange-400'}`}>{f.tipo}</span></td>
                  <td className="px-4 py-3"><p className="text-white font-medium">{f.cliente}</p><p className="text-xs text-zinc-500">{f.concepto}</p></td>
                  <td className="px-4 py-3 text-right text-zinc-300">{fmt(f.baseImponible)}</td>
                  <td className="px-4 py-3 text-right text-zinc-500">{f.porcentajeIVA}% · {fmt(f.importeIVA)}</td>
                  <td className="px-4 py-3 text-right text-white font-semibold">{fmt(f.total)}</td>
                  <td className="px-4 py-3 text-zinc-400">{fmtDate(f.fecha)}</td>
                  <td className="px-4 py-3 text-center">{f.pagada ? <Check size={14} className="text-green-400 mx-auto" /> : <X size={14} className="text-red-400 mx-auto" />}</td>
                  <td className="px-4 py-3 text-center">{f.ivaDeducible ? <Check size={14} className="text-green-400 mx-auto" /> : <span className="text-zinc-600 text-xs">—</span>}</td>
                  <td className="px-4 py-3"><div className="flex gap-1">
                    <button onClick={() => openEdit(f)} className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-surface-600"><Edit2 size={13} /></button>
                    <button onClick={() => showConfirm('¿Eliminar esta factura? Esta acción no se puede deshacer.', () => deleteFactura(f.id))} className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-400/10"><Trash2 size={13} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-surface-700/50 font-semibold border-t border-surface-400/20">
                  <td colSpan={3} className="px-4 py-3 text-zinc-400">TOTAL ({filtered.length})</td>
                  <td className="px-4 py-3 text-right text-zinc-300">{fmt(filtered.reduce((s, f) => s + f.baseImponible, 0))}</td>
                  <td className="px-4 py-3 text-right text-zinc-500">{fmt(filtered.reduce((s, f) => s + f.importeIVA, 0))}</td>
                  <td className="px-4 py-3 text-right text-white">{fmt(filtered.reduce((s, f) => s + f.total, 0))}</td>
                  <td colSpan={4}></td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Editar factura' : `Nueva factura ${form.tipo}`} width="max-w-2xl">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs text-zinc-400 mb-1 block">Tipo</label><select value={form.tipo} onChange={(e) => setField('tipo', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none"><option value="emitida">Emitida</option><option value="recibida">Recibida</option></select></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Área</label><select value={form.area} onChange={(e) => setField('area', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none"><option value="montada">La Montada Sound</option><option value="dj">DJ Personal</option></select></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Nº Factura</label><input value={form.numero} onChange={(e) => setField('numero', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none font-mono" /></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Fecha</label><input type="date" value={form.fecha} onChange={(e) => setField('fecha', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" /></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Cliente / Proveedor *</label><input value={form.cliente} onChange={(e) => setField('cliente', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" /></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Fecha vencimiento</label><input type="date" value={form.fechaVencimiento ?? ''} onChange={(e) => setField('fechaVencimiento', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" /></div>
          <div className="col-span-2"><label className="text-xs text-zinc-400 mb-1 block">Concepto</label><input value={form.concepto} onChange={(e) => setField('concepto', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" /></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Base imponible (€)</label><input type="number" value={form.baseImponible} onChange={(e) => setField('baseImponible', Number(e.target.value))} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" /></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">% IVA</label><select value={form.porcentajeIVA} onChange={(e) => setField('porcentajeIVA', Number(e.target.value))} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none">{[0, 4, 10, 21].map((p) => <option key={p} value={p}>{p}%</option>)}</select></div>
          <div className="col-span-2 bg-surface-600/50 rounded-lg px-4 py-2 flex gap-6 text-sm"><span className="text-zinc-400">IVA: <span className="text-white">{fmt(form.importeIVA)}</span></span><span className="text-zinc-400">Total: <span className="text-gold-400 font-bold">{fmt(form.total)}</span></span></div>
          <div className="col-span-2 flex gap-6">
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer"><input type="checkbox" checked={form.pagada} onChange={(e) => setField('pagada', e.target.checked)} className="accent-gold-500" />Pagada</label>
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer"><input type="checkbox" checked={form.ivaDeducible} onChange={(e) => setField('ivaDeducible', e.target.checked)} className="accent-gold-500" />IVA deducible</label>
          </div>
          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">Cancelar</button>
            <button onClick={save} className="px-4 py-2 bg-gold-500 text-black text-sm font-semibold rounded-lg hover:bg-gold-400">{editId ? 'Guardar cambios' : 'Añadir factura'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
