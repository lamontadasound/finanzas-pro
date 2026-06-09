/**
 * EventoDetailModal — Modal completo de un evento/ingreso
 * ─────────────────────────────────────────────────────────────────────────────
 * 4 pestañas:
 *   Detalles         → formulario editable del ingreso
 *   Costes evento    → gastos directos del evento (GastoEvento)
 *   Pagos recibidos  → cobros del cliente (PagoEvento)
 *   Resumen          → cálculo financiero: beneficio, margen, IVA, IS
 */
import { useState, useMemo } from 'react';
import { Plus, Trash2, X, Save } from 'lucide-react';
import { Modal } from './Modal';
import { useStore } from '../../store/useStore';
import {
  fmt, fmtDate, uid, METODO_PAGO_LABELS, EVENT_TYPE_LABELS,
  PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS, calcIVA,
} from '../../utils/helpers';
import { useConfirmStore } from '../../store/useConfirmStore';
import type { Ingreso, GastoEvento, PagoEvento, GastoEventoCategoria } from '../../types';

// ── Constantes ────────────────────────────────────────────────────────────────

const GASTO_EVENTO_CATEGORIAS: GastoEventoCategoria[] = [
  'DJ', 'Técnico', 'Fotomatón', 'Gasolina', 'Hotel',
  'Alquiler material', 'Catering', 'Peajes', 'Dietas', 'Otros',
];

type ModalTab = 'detalles' | 'costes' | 'pagos' | 'resumen';

const TAB_LABELS: { id: ModalTab; label: string }[] = [
  { id: 'detalles', label: 'Detalles' },
  { id: 'costes',   label: 'Costes del evento' },
  { id: 'pagos',    label: 'Pagos recibidos' },
  { id: 'resumen',  label: 'Resumen financiero' },
];

const IVA_OPTS = [0, 4, 10, 21];

// ── Plantillas vacías ─────────────────────────────────────────────────────────

const emptyGastoEvento = (ingreso: Ingreso): Omit<GastoEvento, 'id' | 'createdAt'> => ({
  ingresoId: ingreso.id, area: ingreso.area,
  fecha: new Date().toISOString().slice(0, 10),
  concepto: '', categoria: 'Otros', importe: 0,
});

const emptyPagoEvento = (ingreso: Ingreso): Omit<PagoEvento, 'id' | 'createdAt'> => ({
  ingresoId: ingreso.id, area: ingreso.area,
  fecha: new Date().toISOString().slice(0, 10),
  importe: 0, metodoPago: 'transferencia', concepto: 'Pago cliente',
});

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  ingreso: Ingreso | null;
  onClose: () => void;
  onUpdate: (id: string, partial: Partial<Ingreso>) => void;
  initialTab?: ModalTab;
}

// ── Componente principal ──────────────────────────────────────────────────────

