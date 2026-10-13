import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Folder, ChevronLeft, Landmark } from 'lucide-react';
import { motion } from 'framer-motion';
import { uid } from '../../utils/helpers';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { StatCard } from '../../components/ui/StatCard';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { useConfirmStore } from '../../store/useConfirmStore';
import { usePermittedFinancialData } from '../../hooks/usePermittedFinancialData';
import { trimestreDeMes } from '../../components/ui/yqm';
import {Link} from 'react-router-dom';
import { IMPUESTO_TIPO_LABEL } from '../../types';
import type { Impuesto, ImpuestoTipo } from '../../types';

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const TRIMESTRES = ['T1 (Ene–Mar)', 'T2 (Abr–Jun)', 'T3 (Jul–Sep)', 'T4 (Oct–Dic)'];

const TIPOS: ImpuestoTipo[] = ['autonomos', 'nominas_ss', 'iva', 'sociedades', 'gestoria'];

const EMPTY = (tipo: ImpuestoTipo): Partial<Impuesto> => ({
  tipo, concepto: '', fecha: new Date().toISOString().slice(0, 10),
  importe: 0, estado: 'pendiente', observaciones: '',
});

export const ImpuestosPage = () => {
  const { impuestos } = usePermittedFinancialData();
  const addImpuesto = useStore((s) => s.addImpuesto);
  const updateImpuesto = useStore((s) => s.updateImpuesto);
  const deleteImpuesto = useStore((s) => s.deleteImpuesto);
  const canCreate = useAuthStore((s) => s.canCreateModulo);
  const canEdit = useAuthStore((s) => s.canEditModulo);
  const canDelete = useAuthStore((s) => s.canDeleteModulo);
  const showConfirm = useConfirmStore((s) => s.show);

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedTrimestre, setSelectedTrimestre] = useState<number | null>(null);
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

  const trimestresDelAnio = useMemo(() => {
    if (selectedYear == null) return [];
    const map = new Map<number, { count: number; total: number }>();
    impuestos.filter((i) => new Date(i.fecha).getFullYear() === selectedYear).forEach((i) => {
      const t = trimestreDeMes(new Date(i.fecha).getMonth());
      const cur = map.get(t) ?? { count: 0, total: 0 };
      map.set(t, { count: cur.count + 1, total: cur.total + i.importe });
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [impuestos, selectedYear]);

  const mesesDelTrimestre = useMemo(() => {
    if (selectedYear == null || selectedTrimestre == null) return [];
    const map = new Map<number, { count: number; total: number }>();
    impuestos.filter((i) => {
      const d = new Date(i.fecha);
      return d.getFullYear() === selectedYear && trimestreDeMes(d.getMonth()) === selectedTrimestre;
    }).forEach((i) => {
      const m = new Date(i.fecha).getMonth();
      const cur = map.get(m) ?? { count: 0, total: 0 };
      map.set(m, { count: cur.count + 1, total: cur.total + i.importe });
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [impuestos, selectedYear, selectedTrimestre]);

  const totalAnio = useMemo(() => {
    if (selectedYear == null) return 0;
    return impuestos.filter((i) => new Date(i.fecha).getFullYear() === selectedYear).reduce((a, i) => a + i.importe, 0);
  }, [impuestos, selectedYear]);

  const totalTrimestre = useMemo(() => {
    if (selectedYear == null || selectedTrimestre == null) return 0;
    return impuestos.filter((i) => {
      const d = new Date(i.fecha);
      return d.getFullYear() === selectedYear && trimestreDeMes(d.getMonth()) === selectedTrimestre;
    }).reduce((a, i) => a + i.importe, 0);
  }, [impuestos, selectedYear, selectedTrimestre]);

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

  const save = async () => {
    if (!form.concepto || !form.fecha || !form.tipo) return;
    if (editing) {
      if (!await updateImpuesto(editing.id, form)) return;
    } else {
      if (!await addImpuesto({
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
      } as Impuesto)) return;
    }
    closeModal();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Impuestos</h1>
          
        </div>
        {canCreate('impuestos') && (
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => openNew('autonomos')} className="flex-shrink-0">
            Nuevo impuesto
          </Button>
        )}
      </div>

      {/* Breadcrumb Año → Trimestre → Mes */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={() => { setSelectedYear(null); setSelectedTrimestre(null); setSelectedMonth(null); }} className={`font-medium transition-colors ${selectedYear == null ? 'text-gray-900' : 'text-gold-600 hover:text-gold-500'}`}>Años</button>
        {selectedYear != null && (
          <>
            <span className="text-gray-300">/</span>
            <button onClick={() => { setSelectedTrimestre(null); setSelectedMonth(null); }} className={`font-medium transition-colors ${selectedTrimestre == null ? 'text-gray-900' : 'text-gold-600 hover:text-gold-500'}`}>{selectedYear}</button>
          </>
        )}
        {selectedYear != null && selectedTrimestre != null && (
          <>
            <span className="text-gray-300">/</span>
            <button onClick={() => setSelectedMonth(null)} className={`font-medium transition-colors ${selectedMonth == null ? 'text-gray-900' : 'text-gold-600 hover:text-gold-500'}`}>{TRIMESTRES[selectedTrimestre].slice(0, 2)}</button>
          </>
        )}
        {selectedYear != null && selectedTrimestre != null && selectedMonth != null && (
          <>
            <span className="text-gray-300">/</span>
            <span className="font-medium text-gray-900">{MESES_FULL[selectedMonth]}</span>
          </>
        )}
      </div>

      {/* Nivel 1: años */}
      {selectedYear == null && (
        anios.length === 0 ? (
          <EmptyState icon={<Landmark size={22} />} title="Sin impuestos registrados todavía" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {anios.map(([y, data], idx) => (
              <motion.button
                key={y}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.03 }}
                onClick={() => setSelectedYear(y)}
                className="bg-white border border-gray-200 rounded-card p-5 text-left hover:border-gold-400 hover:shadow-raised transition-all duration-220 ease-smooth"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Folder size={16} className="text-gold-500" />
                  <span className="text-lg font-bold text-gray-900">{y}</span>
                </div>
                <p className="text-xs text-gray-500">{data.count} registros</p>
                <p className="text-sm font-semibold text-gray-700 mt-1">{fmt(data.total)}</p>
              </motion.button>
            ))}
          </div>
        )
      )}

      {/* Nivel 2: trimestres dentro del año */}
      {selectedYear != null && selectedTrimestre == null && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setSelectedYear(null)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors"><ChevronLeft size={14} /> Volver a años</button>
            <p className="text-sm text-gray-600">Total {selectedYear}: <span className="font-semibold text-gray-900">{fmt(totalAnio)}</span></p>
          </div>
          {trimestresDelAnio.length === 0 ? (
            <EmptyState icon={<Landmark size={22} />} title={`Sin impuestos en ${selectedYear}`} />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {trimestresDelAnio.map(([t, data], idx) => (
                <motion.button
                  key={t}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.03 }}
                  onClick={() => setSelectedTrimestre(t)}
                  className="bg-white border border-gray-200 rounded-card p-5 text-left hover:border-gold-400 hover:shadow-raised transition-all duration-220 ease-smooth"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Folder size={16} className="text-gold-500" />
                    <span className="font-bold text-gray-900">{TRIMESTRES[t]}</span>
                  </div>
                  <p className="text-xs text-gray-500">{data.count} registros</p>
                  <p className="text-sm font-semibold text-gray-700 mt-1">{fmt(data.total)}</p>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Nivel 3: meses dentro del trimestre */}
      {selectedYear != null && selectedTrimestre != null && selectedMonth == null && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setSelectedTrimestre(null)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors"><ChevronLeft size={14} /> Volver a trimestres</button>
            <p className="text-sm text-gray-600">Total {TRIMESTRES[selectedTrimestre]}: <span className="font-semibold text-gray-900">{fmt(totalTrimestre)}</span></p>
          </div>
          {mesesDelTrimestre.length === 0 ? (
            <EmptyState icon={<Landmark size={22} />} title="Sin impuestos en este trimestre" />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {mesesDelTrimestre.map(([m, data], idx) => (
                <motion.button
                  key={m}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.03 }}
                  onClick={() => setSelectedMonth(m)}
                  className="bg-white border border-gray-200 rounded-card p-5 text-left hover:border-gold-400 hover:shadow-raised transition-all duration-220 ease-smooth"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Folder size={16} className="text-gold-500" />
                    <span className="font-bold text-gray-900">{MESES_FULL[m]}</span>
                  </div>
                  <p className="text-xs text-gray-500">{data.count} registros</p>
                  <p className="text-sm font-semibold text-gray-700 mt-1">{fmt(data.total)}</p>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Nivel 4: detalle del mes — 4 apartados fijos + IVA estimado + otros */}
      {selectedYear != null && selectedTrimestre != null && selectedMonth != null && (
        <div className="space-y-5">
          <button onClick={() => setSelectedMonth(null)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors"><ChevronLeft size={14} /> Volver a meses</button>

          {/* Totales del mes */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Total del mes" value={totalesMes.total} format={fmt} />
            <StatCard label="Total pagado" value={totalesMes.pagado} format={fmt} tone="success" />
            <StatCard label="Total pendiente" value={totalesMes.pendiente} format={fmt} tone="gold" />
          </div>

          <Link to="/contabilidad/resumen" className="inline-flex text-sm underline">Consultar estimación de IVA y gastos de Drive en el resumen contable</Link>

          {/* Desglose por tipo — los 4 apartados fijos */}
          {totalesMes.porTipo.map(({ tipo, items, total }) => (
            <div key={tipo} className="bg-white border border-gray-200 rounded-card shadow-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/60">
                <div>
                  <h2 className="text-sm font-semibold text-gray-800">{IMPUESTO_TIPO_LABEL[tipo]}</h2>
                  <p className="text-xs text-gray-500">{items.length} registro(s) · {fmt(total)}</p>
                </div>
                {canCreate('impuestos') && (
                  <Button size="sm" variant="primary" icon={<Plus size={12} />} onClick={() => openNew(tipo)}>
                    Añadir
                  </Button>
                )}
              </div>
              {items.length === 0 ? (
                <p className="text-center py-6 text-gray-400 text-sm">Sin registros</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {items.map((i) => (
                    <div key={i.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-5 py-3 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">{i.concepto}</p>
                        <p className="text-xs text-gray-400">
                          {i.fecha}
                          {i.lineaNegocio && <> · {i.lineaNegocio}</>}
                          {i.fechaPago && <> · Pagado el {i.fechaPago}</>}
                        </p>
                        {i.observaciones && <p className="text-xs text-gray-400 mt-0.5">{i.observaciones}</p>}
                      </div>
                      <div className="flex items-center gap-3 justify-between sm:justify-end">
                        <Badge tone={i.estado === 'pagado' ? 'success' : 'danger'}>{i.estado === 'pagado' ? 'Pagado' : 'Pendiente'}</Badge>
                        <span className="font-mono font-semibold text-gray-900 w-24 text-right">{fmt(i.importe)}</span>
                        <div className="flex items-center gap-1">
                          {canEdit('impuestos') && <button onClick={() => openEdit(i)} aria-label="Editar" className="p-1.5 text-gray-400 hover:text-gold-500 hover:bg-gold-50 rounded-lg transition-colors"><Edit2 size={13} /></button>}
                          {canDelete('impuestos') && <button onClick={() => showConfirm('¿Eliminar este impuesto?', () => deleteImpuesto(i.id))} aria-label="Eliminar" className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={13} /></button>}
                        </div>
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
            <Button variant="secondary" onClick={closeModal} className="flex-1">Cancelar</Button>
            <Button variant="primary" onClick={save} className="flex-1">{editing ? 'Guardar' : 'Añadir impuesto'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
