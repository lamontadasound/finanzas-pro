import { useState, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, ChevronDown } from 'lucide-react';
import { uid } from '../../utils/helpers';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Modal } from '../../components/ui/Modal';
import { useConfirmStore } from '../../store/useConfirmStore';
import type { Area, Ingreso, PaymentMethod, PaymentStatus, EventType } from '../../types';

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

const TIPOS_EVENTO: EventType[] = ['boda', 'real_madrid', 'alquiler', 'evento_privado', 'dj_personal', 'empresa', 'otro'];
const METODOS: PaymentMethod[] = ['efectivo', 'transferencia', 'tarjeta', 'cheque', 'bizum', 'otro'];
const ESTADOS: PaymentStatus[] = ['presupuesto', 'pendiente', 'parcial', 'pagado', 'cancelado'];
const PCTS_IVA = [0, 10, 21];

const estadoColor: Record<PaymentStatus, string> = {
  presupuesto: 'bg-gray-100 text-gray-600',
  pendiente:   'bg-amber-100 text-amber-700',
  parcial:     'bg-blue-100 text-blue-700',
  pagado:      'bg-green-100 text-green-700',
  cancelado:   'bg-red-100 text-red-600',
};

interface Props { area: Area }

const EMPTY = (area: Area): Partial<Ingreso> => ({
  area,
  concepto: '', cliente: '', empresa: false,
  tipoEvento: 'boda', fechaEvento: new Date().toISOString().slice(0, 10),
  baseImponible: 0, porcentajeIVA: 21, importeIVA: 0, total: 0,
  metodoPago: 'transferencia', estadoPago: 'pendiente', pagosRecibidos: 0,
  facturaEmitida: false, notas: '',
});