export const EventoDetailModal = ({ ingreso, onClose, onUpdate, initialTab = 'detalles' }: Props) => {
  const {
    gastosEvento, pagosEvento,
    addGastoEvento, deleteGastoEvento,
    addPagoEvento, deletePagoEvento,
  } = useStore();
  const showConfirm = useConfirmStore((s) => s.show);

  const [tab, setTab] = useState<ModalTab>(initialTab);

  // ── Estado del formulario de edición ────────────────────────────────────────
  const [editForm, setEditForm] = useState<Partial<Ingreso>>({});
  const [dirty, setDirty] = useState(false);

  // Sincronizar form cuando cambia el ingreso
  const form = ingreso ? { ...ingreso, ...editForm } : null;

  const setField = (k: keyof Ingreso, v: unknown) => {
    setDirty(true);
    setEditForm((prev) => {
      const next = { ...prev, [k]: v };
      if (k === 'baseImponible' || k === 'porcentajeIVA') {
        const r = calcIVA(
          Number(k === 'baseImponible' ? v : (prev.baseImponible ?? ingreso?.baseImponible ?? 0)),
          Number(k === 'porcentajeIVA' ? v : (prev.porcentajeIVA ?? ingreso?.porcentajeIVA ?? 21)),
        );
        return { ...next, ...r };
      }
      return next;
    });
  };

  const saveDetalles = () => {
    if (!ingreso || !dirty) return;
    onUpdate(ingreso.id, editForm);
    setDirty(false);
    setEditForm({});
  };

  // ── Formularios de costes y pagos ────────────────────────────────────────────
  const [gastoForm, setGastoForm] = useState<Omit<GastoEvento, 'id' | 'createdAt'> | null>(null);
  const [pagoForm, setPagoForm] = useState<Omit<PagoEvento, 'id' | 'createdAt'> | null>(null);

  // ── Datos derivados ──────────────────────────────────────────────────────────
  const myGastos = useMemo(
    () => ingreso ? gastosEvento.filter((g) => g.ingresoId === ingreso.id).sort((a, b) => a.fecha.localeCompare(b.fecha)) : [],
    [gastosEvento, ingreso],
  );
  const myPagos = useMemo(
    () => ingreso ? pagosEvento.filter((p) => p.ingresoId === ingreso.id).sort((a, b) => a.fecha.localeCompare(b.fecha)) : [],
    [pagosEvento, ingreso],
  );

  if (!ingreso || !form) return null;

  const totalCostes    = myGastos.reduce((s, g) => s + g.importe, 0);
  const totalCobrado   = myPagos.reduce((s, p) => s + p.importe, 0);
  const pendienteCobro = form.total - totalCobrado;
  const beneficioBruto = form.baseImponible - totalCostes;
  const margen         = form.baseImponible > 0 ? (beneficioBruto / form.baseImponible) * 100 : 0;

  // ── Guardar costes/pagos ─────────────────────────────────────────────────────
  const saveGasto = () => {
    if (!gastoForm || !gastoForm.concepto.trim() || gastoForm.importe <= 0) return;
    addGastoEvento({ ...gastoForm, id: uid(), createdAt: new Date().toISOString().slice(0, 10) });
    setGastoForm(null);
  };

  const savePago = () => {
    if (!pagoForm || !pagoForm.concepto.trim() || pagoForm.importe <= 0) return;
    addPagoEvento({ ...pagoForm, id: uid(), createdAt: new Date().toISOString().slice(0, 10) });
    setPagoForm(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Modal open={true} onClose={onClose} title={ingreso.concepto || 'Evento'} width="max-w-3xl">
      {/* Sub-nav */}
      <div className="flex gap-1 bg-surface-700/50 rounded-xl p-1 mb-5 -mt-1">
        {TAB_LABELS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tab === t.id ? 'bg-gold-500/15 text-gold-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t.label}
            {t.id === 'costes' && myGastos.length > 0 && (
              <span className="ml-1 px-1 rounded bg-red-500/20 text-red-400 text-[10px]">{myGastos.length}</span>
            )}
            {t.id === 'pagos' && myPagos.length > 0 && (
              <span className="ml-1 px-1 rounded bg-blue-500/20 text-blue-400 text-[10px]">{myPagos.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── DETALLES (formulario editable) ── */}
      {tab === 'detalles' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-zinc-400 mb-1 block">Concepto *</label>
              <input
                value={form.concepto}
                onChange={(e) => setField('concepto', e.target.value)}
                className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-gold-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Cliente *</label>
              <input
                value={form.cliente}
                onChange={(e) => setField('cliente', e.target.value)}
                className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Tipo de evento</label>
              <select
                value={form.tipoEvento}
                onChange={(e) => setField('tipoEvento', e.target.value)}
                className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none"
              >
                {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Fecha del evento *</label>
              <input
                type="date"
                value={form.fechaEvento}
                onChange={(e) => setField('fechaEvento', e.target.value)}
                className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Fecha factura</label>
              <input
                type="date"
                value={form.fechaFactura ?? ''}
                onChange={(e) => setField('fechaFactura', e.target.value)}
                className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Fecha de pago</label>
              <input
                type="date"
                value={form.fechaPago ?? ''}
                onChange={(e) => setField('fechaPago', e.target.value)}
                className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Base imponible (€)</label>
              <input
                type="number"
                value={form.baseImponible}
                onChange={(e) => setField('baseImponible', Number(e.target.value))}
                className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">% IVA</label>
              <select
                value={form.porcentajeIVA}
                onChange={(e) => setField('porcentajeIVA', Number(e.target.value))}
                className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none"
              >
                {IVA_OPTS.map((p) => <option key={p} value={p}>{p}%</option>)}
              </select>
            </div>
            <div className="col-span-2 bg-surface-600/50 rounded-lg px-4 py-2.5 flex gap-6 text-sm">
              <span className="text-zinc-400">IVA: <span className="text-white font-medium">{fmt(form.importeIVA)}</span></span>
              <span className="text-zinc-400">Total c/IVA: <span className="text-gold-400 font-bold">{fmt(form.total)}</span></span>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Método de pago</label>
              <select
                value={form.metodoPago}
                onChange={(e) => setField('metodoPago', e.target.value)}
                className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none"
              >
                {Object.entries(METODO_PAGO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Estado de cobro</label>
              <select
                value={form.estadoPago}
                onChange={(e) => setField('estadoPago', e.target.value as Ingreso['estadoPago'])}
                className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none"
              >
                <option value="pendiente">Pendiente</option>
                <option value="parcial">Parcial</option>
                <option value="pagado">Cobrado</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Nº de factura</label>
              <input
                value={form.numeroFactura ?? ''}
                onChange={(e) => setField('numeroFactura', e.target.value)}
                className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none font-mono"
                placeholder="Ej: F2025-001"
              />
            </div>
            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.facturaEmitida}
                  onChange={(e) => setField('facturaEmitida', e.target.checked)}
                  className="accent-gold-500 w-4 h-4"
                />
                <span className="text-sm font-semibold text-white">Factura emitida: {form.facturaEmitida ? 'Sí' : 'No'}</span>
              </label>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-zinc-400 mb-1 block">Notas</label>
              <textarea
                value={form.notas ?? ''}
                onChange={(e) => setField('notas', e.target.value)}
                rows={2}
                className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none resize-none"
              />
            </div>
          </div>
          {/* Resumen rápido de costes */}
          {myGastos.length > 0 && (
            <div className="bg-surface-700/30 border border-surface-400/10 rounded-xl px-4 py-3 flex gap-6 text-sm flex-wrap">
              <span className="text-zinc-500">Costes: <span className="text-red-400 font-semibold">{fmt(totalCostes)}</span></span>
              <span className="text-zinc-500">Beneficio: <span className={`font-semibold ${beneficioBruto >= 0 ? 'text-gold-400' : 'text-red-400'}`}>{fmt(beneficioBruto)}</span></span>
              <span className="text-zinc-500">Margen: <span className={`font-semibold ${margen >= 30 ? 'text-green-400' : margen >= 10 ? 'text-gold-400' : 'text-red-400'}`}>{margen.toFixed(1)}%</span></span>
            </div>
          )}
          <div className="flex justify-between items-center pt-1">
            <button
              onClick={() => setTab('costes')}
              className="text-xs text-zinc-500 hover:text-gold-400 transition-colors"
            >
              {myGastos.length === 0 ? '+ Añadir costes del evento →' : `Ver ${myGastos.length} coste(s) del evento →`}
            </button>
            <button
              onClick={saveDetalles}
              disabled={!dirty}
              className="flex items-center gap-2 px-4 py-2 bg-gold-500 text-black text-sm font-semibold rounded-lg hover:bg-gold-400 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save size={14} /> Guardar cambios
            </button>
          </div>
        </div>
      )}

      {/* ── COSTES DEL EVENTO ── */}
      {tab === 'costes' && (
        <div className="space-y-3">
          {myGastos.length === 0 && !gastoForm && (
            <div className="py-8 text-center">
              <p className="text-sm text-zinc-500">Sin costes registrados para este evento</p>
              <p className="text-xs text-zinc-600 mt-1">Añade los gastos directos: DJ, técnico, transporte, etc.</p>
            </div>
          )}
          {myGastos.length > 0 && (
            <div className="bg-surface-800 border border-surface-400/20 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-400/20">
                    <th className="text-left px-3 py-2.5 text-zinc-500 text-xs">Fecha</th>
                    <th className="text-left px-3 py-2.5 text-zinc-500 text-xs">Concepto</th>
                    <th className="text-left px-3 py-2.5 text-zinc-500 text-xs">Categoría</th>
                    <th className="text-right px-3 py-2.5 text-zinc-500 text-xs">Importe</th>
                    <th className="px-3 py-2.5 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {myGastos.map((g) => (
                    <tr key={g.id} className="border-b border-surface-400/10 hover:bg-surface-700/30">
                      <td className="px-3 py-2 text-xs text-zinc-400">{fmtDate(g.fecha)}</td>
                      <td className="px-3 py-2 text-white text-sm">{g.concepto}</td>
                      <td className="px-3 py-2 text-xs text-zinc-400">{g.categoria}</td>
                      <td className="px-3 py-2 text-right text-red-400 font-semibold">{fmt(g.importe)}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => showConfirm('¿Eliminar este coste?', () => deleteGastoEvento(g.id))}
                          className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-400/10"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-surface-700/50 border-t border-surface-400/20">
                    <td colSpan={3} className="px-3 py-2.5 text-xs text-zinc-400 font-semibold">Total costes</td>
                    <td className="px-3 py-2.5 text-right text-red-400 font-bold">{fmt(totalCostes)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {gastoForm ? (
            <div className="bg-surface-700/50 border border-surface-400/20 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">Nuevo coste del evento</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Fecha</label>
                  <input
                    type="date"
                    value={gastoForm.fecha}
                    onChange={(e) => setGastoForm({ ...gastoForm, fecha: e.target.value })}
                    className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Categoría</label>
                  <select
                    value={gastoForm.categoria}
                    onChange={(e) => setGastoForm({ ...gastoForm, categoria: e.target.value as GastoEventoCategoria })}
                    className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none"
                  >
                    {GASTO_EVENTO_CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-zinc-400 mb-1 block">Concepto *</label>
                  <input
                    value={gastoForm.concepto}
                    onChange={(e) => setGastoForm({ ...gastoForm, concepto: e.target.value })}
                    className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none"
                    placeholder="Ej: Pago DJ externo, Técnico de sonido, Gasolina..."
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Importe (€) *</label>
                  <input
                    type="number"
                    value={gastoForm.importe || ''}
                    onChange={(e) => setGastoForm({ ...gastoForm, importe: Number(e.target.value) })}
                    className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Observaciones</label>
                  <input
                    value={gastoForm.observaciones ?? ''}
                    onChange={(e) => setGastoForm({ ...gastoForm, observaciones: e.target.value })}
                    className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setGastoForm(null)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200">
                  <X size={12} /> Cancelar
                </button>
                <button onClick={saveGasto} className="px-4 py-1.5 bg-gold-500 text-black text-xs font-semibold rounded-lg hover:bg-gold-400">
                  Guardar coste
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setGastoForm(emptyGastoEvento(ingreso))}
              className="flex items-center gap-2 px-3 py-2 bg-surface-700 border border-dashed border-surface-400/30 text-zinc-400 text-sm rounded-lg hover:text-white hover:border-gold-500/40 w-full justify-center transition-colors"
            >
              <Plus size={14} /> Añadir coste del evento
            </button>
          )}

          {/* Resumen rápido */}
          {myGastos.length > 0 && (
            <div className="bg-surface-700/30 rounded-xl px-4 py-3 flex gap-6 text-sm flex-wrap">
              <span className="text-zinc-500">Base: <span className="text-green-400 font-semibold">{fmt(form.baseImponible)}</span></span>
              <span className="text-zinc-500">Costes: <span className="text-red-400 font-semibold">{fmt(totalCostes)}</span></span>
              <span className="text-zinc-500">Beneficio: <span className={`font-semibold ${beneficioBruto >= 0 ? 'text-gold-400' : 'text-red-400'}`}>{fmt(beneficioBruto)}</span></span>
              <span className="text-zinc-500">Margen: <span className={`font-semibold ${margen >= 30 ? 'text-green-400' : margen >= 10 ? 'text-gold-400' : 'text-red-400'}`}>{margen.toFixed(1)}%</span></span>
            </div>
          )}
        </div>
      )}

      {/* ── PAGOS RECIBIDOS ── */}
      {tab === 'pagos' && (
        <div className="space-y-3">
          {myPagos.length === 0 && !pagoForm && (
            <div className="py-8 text-center">
              <p className="text-sm text-zinc-500">Sin pagos registrados para este evento</p>
              <p className="text-xs text-zinc-600 mt-1">Registra señales, pagos parciales y pagos totales</p>
            </div>
          )}
          {myPagos.length > 0 && (
            <div className="bg-surface-800 border border-surface-400/20 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-400/20">
                    <th className="text-left px-3 py-2.5 text-zinc-500 text-xs">Fecha</th>
                    <th className="text-left px-3 py-2.5 text-zinc-500 text-xs">Concepto</th>
                    <th className="text-left px-3 py-2.5 text-zinc-500 text-xs">Método</th>
                    <th className="text-right px-3 py-2.5 text-zinc-500 text-xs">Importe</th>
                    <th className="px-3 py-2.5 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {myPagos.map((p) => (
                    <tr key={p.id} className="border-b border-surface-400/10 hover:bg-surface-700/30">
                      <td className="px-3 py-2 text-xs text-zinc-400">{fmtDate(p.fecha)}</td>
                      <td className="px-3 py-2 text-white">{p.concepto}</td>
                      <td className="px-3 py-2 text-xs text-zinc-400">{METODO_PAGO_LABELS[p.metodoPago]}</td>
                      <td className="px-3 py-2 text-right text-green-400 font-semibold">{fmt(p.importe)}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => showConfirm('¿Eliminar este pago?', () => deletePagoEvento(p.id))}
                          className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-400/10"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-surface-700/50 border-t border-surface-400/20">
                    <td colSpan={2} className="px-3 py-2.5 text-xs text-zinc-400 font-semibold">Total cobrado</td>
                    <td className="px-3 py-2.5 text-xs text-zinc-500">{myPagos.length} pago(s)</td>
                    <td className="px-3 py-2.5 text-right text-green-400 font-bold">{fmt(totalCobrado)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Pendiente */}
          {totalCobrado > 0 && (
            <div className={`rounded-xl px-4 py-2.5 text-sm flex items-center justify-between ${pendienteCobro <= 0.01 ? 'bg-green-500/10 border border-green-500/20' : 'bg-yellow-500/10 border border-yellow-500/20'}`}>
              <span className={pendienteCobro <= 0.01 ? 'text-green-400' : 'text-yellow-400'}>
                {pendienteCobro <= 0.01 ? '✓ Cobrado al completo' : `Pendiente: ${fmt(pendienteCobro)}`}
              </span>
              <span className="text-zinc-500 text-xs">Total factura: {fmt(form.total)}</span>
            </div>
          )}

          {pagoForm ? (
            <div className="bg-surface-700/50 border border-surface-400/20 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">Registrar pago</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Fecha</label>
                  <input
                    type="date"
                    value={pagoForm.fecha}
                    onChange={(e) => setPagoForm({ ...pagoForm, fecha: e.target.value })}
                    className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Método de pago</label>
                  <select
                    value={pagoForm.metodoPago}
                    onChange={(e) => setPagoForm({ ...pagoForm, metodoPago: e.target.value as PagoEvento['metodoPago'] })}
                    className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none"
                  >
                    {Object.entries(METODO_PAGO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-zinc-400 mb-1 block">Concepto *</label>
                  <input
                    value={pagoForm.concepto}
                    onChange={(e) => setPagoForm({ ...pagoForm, concepto: e.target.value })}
                    className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none"
                    placeholder="Ej: Señal 30%, Pago total, Resto pendiente..."
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Importe (€ con IVA) *</label>
                  <input
                    type="number"
                    value={pagoForm.importe || ''}
                    onChange={(e) => setPagoForm({ ...pagoForm, importe: Number(e.target.value) })}
                    className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Observaciones</label>
                  <input
                    value={pagoForm.observaciones ?? ''}
                    onChange={(e) => setPagoForm({ ...pagoForm, observaciones: e.target.value })}
                    className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setPagoForm(null)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200">
                  <X size={12} /> Cancelar
                </button>
                <button onClick={savePago} className="px-4 py-1.5 bg-gold-500 text-black text-xs font-semibold rounded-lg hover:bg-gold-400">
                  Guardar pago
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setPagoForm(emptyPagoEvento(ingreso))}
              className="flex items-center gap-2 px-3 py-2 bg-surface-700 border border-dashed border-surface-400/30 text-zinc-400 text-sm rounded-lg hover:text-white hover:border-gold-500/40 w-full justify-center transition-colors"
            >
              <Plus size={14} /> Registrar pago
            </button>
          )}
        </div>
      )}

      {/* ── RESUMEN FINANCIERO ── */}
      {tab === 'resumen' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <ResKPI label="Facturación total (c/IVA)" value={fmt(form.total)} color="text-white" />
            <ResKPI label="Base imponible (s/IVA)" value={fmt(form.baseImponible)} color="text-green-400" />
            <ResKPI label="IVA repercutido" value={fmt(form.importeIVA)} sub={`${form.porcentajeIVA}%`} color="text-zinc-300" />
            <ResKPI
              label="Factura emitida"
              value={form.facturaEmitida ? `Sí${form.numeroFactura ? ` · ${form.numeroFactura}` : ''}` : 'No'}
              color={form.facturaEmitida ? 'text-green-400' : 'text-zinc-500'}
            />
            <ResKPI label="Total cobrado" value={fmt(totalCobrado)} sub={`${myPagos.length} pago(s)`} color="text-blue-400" />
            <ResKPI
              label="Pendiente de cobro"
              value={fmt(Math.max(0, pendienteCobro))}
              color={pendienteCobro <= 0.01 ? 'text-green-400' : 'text-yellow-400'}
              sub={pendienteCobro <= 0.01 ? '✓ Cobrado completo' : ''}
            />
            <ResKPI label="Costes del evento" value={fmt(totalCostes)} sub={`${myGastos.length} partida(s)`} color="text-red-400" />
            <ResKPI
              label="Beneficio bruto"
              value={fmt(beneficioBruto)}
              sub="Base − Costes"
              color={beneficioBruto >= 0 ? 'text-gold-400' : 'text-red-400'}
            />
          </div>

          {/* Margen */}
          <div className={`rounded-xl p-4 border ${beneficioBruto >= 0 ? 'bg-gold-500/5 border-gold-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
            <div className="flex items-end justify-between mb-2">
              <div>
                <p className="text-xs text-zinc-500 mb-1">Margen de beneficio</p>
                <p className={`text-4xl font-bold tracking-tight ${margen >= 30 ? 'text-green-400' : margen >= 10 ? 'text-gold-400' : 'text-red-400'}`}>
                  {margen.toFixed(1)}<span className="text-xl">%</span>
                </p>
              </div>
              <div className="text-right text-xs text-zinc-500 space-y-0.5">
                <p>Base: <span className="text-white">{fmt(form.baseImponible)}</span></p>
                <p>Costes: <span className="text-red-400">−{fmt(totalCostes)}</span></p>
                <p className="border-t border-surface-400/20 pt-0.5">Beneficio: <span className={beneficioBruto >= 0 ? 'text-gold-400' : 'text-red-400'}>{fmt(beneficioBruto)}</span></p>
              </div>
            </div>
            <div className="h-2 bg-surface-600 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${margen >= 30 ? 'bg-green-400' : margen >= 10 ? 'bg-gold-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(100, Math.max(0, margen))}%` }}
              />
            </div>
            <p className="text-xs text-zinc-600 mt-1.5">Beneficio / Base imponible × 100 · Calculado automáticamente</p>
          </div>

          {myGastos.length === 0 && (
            <div className="bg-surface-700/30 rounded-xl p-4 text-center">
              <p className="text-xs text-zinc-500">
                Sin costes registrados. El margen no se puede calcular hasta que añadas costes del evento.
              </p>
              <button
                onClick={() => setTab('costes')}
                className="mt-2 text-xs text-gold-400 hover:text-gold-300"
              >
                Ir a Costes del evento →
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

// ── Sub-componente KPI de resumen ─────────────────────────────────────────────
const ResKPI = ({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) => (
  <div className="bg-surface-700/50 rounded-xl p-3">
    <p className="text-xs text-zinc-500 mb-1">{label}</p>
    <p className={`text-base font-bold ${color}`}>{value}</p>
    {sub && <p className="text-xs text-zinc-600 mt-0.5">{sub}</p>}
  </div>
);
