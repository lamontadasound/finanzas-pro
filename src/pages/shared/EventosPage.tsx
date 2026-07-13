import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { uid } from '../../utils/helpers';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Modal } from '../../components/ui/Modal';
import { useConfirmStore } from '../../store/useConfirmStore';
import type { Area, Evento, EventType, EventStatus, GastoEvento, GastoEventoCategoria, PagoEvento, PaymentMethod } from '../../types';

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

const TIPOS: EventType[] = ['boda', 'real_madrid', 'alquiler', 'evento_privado', 'dj_personal', 'empresa', 'otro'];
const ESTADOS: EventStatus[] = ['pendiente', 'confirmado', 'realizado', 'cobrado', 'facturado'];
const CAT_GE: GastoEventoCategoria[] = ['DJ', 'Técnico', 'Fotomatón', 'Personal', 'Gasolina', 'Transporte', 'Hotel', 'Alquiler material', 'Catering', 'Peajes', 'Dietas', 'Proveedores', 'Comisiones', 'Reparaciones', 'Otros'];
const METODOS: PaymentMethod[] = ['efectivo', 'transferencia', 'tarjeta', 'cheque', 'bizum', 'otro'];

const estadoColor: Record<EventStatus, string> = {
  pendiente:  'bg-gray-100 text-gray-600',
  confirmado: 'bg-blue-100 text-blue-700',
  realizado:  'bg-purple-100 text-purple-700',
  cobrado:    'bg-green-100 text-green-700',
  facturado:  'bg-amber-100 text-amber-700',
};

interface Props { area: Area }

const EMPTY_EV = (area: Area): Partial<Evento> => ({
  area, nombre: '', cliente: '', fecha: new Date().toISOString().slice(0, 10),
  tipo: 'boda', presupuesto: 0, pagosRecibidos: 0, estado: 'pendiente',
});

const EMPTY_GE = (eventoId: string, area: Area): Partial<GastoEvento> => ({
  ingresoId: eventoId, area, fecha: new Date().toISOString().slice(0, 10),
  concepto: '', categoria: 'Personal', importe: 0,
});