export const IngresosPage = ({ area }: Props) => {
  const allIngresos  = useStore((s) => s.ingresos);
  const ingresos     = useMemo(() => allIngresos.filter((i) => i.area === area), [allIngresos, area]);
  const addIngreso   = useStore((s) => s.addIngreso);
  const updateIngreso = useStore((s) => s.updateIngreso);
  const deleteIngreso = useStore((s) => s.deleteIngreso);
  const canCreate    = useAuthStore((s) => s.canCreate);
  const canEdit      = useAuthStore((s) => s.canEdit);
  const canDelete    = useAuthStore((s) => s.canDelete);

  const [search, setSearch]       = useState('');
  const [filterEstado, setFilter] = useState<PaymentStatus | ''>('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Ingreso | null>(null);
  const [form, setForm]           = useState<Partial<Ingreso>>(EMPTY(area));
  const showConfirm = useConfirmStore((s) => s.show);
  const [sortField, setSortField] = useState<'fechaEvento' | 'total' | 'cliente'>('fechaEvento');
  const [sortDir, setSortDir]     = useState<'asc' | 'desc'>('desc');

  const filtered = useMemo(() => {
    let list = [...ingresos];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.concepto.toLowerCase().includes(q) || i.cliente.toLowerCase().includes(q));
    }
    if (filterEstado) list = list.filter((i) => i.estadoPago === filterEstado);
    list.sort((a, b) => {
      const av = a[sortField] ?? '';
      const bv = b[sortField] ?? '';
      const cmp = String(av).localeCompare(String(bv), 'es', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [ingresos, search, filterEstado, sortField, sortDir]);

  const totalFiltrado = filtered.reduce((a, i) => a + i.total, 0);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY(area));
    setShowModal(true);
  };
  const openEdit = (i: Ingreso) => {
    setEditing(i);
    setForm({ ...i });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const setField = (k: keyof Ingreso, v: unknown) => {
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

  const save = () => {
    if (!form.concepto || !form.cliente) return;
    if (editing) {
      updateIngreso(editing.id, form);
    } else {
      addIngreso({ ...EMPTY(area), ...form, id: uid(), createdAt: new Date().toISOString() } as Ingreso);
    }
    closeModal();
  };

  const sort = (f: typeof sortField) => {
    if (sortField === f) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(f); setSortDir('asc'); }
  };

  const SortIcon = ({ f }: { f: typeof sortField }) =>
    sortField === f ? <ChevronDown size={12} className={sortDir === 'desc' ? '' : 'rotate-180'} /> : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ingresos</h1>
          <p className="text-sm text-gray-500">{filtered.length} registros · Total: {fmt(totalFiltrado)}</p>
        </div>
        {canCreate(area) && (
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400 transition-colors"
          >
            <Plus size={16} /> Nuevo ingreso
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar concepto o cliente…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:border-amber-400"
          />
        </div>
        <select
          value={filterEstado}
          onChange={(e) => setFilter(e.target.value as PaymentStatus | '')}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white"
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => sort('fechaEvento')}>
                  <span className="flex items-center gap-1">Fecha <SortIcon f="fechaEvento" /></span>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Concepto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => sort('cliente')}>
                  <span className="flex items-center gap-1">Cliente <SortIcon f="cliente" /></span>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => sort('total')}>
                  <span className="flex items-center gap-1 justify-end">Total <SortIcon f="total" /></span>
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Factura</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400 text-sm">Sin resultados</td></tr>
              ) : filtered.map((i) => (
                <tr key={i.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{i.fechaEvento}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{i.concepto}</td>
                  <td className="px-4 py-3 text-gray-600">{i.cliente}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">{fmt(i.total)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${estadoColor[i.estadoPago]}`}>
                      {i.estadoPago}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {i.facturaEmitida
                      ? <span className="text-green-600 text-xs font-medium">✓ Emitida</span>
                      : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {canEdit(area) && (
                        <button onClick={() => openEdit(i)} className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors">
                          <Edit2 size={13} />
                        </button>
                      )}
                      {canDelete(area) && (
                        <button onClick={() => showConfirm('¿Eliminar este ingreso? No se puede deshacer.', () => deleteIngreso(i.id))} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal edición */}
      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Editar ingreso' : 'Nuevo ingreso'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label-form">Concepto *</label>
              <input value={form.concepto ?? ''} onChange={(e) => setField('concepto', e.target.value)} className="input-form" placeholder="Descripción del ingreso" />
            </div>
            <div>
              <label className="label-form">Cliente *</label>
              <input value={form.cliente ?? ''} onChange={(e) => setField('cliente', e.target.value)} className="input-form" />
            </div>
            <div>
              <label className="label-form">Tipo</label>
              <select value={form.tipoEvento} onChange={(e) => setField('tipoEvento', e.target.value)} className="input-form">
                {TIPOS_EVENTO.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label-form">Fecha evento</label>
              <input type="date" value={form.fechaEvento ?? ''} onChange={(e) => setField('fechaEvento', e.target.value)} className="input-form" />
            </div>
            <div>
              <label className="label-form">Fecha cobro prevista</label>
              <input type="date" value={form.fechaCobroPrevista ?? ''} onChange={(e) => setField('fechaCobroPrevista', e.target.value)} className="input-form" />
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
              <label className="label-form">Total (con IVA)</label>
              <div className="input-form bg-gray-50 text-gray-700 font-semibold">{fmt(form.total ?? 0)}</div>
            </div>
            <div>
              <label className="label-form">Estado pago</label>
              <select value={form.estadoPago} onChange={(e) => setField('estadoPago', e.target.value)} className="input-form">
                {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label-form">Pagos recibidos (€)</label>
              <input type="number" step="0.01" value={form.pagosRecibidos ?? 0} onChange={(e) => setField('pagosRecibidos', parseFloat(e.target.value) || 0)} className="input-form" />
            </div>
            <div>
              <label className="label-form">Método de pago</label>
              <select value={form.metodoPago} onChange={(e) => setField('metodoPago', e.target.value)} className="input-form">
                {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label-form">Fecha de pago</label>
              <input type="date" value={form.fechaPago ?? ''} onChange={(e) => setField('fechaPago', e.target.value)} className="input-form" />
            </div>
            <div className="col-span-2 flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input type="checkbox" checked={!!form.empresa} onChange={(e) => setField('empresa', e.target.checked)} className="rounded" />
                Es empresa (no particular)
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input type="checkbox" checked={!!form.facturaEmitida} onChange={(e) => setField('facturaEmitida', e.target.checked)} className="rounded" />
                Factura emitida
              </label>
            </div>
            {form.facturaEmitida && (
              <div>
                <label className="label-form">Nº Factura</label>
                <input value={form.numeroFactura ?? ''} onChange={(e) => setField('numeroFactura', e.target.value)} className="input-form" placeholder="LMS-2026-001" />
              </div>
            )}
            <div className="col-span-2">
              <label className="label-form">Notas</label>
              <textarea value={form.notas ?? ''} onChange={(e) => setField('notas', e.target.value)} rows={2} className="input-form resize-none" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={closeModal} className="flex-1 py-2 border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50">Cancelar</button>
            <button onClick={save} className="flex-1 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400">
              {editing ? 'Guardar cambios' : 'Añadir ingreso'}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
