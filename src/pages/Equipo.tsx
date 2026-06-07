import { useState, useMemo } from 'react';
import { Plus, Trash2, Edit2, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useStore } from '../store/useStore';
import { useConfirmStore } from '../store/useConfirmStore';
import { fmt, fmtDate, uid, calcIVA } from '../utils/helpers';
import { Modal } from '../components/ui/Modal';
import type { Equipo as EquipoType, Area } from '../types';

const CATEGORIAS = ['Sonido', 'Audio', 'Iluminación', 'Video', 'DJ', 'Transporte', 'Accesorios', 'Otros'];

const empty = (): Omit<EquipoType, 'id' | 'createdAt'> => ({
  area: 'montada', nombre: '', categoria: 'Sonido',
  baseImponible: 0, porcentajeIVA: 21, importeIVA: 0, total: 0,
  fechaCompra: new Date().toISOString().slice(0, 10),
  facturaRecibida: false,
});


export const Equipo = () => {
  const { equipo, addEquipo, updateEquipo, deleteEquipo } = useStore();
  const showConfirm = useConfirmStore((s) => s.show);
  const [areaFilter, setAreaFilter] = useState<Area | 'todos'>('todos');
  const [catFilter, setCatFilter] = useState('todos');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Omit<EquipoType, 'id' | 'createdAt'>>(empty());
  const [editId, setEditId] = useState<string | null>(null);

  const filtered = useMemo(() => equipo.filter((e) => {
    if (areaFilter !== 'todos' && e.area !== areaFilter) return false;
    if (catFilter !== 'todos' && e.categoria !== catFilter) return false;
    return true;
  }).sort((a, b) => b.fechaCompra.localeCompare(a.fechaCompra)), [equipo, areaFilter, catFilter]);

  const totBase = filtered.reduce((s, e) => s + e.baseImponible, 0);
  const totIVA = filtered.reduce((s, e) => s + e.importeIVA, 0);
  const totTotal = filtered.reduce((s, e) => s + e.total, 0);

  const openNew = () => { setForm(empty()); setEditId(null); setModal(true); };
  const openEdit = (e: EquipoType) => { setForm({ ...e }); setEditId(e.id); setModal(true); };
  const setField = (k: keyof typeof form, v: any) => setForm((f) => {
    const next = { ...f, [k]: v };
    if (k === 'baseImponible' || k === 'porcentajeIVA') { const r = calcIVA(Number(next.baseImponible), Number(next.porcentajeIVA)); return { ...next, ...r }; }
    return next;
  });
  const save = () => {
    if (editId) updateEquipo(editId, form);
    else addEquipo({ ...form, id: uid(), createdAt: new Date().toISOString().slice(0, 10) });
    setModal(false);
  };

  const exportXlsx = () => {
    const rows = filtered.map((e) => ({ Área: e.area, Equipo: e.nombre, Categoría: e.categoria, 'Base imp.': e.baseImponible, 'IVA %': e.porcentajeIVA, IVA: e.importeIVA, Total: e.total, 'Fecha compra': e.fechaCompra, Proveedor: e.proveedor ?? '', Factura: e.facturaRecibida ? 'Sí' : 'No' }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Equipo');
    XLSX.writeFile(wb, 'equipo.xlsx');
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Inversiones & Equipo</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Registro de inversiones en equipo técnico</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportXlsx} className="flex items-center gap-2 px-3 py-1.5 bg-surface-700 border border-surface-400/30 text-zinc-300 text-sm rounded-lg hover:text-white transition-colors"><Download size={14} />Excel</button>
          <button onClick={openNew} className="flex items-center gap-2 px-3 py-1.5 bg-gold-500 text-black text-sm font-semibold rounded-lg hover:bg-gold-400"><Plus size={14} />Añadir equipo</button>
        </div>
      </div>

      {/* Filters + KPIs */}
      <div className="flex flex-wrap items-center gap-2">
        {(['todos', 'montada', 'dj'] as const).map((a) => (
          <button key={a} onClick={() => setAreaFilter(a)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${areaFilter === a ? 'bg-gold-500/15 text-gold-400 border border-gold-500/20' : 'bg-surface-700 text-zinc-400 border border-surface-400/30 hover:text-zinc-200'}`}>
            {a === 'todos' ? 'Todos' : a === 'montada' ? 'La Montada' : 'DJ'}
          </button>
        ))}
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="bg-surface-700 border border-surface-400/30 text-white text-sm rounded-lg px-3 py-1.5 outline-none">
          <option value="todos">Todas las categorías</option>
          {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="ml-auto flex gap-4 text-sm text-zinc-400">
          <span>Base: <span className="text-white font-semibold">{fmt(totBase)}</span></span>
          <span>IVA: <span className="text-zinc-300">{fmt(totIVA)}</span></span>
          <span>Total invertido: <span className="text-gold-400 font-bold">{fmt(totTotal)}</span></span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-800 border border-surface-400/20 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">No hay equipos registrados</div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-surface-400/20">
              <th className="text-left px-4 py-3 text-zinc-500">Equipo</th>
              <th className="text-left px-4 py-3 text-zinc-500">Cat.</th>
              <th className="text-left px-4 py-3 text-zinc-500">Área</th>
              <th className="text-right px-4 py-3 text-zinc-500">Base imp.</th>
              <th className="text-right px-4 py-3 text-zinc-500">IVA</th>
              <th className="text-right px-4 py-3 text-zinc-500">Total</th>
              <th className="text-left px-4 py-3 text-zinc-500">Fecha</th>
              <th className="text-left px-4 py-3 text-zinc-500">Proveedor</th>
              <th className="text-center px-4 py-3 text-zinc-500">Fra.</th>
              <th className="px-4 py-3"></th>
            </tr></thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-b border-surface-400/10 hover:bg-surface-700/50">
                  <td className="px-4 py-3 text-white font-medium">{e.nombre}</td>
                  <td className="px-4 py-3 text-zinc-500">{e.categoria}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${e.area === 'montada' ? 'bg-gold-500/10 text-gold-400' : 'bg-purple-500/10 text-purple-400'}`}>{e.area === 'montada' ? 'Montada' : 'DJ'}</span></td>
                  <td className="px-4 py-3 text-right text-zinc-300">{fmt(e.baseImponible)}</td>
                  <td className="px-4 py-3 text-right text-zinc-500">{e.porcentajeIVA}% · {fmt(e.importeIVA)}</td>
                  <td className="px-4 py-3 text-right text-white font-semibold">{fmt(e.total)}</td>
                  <td className="px-4 py-3 text-zinc-400">{fmtDate(e.fechaCompra)}</td>
                  <td className="px-4 py-3 text-zinc-500">{e.proveedor ?? '—'}</td>
                  <td className="px-4 py-3 text-center text-xs">{e.facturaRecibida ? <span className="text-green-400">✓</span> : <span className="text-zinc-600">—</span>}</td>
                  <td className="px-4 py-3"><div className="flex gap-1">
                    <button onClick={() => openEdit(e)} className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-surface-600"><Edit2 size={13} /></button>
                    <button onClick={() => showConfirm('¿Eliminar este elemento? Esta acción no se puede deshacer.', () => deleteEquipo(e.id))} className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-400/10"><Trash2 size={13} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="bg-surface-700/50 font-semibold">
              <td colSpan={3} className="px-4 py-3 text-zinc-400">TOTAL ({filtered.length} items)</td>
              <td className="px-4 py-3 text-right text-zinc-300">{fmt(totBase)}</td>
              <td className="px-4 py-3 text-right text-zinc-500">{fmt(totIVA)}</td>
              <td className="px-4 py-3 text-right text-gold-400">{fmt(totTotal)}</td>
              <td colSpan={4}></td>
            </tr></tfoot>
          </table>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Editar equipo' : 'Nuevo equipo'} width="max-w-2xl">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="text-xs text-zinc-400 mb-1 block">Nombre del equipo *</label><input value={form.nombre} onChange={(e) => setField('nombre', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" placeholder="Pioneer CDJ-3000 x2" /></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Categoría</label><select value={form.categoria} onChange={(e) => setField('categoria', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none">{CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Área</label><select value={form.area} onChange={(e) => setField('area', e.target.value as Area)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none"><option value="montada">La Montada Sound</option><option value="dj">DJ Personal</option></select></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Base imponible (€)</label><input type="number" value={form.baseImponible} onChange={(e) => setField('baseImponible', Number(e.target.value))} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" /></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">% IVA</label><select value={form.porcentajeIVA} onChange={(e) => setField('porcentajeIVA', Number(e.target.value))} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none">{[0, 4, 10, 21].map((p) => <option key={p} value={p}>{p}%</option>)}</select></div>
          <div className="col-span-2 bg-surface-600/50 rounded-lg px-4 py-2 flex gap-6 text-sm"><span className="text-zinc-400">IVA: <span className="text-white">{fmt(form.importeIVA)}</span></span><span className="text-zinc-400">Total: <span className="text-gold-400 font-bold">{fmt(form.total)}</span></span></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Fecha compra</label><input type="date" value={form.fechaCompra} onChange={(e) => setField('fechaCompra', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" /></div>
          <div><label className="text-xs text-zinc-400 mb-1 block">Proveedor</label><input value={form.proveedor ?? ''} onChange={(e) => setField('proveedor', e.target.value)} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" /></div>
          <div className="col-span-2 flex items-center gap-2"><input type="checkbox" checked={form.facturaRecibida} onChange={(e) => setField('facturaRecibida', e.target.checked)} className="accent-gold-500" /><label className="text-sm text-zinc-300">Factura recibida</label></div>
          <div className="col-span-2"><label className="text-xs text-zinc-400 mb-1 block">Observaciones</label><textarea value={form.observaciones ?? ''} onChange={(e) => setField('observaciones', e.target.value)} rows={2} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none resize-none" /></div>
          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">Cancelar</button>
            <button onClick={save} className="px-4 py-2 bg-gold-500 text-black text-sm font-semibold rounded-lg hover:bg-gold-400">{editId ? 'Guardar cambios' : 'Añadir equipo'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
