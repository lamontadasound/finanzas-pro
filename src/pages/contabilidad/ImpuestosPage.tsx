import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Folder, ChevronLeft } from 'lucide-react';
import { uid } from '../../utils/helpers';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Modal } from '../../components/ui/Modal';
import { useConfirmStore } from '../../store/useConfirmStore';
import { IMPUESTO_TIPO_LABEL } from '../../types';
import type { Impuesto, ImpuestoTipo } from '../../types';

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const TIPOS: ImpuestoTipo[] = ['autonomos', 'nominas_ss', 'iva', 'sociedades'];

const EMPTY = (tipo: ImpuestoTipo): Partial<Impuesto> => ({
  tipo, concepto: '', fecha: new Date().toISOString().slice(0, 10),
  importe: 0, estado: 'pendiente', observaciones: '',
});

export const ImpuestosPage = () => {
  const impuestos = useStore((s) => s.impuestos);
  const addImpuesto = useStore((s) => s.addImpuesto);
  const updateImpuesto = useStore((s) => s.updateImpuesto);
  const deleteImpuesto = useStore((s) => s.deleteImpuesto);
  const canCreate = useAuthStore((s) => s.canCreate);
  const canEdit = useAuthStore((s) => s.canEdit);
  const canDelete = useAuthStore((s) => s.canDelete);
  const showConfirm = useConfirmStore((s) => s.show);

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Impuesto | null>(null);
  const [form, setForm] = useState<Partial<Impuesto>>(EMPTY('autonomos'));

  const anios = useMemo(() => {
    const map = new Map<number, { count: number; total: number }>();
    impuestos.forEach((i) => {
      const y = new Date(i.fecha).getFullYear();
      const cur = map.get(y) ?? { count: 0, total: 0 };
      map.set(y, { count: cur.count + 1, total: cur.total + i.importe });
    });
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  }, [impuestos]);

  const mesesDelAnio = useMemo(() => {
    if (selectedYear == null) return [];
    const map = new Map<number, { count: number; total: number }>();
    impuestos.filter((i) => new Date(i.fecha).getFullYear() === selectedYear).forEach((i) => {
      const m = new Date(i.fecha).getMonth();
      const cur = map.get(m) ?? { count: 0, total: 0 };
      map.set(m, { count: cur.count + 1, total: cur.total + i.importe });
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [impuestos, selectedYear]);

  const totalAnio = useMemo(() => {
    if (selectedYear == null) return 0;
    return impuestos.filter((i) => new Date(i.fecha).getFullYear() === selectedYear).reduce((a, i) => a + i.importe, 0);
  }, [impuestos, selectedYear]);

  const enElMes = useMemo(() => {
    if (selectedYear == null || selectedMonth == null) return [];
    return impuestos.filter((i) => {
      const d = new Date(i.fecha);
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    });
  }, [impuestos, selectedYear, selectedMonth]);

  const totalesMes = useMemo(() => {
    const total = enElMes.reduce((a, i) => a + i.importe, 0);
    const pagado = enElMes.filter((i) => i.estado === 'pagado').reduce((a, i) => a + i.importe, 0);
    const pendiente = total - pagado;
    const porTipo = TIPOS.map((tipo) => ({
      tipo,
      items: enElMes.filter((i) => i.tipo === tipo),
      total: enElMes.filter((i) => i.tipo === tipo).reduce((a, i) => a + i.importe, 0),
    }));
    return { total, pagado, pendiente, porTipo };
  }, [enElMes]);

  const setField = (k: keyof Impuesto, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const openNew = (tipo: ImpuestoTipo) => {
    setEditing(null);
    setForm({
      ...EMPTY(tipo),
      fecha: selectedYear != null && selectedMonth != null
        ? new Date(selectedYear, selectedMonth, 1).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    });
    setShowModal(true);
  };
  const openEdit = (i: Impuesto) => { setEditing(i); setForm({ ...i }); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const save = () => {
    if (!form.concepto || !form.fecha || !form.tipo) return;
    if (editing) {
      updateImpuesto(editing.id, form);
    } else {
      addImpuesto({
        id: uid(),
        tipo: form.tipo,
        concepto: form.concepto,
        fecha: form.fecha,
        importe: Number(form.importe ?? 0),
        estado: form.estado ?? 'pendiente',
        fechaPago: form.fechaPago,
        observaciones: form.observaciones,
        lineaNegocio: form.lineaNegocio,
        createdAt: new Date().toISOString(),
      } as Impuesto);
    }
    closeModal();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Impuestos</h1>
          <p className="text-sm text-gray-500">Cuota de autónomos, Nóminas y S.S., IVA e Impuesto de Sociedades — organizado por año y mes</p>
        </div>
        {canCreate('impuestos') && (
          <button onClick={() => openNew('autonomos')} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400 transition-colors flex-shrink-0">
            <Plus size={16} /> Nuevo impuesto
          </button>
        )}
      </div>

      {/* Breadcrumb Año → Mes */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={() => { setSelectedYear(null); setSelectedMonth(null); }} className={`font-medium ${selectedYear == null ? 'text-gray-900' : 'text-amber-600 hover:text-amber-500'}`}>Años</button>
        {selectedYear != null && (
          <>
            <span className="text-gray-300">/</span>
            <button onClick={() => setSelectedMonth(null)} className={`font-medium ${selectedMonth == null ? 'text-gray-900' : 'text-amber-600 hover:text-amber-500'}`}>{selectedYear}</button>
          </>
        )}
        {selectedYear != null && selectedMonth != null && (
          <>
            <span className="text-gray-300">/</span>
            <span className="font-medium text-gray-900">{MESES_FULL[selectedMonth]}</span>
          </>
        )}
      </div>

      {/* Nivel 1: años */}
      {selectedYear == null && (
        anios.length === 0 ? (
          <p className="text-center py-16 text-gray-400 text-sm">Sin impuestos registrados todavía</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {anios.map(([y, data]) => (
              <button key={y} onClick={() => setSelectedYear(y)} className="bg-white border border-gray-200 rounded-2xl p-5 text-left hover:border-amber-400 hover:shadow-sm transition-all">
                <div className="flex items-center gap-2 mb-2">
                  <Folder size={16} className="text-amber-500" />
                  <span className="text-lg font-bold text-gray-900">{y}</span>
                </div>
                <p className="text-xs text-gray-500">{data.count} registros</p>
                <p className="text-sm font-semibold text-gray-700 mt-1">{fmt(data.total)}</p>
              </button>
            ))}
          </div>
        )
      )}

      {/* Nivel 2: meses dentro del año */}
      {selectedYear != null && selectedMonth == null && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setSelectedYear(null)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"><ChevronLeft size={14} /> Volver a años</button>
            <p className="text-sm text-gray-600">Total {selectedYear}: <span className="font-semibold text-gray-900">{fmt(totalAnio)}</span></p>
          </div>
          {mesesDelAnio.length === 0 ? (
            <p className="text-center py-16 text-gray-400 text-sm">Sin impuestos en {selectedYear}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {mesesDelAnio.map(([m, data]) => (
                <button key={m} onClick={() => setSelectedMonth(m)} className="bg-white border border-gray-200 rounded-2xl p-5 text-left hover:border-amber-400 hover:shadow-sm transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <Folder size={16} className="text-amber-500" />
                    <span className="font-bold text-gray-900">{MESES_FULL[m]}</span>
                  </div>
                  <p className="text-xs text-gray-500">{data.count} registros</p>
                  <p className="text-sm font-semibold text-gray-700 mt-1">{fmt(data.total)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Nivel 3: detalle del mes — 4 apartados fijos */}
      {selectedYear != null && selectedMonth != null && (
        <div className="space-y-5">
          <button onClick={() => setSelectedMonth(null)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"><ChevronLeft size={14} /> Volver a meses</button>

          {/* Totales del mes */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="text-xs text-gray-500 uppercase">Total del mes</p>
              <p className="text-xl font-bold text-gray-900">{fmt(totalesMes.total)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="text-xs text-gray-500 uppercase">Total pagado</p>
              <p className="text-xl font-bold text-green-700">{fmt(totalesMes.pagado)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="text-xs text-gray-500 uppercase">Total pendiente</p>
              <p className="text-xl font-bold text-amber-600">{fmt(totalesMes.pendiente)}</p>
            </div>
          </div>

          {/* Desglose por tipo — los 4 apartados fijos */}
          {totalesMes.porTipo.map(({ tipo, items, total }) => (
            <div key={tipo} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/60">
                <div>
                  <h2 className="text-sm font-semibold text-gray-800">{IMPUESTO_TIPO_LABEL[tipo]}</h2>
                  <p className="text-xs text-gray-500">{items.length} registro(s) · {fmt(total)}</p>
                </div>
                {canCreate('impuestos') && (
                  <button onClick={() => openNew(tipo)} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-black text-xs font-semibold rounded-lg hover:bg-amber-400">
                    <Plus size={12} /> Añadir
                  </button>
                )}
              </div>
              {items.length === 0 ? (
                <p className="text-center py-6 text-gray-400 text-sm">Sin registros</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {items.map((i) => (
                    <div key={i.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">{i.concepto}</p>
                        <p className="text-xs text-gray-400">
                          {i.fecha}
                          {i.lineaNegocio && <> · {i.lineaNegocio}</>}
                          {i.fechaPago && <> · Pagado el {i.fechaPago}</>}
                        </p>
                        {i.observaciones && <p className="text-xs text-gray-400 mt-0.5">{i.observaciones}</p>}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${i.estado === 'pagado' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {i.estado === 'pagado' ? 'Pagado' : 'Pendiente'}
                      </span>
                      <span className="font-mono font-semibold text-gray-900 w-24 text-right">{fmt(i.importe)}</span>
                      <div className="flex items-center gap-1">
                        {canEdit('impuestos') && <button onClick={() => openEdit(i)} className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg"><Edit2 size={13} /></button>}
                        {canDelete('impuestos') && <button onClick={() => showConfirm('¿Eliminar este impuesto?', () => deleteImpuesto(i.id))} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Editar impuesto' : 'Nuevo impuesto'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label-form">Tipo *</label>
              <select value={form.tipo ?? 'autonomos'} onChange={(e) => setField('tipo', e.target.value as ImpuestoTipo)} className="input-form">
                {TIPOS.map((t) => <option key={t} value={t}>{IMPUESTO_TIPO_LABEL[t]}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label-form">Concepto *</label>
              <input value={form.concepto ?? ''} onChange={(e) => setField('concepto', e.target.value)} className="input-form" placeholder="Ej. Cuota RETA julio 2026" />
            </div>
            <div>
              <label className="label-form">Fecha *</label>
              <input type="date" value={form.fecha ?? ''} onChange={(e) => setField('fecha', e.target.value)} className="input-form" />
            </div>
            <div>
              <label className="label-form">Importe (€) *</label>
              <input type="number" step="0.01" value={form.importe ?? 0} onChange={(e) => setField('importe', parseFloat(e.target.value) || 0)} className="input-form" />
            </div>
            <div>
              <label className="label-form">Estado</label>
              <select value={form.estado ?? 'pendiente'} onChange={(e) => setField('estado', e.target.value as Impuesto['estado'])} className="input-form">
                <option value="pendiente">Pendiente</option>
                <option value="pagado">Pagado</option>
              </select>
            </div>
            <div>
              <label className="label-form">Fecha de pago</label>
              <input type="date" value={form.fechaPago ?? ''} onChange={(e) => setField('fechaPago', e.target.value)} className="input-form" />
            </div>
            <div className="col-span-2">
              <label className="label-form">Línea de negocio / empresa relacionada</label>
              <select value={form.lineaNegocio ?? ''} onChange={(e) => setField('lineaNegocio', e.target.value || undefined)} className="input-form">
                <option value="">— No aplica / conjunto —</option>
                <option value="La Montada Sound">La Montada Sound</option>
                <option value="DJs">DJs</option>
                <option value="Real Madrid">Real Madrid</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="label-form">Observaciones</label>
              <textarea value={form.observaciones ?? ''} onChange={(e) => setField('observaciones', e.target.value)} rows={2} className="input-form" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={closeModal} className="flex-1 py-2 border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50">Cancelar</button>
            <button onClick={save} className="flex-1 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400">{editing ? 'Guardar' : 'Añadir impuesto'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