export const EventosPage = ({ area }: Props) => {
  const allEventos   = useStore((s) => s.eventos);
  const eventos      = useMemo(() => allEventos.filter((e) => e.area === area), [allEventos, area]);
  const gastosEvento = useStore((s) => s.gastosEvento);
  const pagosEvento  = useStore((s) => s.pagosEvento);
  const addEvento    = useStore((s) => s.addEvento);
  const updateEvento = useStore((s) => s.updateEvento);
  const deleteEvento = useStore((s) => s.deleteEvento);
  const addGastoEvento    = useStore((s) => s.addGastoEvento);
  const deleteGastoEvento = useStore((s) => s.deleteGastoEvento);
  const addPagoEvento     = useStore((s) => s.addPagoEvento);
  const deletePagoEvento  = useStore((s) => s.deletePagoEvento);
  const canCreate = useAuthStore((s) => s.canCreate);
  const canEdit   = useAuthStore((s) => s.canEdit);
  const canDelete = useAuthStore((s) => s.canDelete);
  const showConfirm = useConfirmStore((s) => s.show);

  const [search, setSearch]       = useState('');
  const [filterEst, setFilterEst] = useState<EventStatus | ''>('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Evento | null>(null);
  const [form, setForm]           = useState<Partial<Evento>>(EMPTY_EV(area));
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Costes sub-form
  const [geForm, setGeForm] = useState<Partial<GastoEvento> | null>(null);
  // Pago sub-form
  const [pagoForm, setPagoForm] = useState<Partial<PagoEvento> | null>(null);

  const filtered = useMemo(() => {
    let list = [...eventos];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((e) => e.nombre.toLowerCase().includes(q) || e.cliente.toLowerCase().includes(q));
    }
    if (filterEst) list = list.filter((e) => e.estado === filterEst);
    return list.sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [eventos, search, filterEst]);

  const setField = (k: keyof Evento, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const openNew = () => { setEditing(null); setForm(EMPTY_EV(area)); setShowModal(true); };
  const openEdit = (e: Evento) => { setEditing(e); setForm({ ...e }); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const save = () => {
    if (!form.nombre || !form.cliente) return;
    if (editing) {
      updateEvento(editing.id, form);
    } else {
      addEvento({ ...EMPTY_EV(area), ...form, id: uid(), createdAt: new Date().toISOString() } as Evento);
    }
    closeModal();
  };

  const saveGe = () => {
    if (!geForm?.concepto || !geForm.ingresoId) return;
    addGastoEvento({ ...geForm, id: uid(), createdAt: new Date().toISOString() } as GastoEvento);
    setGeForm(null);
  };

  const savePago = () => {
    if (!pagoForm?.importe || !pagoForm.ingresoId) return;
    addPagoEvento({ ...pagoForm, id: uid(), createdAt: new Date().toISOString() } as PagoEvento);
    setPagoForm(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{area === 'montada' ? 'Eventos' : 'Actuaciones'}</h1>
          <p className="text-sm text-gray-500">{filtered.length} registros</p>
        </div>
        {canCreate(area) && (
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400 transition-colors">
            <Plus size={16} /> Nuevo evento
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nombre o cliente…" className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:border-amber-400" />
        </div>
        <select value={filterEst} onChange={(e) => setFilterEst(e.target.value as EventStatus | '')} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
          <option value="">Todos los estados</option>
          {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-center py-12 text-gray-400 text-sm">Sin eventos</p>}
        {filtered.map((ev) => {
          const gesEv = gastosEvento.filter((g) => g.ingresoId === ev.id);
          const pagEv = pagosEvento.filter((p) => p.ingresoId === ev.id);
          const totalCostes = gesEv.reduce((a, g) => a + g.importe, 0);
          const totalPagos  = pagEv.reduce((a, p) => a + p.importe, 0);
          const isOpen = expandedId === ev.id;

          return (
            <div key={ev.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              {/* Header fila */}
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{ev.nombre}</p>
                  <p className="text-xs text-gray-500">{ev.cliente} · {ev.fecha} · {ev.tipo.replace(/_/g, ' ')}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-semibold text-gray-900">{fmt(ev.presupuesto)}</p>
                  <p className="text-xs text-gray-400">Ppto · Pag: {fmt(totalPagos)}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${estadoColor[ev.estado]}`}>{ev.estado}</span>
                <div className="flex gap-1">
                  {canEdit(area) && <button onClick={() => openEdit(ev)} className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg"><Edit2 size={13} /></button>}
                  {canDelete(area) && <button onClick={() => showConfirm('¿Eliminar este evento?', () => deleteEvento(ev.id))} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>}
                  <button onClick={() => setExpandedId(isOpen ? null : ev.id)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                    {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                </div>
              </div>

              {/* Detalle expandido */}
              {isOpen && (
                <div className="border-t border-gray-100 p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Costes */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Costes del evento</p>
                      {canCreate(area) && (
                        <button onClick={() => setGeForm(EMPTY_GE(ev.id, area))} className="text-xs text-amber-600 hover:text-amber-500 font-medium">+ Añadir</button>
                      )}
                    </div>
                    {gesEv.length === 0 && <p className="text-xs text-gray-400">Sin costes</p>}
                    {gesEv.map((g) => (
                      <div key={g.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                        <div className="flex-1">
                          <p className="text-xs font-medium text-gray-800">{g.concepto}</p>
                          <p className="text-[10px] text-gray-400">{g.categoria} · {g.fecha}</p>
                        </div>
                        <p className="text-xs font-mono font-semibold text-gray-700">{fmt(g.importe)}</p>
                        {canDelete(area) && <button onClick={() => showConfirm('¿Eliminar coste?', () => deleteGastoEvento(g.id))} className="text-gray-300 hover:text-red-400"><Trash2 size={11} /></button>}
                      </div>
                    ))}
                    {gesEv.length > 0 && <p className="text-xs text-right font-semibold text-gray-700 mt-1">Total: {fmt(totalCostes)}</p>}
                  </div>

                  {/* Pagos */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Pagos recibidos</p>
                      {canCreate(area) && (
                        <button onClick={() => setPagoForm({ ingresoId: ev.id, area, fecha: new Date().toISOString().slice(0, 10), importe: 0, metodoPago: 'transferencia', concepto: 'Pago' })} className="text-xs text-amber-600 hover:text-amber-500 font-medium">+ Añadir</button>
                      )}
                    </div>
                    {pagEv.length === 0 && <p className="text-xs text-gray-400">Sin pagos</p>}
                    {pagEv.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                        <div className="flex-1">
                          <p className="text-xs font-medium text-gray-800">{p.concepto}</p>
                          <p className="text-[10px] text-gray-400">{p.metodoPago} · {p.fecha}</p>
                        </div>
                        <p className="text-xs font-mono font-semibold text-green-700">{fmt(p.importe)}</p>
                        {canDelete(area) && <button onClick={() => showConfirm('¿Eliminar pago?', () => deletePagoEvento(p.id))} className="text-gray-300 hover:text-red-400"><Trash2 size={11} /></button>}
                      </div>
                    ))}
                    {pagEv.length > 0 && <p className="text-xs text-right font-semibold text-green-700 mt-1">Total: {fmt(totalPagos)}</p>}
                  </div>
                </div>
              )}

              {/* Benefit real inline */}
              {isOpen && (
                <div className="px-5 pb-4 flex gap-4 text-xs text-gray-500">
                  <span>Presupuesto: <strong className="text-gray-800">{fmt(ev.presupuesto)}</strong></span>
                  <span>Costes: <strong className="text-red-600">{fmt(totalCostes)}</strong></span>
                  <span>Beneficio real: <strong className={ev.presupuesto - totalCostes >= 0 ? 'text-green-700' : 'text-red-600'}>{fmt(ev.presupuesto - totalCostes)}</strong></span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal evento */}
      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Editar evento' : 'Nuevo evento'} size="md">
        <div className="space-y-4">
          <div>
            <label className="label-form">Nombre *</label>
            <input value={form.nombre ?? ''} onChange={(e) => setField('nombre', e.target.value)} className="input-form" />
          </div>
          <div>
            <label className="label-form">Cliente *</label>
            <input value={form.cliente ?? ''} onChange={(e) => setField('cliente', e.target.value)} className="input-form" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-form">Fecha</label>
              <input type="date" value={form.fecha ?? ''} onChange={(e) => setField('fecha', e.target.value)} className="input-form" />
            </div>
            <div>
              <label className="label-form">Tipo</label>
              <select value={form.tipo} onChange={(e) => setField('tipo', e.target.value)} className="input-form">
                {TIPOS.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label-form">Presupuesto (€)</label>
              <input type="number" step="0.01" value={form.presupuesto ?? 0} onChange={(e) => setField('presupuesto', parseFloat(e.target.value) || 0)} className="input-form" />
            </div>
            <div>
              <label className="label-form">Estado</label>
              <select value={form.estado} onChange={(e) => setField('estado', e.target.value)} className="input-form">
                {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label-form">Notas</label>
            <textarea value={form.notas ?? ''} onChange={(e) => setField('notas', e.target.value)} rows={2} className="input-form" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={closeModal} className="flex-1 py-2 border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50">Cancelar</button>
            <button onClick={save} className="flex-1 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400">{editing ? 'Guardar' : 'Crear evento'}</button>
          </div>
        </div>
      </Modal>

      {/* Modal coste evento */}
      <Modal isOpen={!!geForm} onClose={() => setGeForm(null)} title="Añadir coste" size="sm">
        {geForm && (
          <div className="space-y-4">
            <div>
              <label className="label-form">Concepto</label>
              <input value={geForm.concepto ?? ''} onChange={(e) => setGeForm((f) => f ? { ...f, concepto: e.target.value } : f)} className="input-form" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-form">Categoría</label>
                <select value={geForm.categoria} onChange={(e) => setGeForm((f) => f ? { ...f, categoria: e.target.value as GastoEventoCategoria } : f)} className="input-form">
                  {CAT_GE.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label-form">Importe (€)</label>
                <input type="number" step="0.01" value={geForm.importe ?? 0} onChange={(e) => setGeForm((f) => f ? { ...f, importe: parseFloat(e.target.value) || 0 } : f)} className="input-form" />
              </div>
              <div className="col-span-2">
                <label className="label-form">Fecha</label>
                <input type="date" value={geForm.fecha ?? ''} onChange={(e) => setGeForm((f) => f ? { ...f, fecha: e.target.value } : f)} className="input-form" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setGeForm(null)} className="flex-1 py-2 border border-gray-200 text-sm rounded-xl hover:bg-gray-50">Cancelar</button>
              <button onClick={saveGe} className="flex-1 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400">Añadir</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal pago */}
      <Modal isOpen={!!pagoForm} onClose={() => setPagoForm(null)} title="Registrar pago" size="sm">
        {pagoForm && (
          <div className="space-y-4">
            <div>
              <label className="label-form">Concepto</label>
              <input value={pagoForm.concepto ?? ''} onChange={(e) => setPagoForm((f) => f ? { ...f, concepto: e.target.value } : f)} className="input-form" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-form">Importe (€)</label>
                <input type="number" step="0.01" value={pagoForm.importe ?? 0} onChange={(e) => setPagoForm((f) => f ? { ...f, importe: parseFloat(e.target.value) || 0 } : f)} className="input-form" />
              </div>
              <div>
                <label className="label-form">Método</label>
                <select value={pagoForm.metodoPago} onChange={(e) => setPagoForm((f) => f ? { ...f, metodoPago: e.target.value as PaymentMethod } : f)} className="input-form">
                  {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label-form">Fecha</label>
                <input type="date" value={pagoForm.fecha ?? ''} onChange={(e) => setPagoForm((f) => f ? { ...f, fecha: e.target.value } : f)} className="input-form" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setPagoForm(null)} className="flex-1 py-2 border border-gray-200 text-sm rounded-xl hover:bg-gray-50">Cancelar</button>
              <button onClick={savePago} className="flex-1 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400">Registrar</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
