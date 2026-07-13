import { useState, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { uid } from '../../utils/helpers';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Modal } from '../../components/ui/Modal';
import { useConfirmStore } from '../../store/useConfirmStore';
import type { Area, Gasto, GastoCategoria, GastoTipo, PaymentMethod } from '../../types';

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

const CATEGORIAS: GastoCategoria[] = [
  'Alquiler', 'Gestoría', 'Seguros', 'Combustible', 'Vehículos', 'Publicidad',
  'Software', 'Teléfono', 'Personal', 'Material oficina', 'Reparaciones',
  'Transporte', 'Dietas', 'Hotel', 'Autónomos', 'Almacén', 'Comunicaciones', 'Otros',
];
const TIPOS: GastoTipo[] = ['fijo', 'variable'];
const METODOS: PaymentMethod[] = ['efectivo', 'transferencia', 'tarjeta', 'cheque', 'bizum', 'otro'];
const PCTS_IVA = [0, 10, 21];

interface Props { area: Area }

const EMPTY = (area: Area): Partial<Gasto> => ({
  area, fecha: new Date().toISOString().slice(0, 10),
  concepto: '', categoria: 'Otros', tipo: 'variable',
  baseImponible: 0, porcentajeIVA: 21, importeIVA: 0, total: 0,
  metodoPago: 'transferencia', estadoPago: 'pagado',
  facturaRecibida: false, deducible: true,
});

export const GastosPage = ({ area }: Props) => {
  const gastos     = useStore((s) => s.gastos.filter((g) => g.area === area));
  const addGasto   = useStore((s) => s.addGasto);
  const updateGasto = useStore((s) => s.updateGasto);
  const deleteGasto = useStore((s) => s.deleteGasto);
  const canCreate  = useAuthStore((s) => s.canCreate);
  const canEdit    = useAuthStore((s) => s.canEdit);
  const canDelete  = useAuthStore((s) => s.canDelete);
  const showConfirm = useConfirmStore((s) => s.show);

  const [search, setSearch]       = useState('');
  const [filterCat, setFilterCat] = useState<GastoCategoria | ''>('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Gasto | null>(null);
  const [form, setForm]           = useState<Partial<Gasto>>(EMPTY(area));

  const filtered = useMemo(() => {
    let list = [...gastos];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((g) => g.concepto.toLowerCase().includes(q) || (g.proveedor ?? '').toLowerCase().includes(q));
    }
    if (filterCat) list = list.filter((g) => g.categoria === filterCat);
    return list.sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [gastos, search, filterCat]);

  const totalFiltrado = filtered.reduce((a, g) => a + g.total, 0);

  const setField = (k: keyof Gasto, v: unknown) => {
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
  const openEdit = (g: Gasto) => { setEditing(g); setForm({ ...g }); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const save = () => {
    if (!form.concepto) return;
    if (editing) {
      updateGasto(editing.id, form);
    } else {
      addGasto({ ...EMPTY(area), ...form, id: uid(), createdAt: new Date().toISOString() } as Gasto);
    }
    closeModal();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gastos generales</h1>
          <p className="text-sm text-gray-500">{filtered.length} registros · Total: {fmt(totalFiltrado)}</p>
        </div>
        {canCreate(area) && (
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400 transition-colors">
            <Plus size={16} /> Nuevo gasto
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar concepto o proveedor…" className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:border-amber-400" />
        </div>
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value as GastoCategoria | '')} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Concepto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Categoría</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400 text-sm">Sin gastos registrados</td></tr>
              ) : filtered.map((g) => (
                <tr key={g.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{g.fecha}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{g.concepto}</p>
                    {g.proveedor && <p className="text-xs text-gray-400">{g.proveedor}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{g.categoria}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${g.tipo === 'fijo' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{g.tipo}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">{fmt(g.total)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${g.estadoPago === 'pagado' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{g.estadoPago}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {canEdit(area) && <button onClick={() => openEdit(g)} className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg"><Edit2 size={13} /></button>}
                      {canDelete(area) && <button onClick={() => showConfirm('¿Eliminar este gasto?', () => deleteGasto(g.id))} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Editar gasto' : 'Nuevo gasto'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label-form">Concepto *</label>
              <input value={form.concepto ?? ''} onChange={(e) => setField('concepto', e.target.value)} className="input-form" />
            </div>
            <div>
              <label className="label-form">Fecha</label>
              <input type="date" value={form.fecha ?? ''} onChange={(e) => setField('fecha', e.target.value)} className="input-form" />
            </div>
            <div>
              <label className="label-form">Proveedor</label>
              <input value={form.proveedor ?? ''} onChange={(e) => setField('proveedor', e.target.value)} className="input-form" />
            </div>
            <div>
              <label className="label-form">Categoría</label>
              <select value={form.categoria} onChange={(e) => setField('categoria', e.target.value)} className="input-form">
                {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label-form">Tipo</label>
              <select value={form.tipo} onChange={(e) => setField('tipo', e.target.value)} className="input-form">
                {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
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
              <div className="input-form bg-gray-50 text-gray-700 font-semibold">{fmt(form.total ?? 0)}</div>
            </div>
            <div>
              <label className="label-form">Estado pago</label>
              <select value={form.estadoPago} onChange={(e) => setField('estadoPago', e.target.value)} className="input-form">
                <option value="pendiente">Pendiente</option>
                <option value="pagado">Pagado</option>
              </select>
            </div>
            <div>
              <label className="label-form">Método pago</label>
              <select value={form.metodoPago} onChange={(e) => setField('metodoPago', e.target.value)} className="input-form">
                {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="col-span-2 flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input type="checkbox" checked={!!form.facturaRecibida} onChange={(e) => setField('facturaRecibida', e.target.checked)} className="rounded" />
                Factura recibida
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input type="checkbox" checked={!!form.deducible} onChange={(e) => setField('deducible', e.target.checked)} className="rounded" />
                Gasto deducible
              </label>
            </div>
            <div className="col-span-2">
              <label className="label-form">Observaciones</label>
              <textarea value={form.observaciones ?? ''} onChange={(e) => setField('observaciones', e.target.value)} rows={2} className="input-form" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={closeModal} className="flex-1 py-2 border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50">Cancelar</button>
            <button onClick={save} className="flex-1 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400">{editing ? 'Guardar' : 'Añadir gasto'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
