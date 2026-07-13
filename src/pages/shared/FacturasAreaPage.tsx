import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import { uid } from '../../utils/helpers';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Modal } from '../../components/ui/Modal';
import { useConfirmStore } from '../../store/useConfirmStore';
import type { Area, Factura } from '../../types';

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const PCTS_IVA = [0, 10, 21];

interface Props { area: Area }

const EMPTY = (area: Area): Partial<Factura> => ({
  area, tipo: 'emitida', numero: '', cliente: '', concepto: '',
  baseImponible: 0, porcentajeIVA: 21, importeIVA: 0, total: 0,
  fecha: new Date().toISOString().slice(0, 10),
  pagada: false, ivaDeducible: true,
});

export const FacturasAreaPage = ({ area }: Props) => {
  const allFacturas   = useStore((s) => s.facturas);
  const facturas      = useMemo(() => allFacturas.filter((f) => f.area === area), [allFacturas, area]);
  const addFactura    = useStore((s) => s.addFactura);
  const updateFactura = useStore((s) => s.updateFactura);
  const deleteFactura = useStore((s) => s.deleteFactura);
  const canCreate = useAuthStore((s) => s.canCreate);
  const canEdit   = useAuthStore((s) => s.canEdit);
  const canDelete = useAuthStore((s) => s.canDelete);
  const showConfirm = useConfirmStore((s) => s.show);

  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState<'emitida' | 'recibida' | ''>('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Factura | null>(null);
  const [form, setForm]           = useState<Partial<Factura>>(EMPTY(area));

  const filtered = useMemo(() => {
    let list = [...facturas];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((f) => f.numero.toLowerCase().includes(q) || f.cliente.toLowerCase().includes(q) || f.concepto.toLowerCase().includes(q));
    }
    if (filterTipo) list = list.filter((f) => f.tipo === filterTipo);
    return list.sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [facturas, search, filterTipo]);

  const totalEmitidas  = facturas.filter((f) => f.tipo === 'emitida').reduce((a, f) => a + f.total, 0);
  const totalRecibidas = facturas.filter((f) => f.tipo === 'recibida').reduce((a, f) => a + f.total, 0);

  const setField = (k: keyof Factura, v: unknown) => {
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === 'baseImponible' || k === 'porcentajeIVA') {
        const base = Number(next.baseImponible ?? 0);
        const pct  = Number(next.porcentajeIVA ?? 21);
        const iva  = Math.round(base * pct) / 100;
        next.importeIVA = iva;
        next.total      = base + iva;
      }
      return next;
    });
  };

  const openNew = () => { setEditing(null); setForm(EMPTY(area)); setShowModal(true); };
  const openEdit = (f: Factura) => { setEditing(f); setForm({ ...f }); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const save = () => {
    if (!form.numero || !form.cliente) return;
    if (editing) {
      updateFactura(editing.id, form);
    } else {
      addFactura({ ...EMPTY(area), ...form, id: uid(), createdAt: new Date().toISOString() } as Factura);
    }
    closeModal();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facturas</h1>
          <p className="text-sm text-gray-500">Emitidas: {fmt(totalEmitidas)} · Recibidas: {fmt(totalRecibidas)}</p>
        </div>
        {canCreate('facturas') && (
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400 transition-colors">
            <Plus size={16} /> Nueva factura
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar número, cliente…" className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:border-amber-400" />
        </div>
        <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value as 'emitida' | 'recibida' | '')} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
          <option value="">Todas</option>
          <option value="emitida">Emitidas</option>
          <option value="recibida">Recibidas</option>
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nº</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Pagada</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400 text-sm">Sin facturas</td></tr>
              ) : filtered.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-700">{f.numero}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${f.tipo === 'emitida' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{f.tipo}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-800">{f.cliente}</td>
                  <td className="px-4 py-3 text-gray-500">{f.fecha}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">{fmt(f.total)}</td>
                  <td className="px-4 py-3 text-center">{f.pagada ? <span className="text-green-600 text-xs font-medium">✓</span> : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      {canEdit('facturas') && <button onClick={() => openEdit(f)} className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg"><Edit2 size={13} /></button>}
                      {canDelete('facturas') && <button onClick={() => showConfirm('¿Eliminar esta factura?', () => deleteFactura(f.id))} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Editar factura' : 'Nueva factura'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-form">Nº Factura *</label>
              <input value={form.numero ?? ''} onChange={(e) => setField('numero', e.target.value)} className="input-form" placeholder="LMS-2026-001" />
            </div>
            <div>
              <label className="label-form">Serie</label>
              <input value={form.serie ?? ''} onChange={(e) => setField('serie', e.target.value)} className="input-form" placeholder="LMS-2026" />
            </div>
            <div>
              <label className="label-form">Tipo</label>
              <select value={form.tipo} onChange={(e) => setField('tipo', e.target.value)} className="input-form">
                <option value="emitida">Emitida</option>
                <option value="recibida">Recibida</option>
              </select>
            </div>
            <div>
              <label className="label-form">Fecha</label>
              <input type="date" value={form.fecha ?? ''} onChange={(e) => setField('fecha', e.target.value)} className="input-form" />
            </div>
            <div className="col-span-2">
              <label className="label-form">Cliente *</label>
              <input value={form.cliente ?? ''} onChange={(e) => setField('cliente', e.target.value)} className="input-form" />
            </div>
            <div className="col-span-2">
              <label className="label-form">Concepto</label>
              <input value={form.concepto ?? ''} onChange={(e) => setField('concepto', e.target.value)} className="input-form" />
            </div>
            <div>
              <label className="label-form">Base imponible (€)</label>
              <input type="number" step="0.01" value={form.baseImponible ?? 0} onChange={(e) => setField('baseImponible', parseFloat(e.target.value) || 0)} className="input-form" />
            </div>
            <div>
              <label className="label-form">IVA (%)</label>
              <select value={form.porcentajeIVA} onChange={(e) => setField('porcentajeIVA', Number(e.target.value))} className="input-form">
                {PCTS_IVA.map((p) => <option key={p} value={p}>{p}%</option>)}
              </select>
            </div>
            <div>
              <label className="label-form">Total</label>
              <div className="input-form bg-gray-50 font-semibold text-gray-700">{fmt(form.total ?? 0)}</div>
            </div>
            <div>
              <label className="label-form">Fecha vencimiento</label>
              <input type="date" value={form.fechaVencimiento ?? ''} onChange={(e) => setField('fechaVencimiento', e.target.value)} className="input-form" />
            </div>
            <div className="col-span-2 flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input type="checkbox" checked={!!form.pagada} onChange={(e) => setField('pagada', e.target.checked)} className="rounded" />
                Pagada
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input type="checkbox" checked={!!form.ivaDeducible} onChange={(e) => setField('ivaDeducible', e.target.checked)} className="rounded" />
                IVA deducible
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input type="checkbox" checked={!!form.enviada} onChange={(e) => setField('enviada', e.target.checked)} className="rounded" />
                Enviada al cliente
              </label>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={closeModal} className="flex-1 py-2 border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50">Cancelar</button>
            <button onClick={save} className="flex-1 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400">{editing ? 'Guardar' : 'Crear factura'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
