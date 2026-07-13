import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import { uid } from '../../utils/helpers';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Modal } from '../../components/ui/Modal';
import { useConfirmStore } from '../../store/useConfirmStore';
import type { Area, Equipo, PaymentMethod } from '../../types';

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

const CATEGORIAS_EQUIPO = ['Sonido', 'Iluminación', 'Vídeo', 'DJ', 'Transporte', 'Oficina', 'Fotografía', 'Comunicación', 'Otro'];
const METODOS: PaymentMethod[] = ['efectivo', 'transferencia', 'tarjeta', 'cheque', 'bizum', 'otro'];
const PCTS_IVA = [0, 10, 21];

interface Props { area: Area }

const EMPTY = (area: Area): Partial<Equipo> => ({
  area, nombre: '', categoria: 'Otro',
  baseImponible: 0, porcentajeIVA: 21, importeIVA: 0, total: 0,
  fechaCompra: new Date().toISOString().slice(0, 10),
  facturaRecibida: false, financiado: false,
});

export const InversionesPage = ({ area }: Props) => {
  const allEquipo    = useStore((s) => s.equipo);
  const equipo       = useMemo(() => allEquipo.filter((e) => e.area === area), [allEquipo, area]);
  const addEquipo    = useStore((s) => s.addEquipo);
  const updateEquipo = useStore((s) => s.updateEquipo);
  const deleteEquipo = useStore((s) => s.deleteEquipo);
  const canCreate = useAuthStore((s) => s.canCreate);
  const canEdit   = useAuthStore((s) => s.canEdit);
  const canDelete = useAuthStore((s) => s.canDelete);
  const showConfirm = useConfirmStore((s) => s.show);

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Equipo | null>(null);
  const [form, setForm]           = useState<Partial<Equipo>>(EMPTY(area));

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return equipo.filter((e) => e.nombre.toLowerCase().includes(q) || e.categoria.toLowerCase().includes(q))
      .sort((a, b) => b.fechaCompra.localeCompare(a.fechaCompra));
  }, [equipo, search]);

  const totalInvertido = filtered.reduce((a, e) => a + e.total, 0);

  const setField = (k: keyof Equipo, v: unknown) => {
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
  const openEdit = (e: Equipo) => { setEditing(e); setForm({ ...e }); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const save = () => {
    if (!form.nombre) return;
    if (editing) {
      updateEquipo(editing.id, form);
    } else {
      addEquipo({ ...EMPTY(area), ...form, id: uid(), createdAt: new Date().toISOString() } as Equipo);
    }
    closeModal();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inversiones y equipos</h1>
          <p className="text-sm text-gray-500">{filtered.length} items · Total: {fmt(totalInvertido)}</p>
        </div>
        {canCreate('inversiones') && (
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400 transition-colors">
            <Plus size={16} /> Añadir equipo
          </button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar equipo…" className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:border-amber-400" />
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Categoría</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha compra</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Proveedor</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Factura</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400 text-sm">Sin equipos registrados</td></tr>
              ) : filtered.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{e.nombre}</p>
                    {e.numeroSerie && <p className="text-xs text-gray-400">S/N: {e.numeroSerie}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{e.categoria}</td>
                  <td className="px-4 py-3 text-gray-500">{e.fechaCompra}</td>
                  <td className="px-4 py-3 text-gray-600">{e.proveedor ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">{fmt(e.total)}</td>
                  <td className="px-4 py-3 text-center">{e.facturaRecibida ? <span className="text-green-600 text-xs font-medium">✓</span> : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      {canEdit('inversiones') && <button onClick={() => openEdit(e)} className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg"><Edit2 size={13} /></button>}
                      {canDelete('inversiones') && <button onClick={() => showConfirm('¿Eliminar este equipo?', () => deleteEquipo(e.id))} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Editar equipo' : 'Nuevo equipo'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label-form">Nombre *</label>
              <input value={form.nombre ?? ''} onChange={(e) => setField('nombre', e.target.value)} className="input-form" />
            </div>
            <div>
              <label className="label-form">Categoría</label>
              <select value={form.categoria} onChange={(e) => setField('categoria', e.target.value)} className="input-form">
                {CATEGORIAS_EQUIPO.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label-form">Fecha compra</label>
              <input type="date" value={form.fechaCompra ?? ''} onChange={(e) => setField('fechaCompra', e.target.value)} className="input-form" />
            </div>
            <div>
              <label className="label-form">Proveedor</label>
              <input value={form.proveedor ?? ''} onChange={(e) => setField('proveedor', e.target.value)} className="input-form" />
            </div>
            <div>
              <label className="label-form">Nº Serie</label>
              <input value={form.numeroSerie ?? ''} onChange={(e) => setField('numeroSerie', e.target.value)} className="input-form" />
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
              <label className="label-form">Forma de pago</label>
              <select value={form.formaPago} onChange={(e) => setField('formaPago', e.target.value)} className="input-form">
                <option value="">—</option>
                {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label-form">Vida útil (años)</label>
              <input type="number" value={form.vidaUtil ?? ''} onChange={(e) => setField('vidaUtil', parseInt(e.target.value) || undefined)} className="input-form" />
            </div>
            <div>
              <label className="label-form">Garantía (meses)</label>
              <input type="number" value={form.garantia ?? ''} onChange={(e) => setField('garantia', parseInt(e.target.value) || undefined)} className="input-form" />
            </div>
            <div>
              <label className="label-form">Fin garantía</label>
              <input type="date" value={form.fechaFinGarantia ?? ''} onChange={(e) => setField('fechaFinGarantia', e.target.value)} className="input-form" />
            </div>
            <div className="col-span-2 flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input type="checkbox" checked={!!form.facturaRecibida} onChange={(e) => setField('facturaRecibida', e.target.checked)} className="rounded" />
                Factura recibida
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input type="checkbox" checked={!!form.financiado} onChange={(e) => setField('financiado', e.target.checked)} className="rounded" />
                Financiado
              </label>
            </div>
            <div className="col-span-2">
              <label className="label-form">Observaciones</label>
              <textarea value={form.observaciones ?? ''} onChange={(e) => setField('observaciones', e.target.value)} rows={2} className="input-form" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={closeModal} className="flex-1 py-2 border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50">Cancelar</button>
            <button onClick={save} className="flex-1 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400">{editing ? 'Guardar' : 'Añadir'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
