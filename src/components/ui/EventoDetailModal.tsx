/**
 * EventoDetailModal — Modal de detalle financiero por evento (ingreso)
 * 4 pestañas: Detalles · Gastos del evento · Pagos recibidos · Resumen financiero
 */
import { useState, useMemo } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Modal } from './Modal';
import { useStore } from '../../store/useStore';
import { fmt, fmtDate, uid, METODO_PAGO_LABELS, EVENT_TYPE_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from '../../utils/helpers';
import { useConfirmStore } from '../../store/useConfirmStore';
import type { Ingreso, GastoEvento, PagoEvento, GastoEventoCategoria } from '../../types';

const GASTO_EVENTO_CATEGORIAS: GastoEventoCategoria[] = [
  'DJ', 'Técnico', 'Fotomatón', 'Gasolina', 'Hotel',
  'Alquiler material', 'Catering', 'Peajes', 'Dietas', 'Otros',
];

type ModalTab = 'detalles' | 'gastos' | 'pagos' | 'resumen';

const TAB_LABELS: { id: ModalTab; label: string }[] = [
  { id: 'detalles', label: 'Detalles' },
  { id: 'gastos',   label: 'Costes del evento' },
  { id: 'pagos',    label: 'Pagos recibidos' },
  { id: 'resumen',  label: 'Resumen financiero' },
];

const emptyGastoEvento = (ingreso: Ingreso): Omit<GastoEvento, 'id' | 'createdAt'> => ({
  ingresoId: ingreso.id,
  area: ingreso.area,
  fecha: new Date().toISOString().slice(0, 10),
  concepto: '',
  categoria: 'Otros',
  importe: 0,
});

const emptyPagoEvento = (ingreso: Ingreso): Omit<PagoEvento, 'id' | 'createdAt'> => ({
  ingresoId: ingreso.id,
  area: ingreso.area,
  fecha: new Date().toISOString().slice(0, 10),
  importe: 0,
  metodoPago: 'transferencia',
  concepto: 'Pago cliente',
});

interface Props {
  ingreso: Ingreso | null;
  onClose: () => void;
  onEdit: (ingreso: Ingreso) => void;
}

export const EventoDetailModal = ({ ingreso, onClose, onEdit }: Props) => {
  const {
    gastosEvento, pagosEvento,
    addGastoEvento, deleteGastoEvento,
    addPagoEvento, deletePagoEvento,
  } = useStore();
  const showConfirm = useConfirmStore((s) => s.show);
  const [tab, setTab] = useState<ModalTab>('detalles');

  // Formulario gastos evento
  const [gastoForm, setGastoForm] = useState<Omit<GastoEvento, 'id' | 'createdAt'> | null>(null);
  // Formulario pagos evento
  const [pagoForm, setPagoForm] = useState<Omit<PagoEvento, 'id' | 'createdAt'> | null>(null);

  const myGastos = useMemo(
    () => ingreso ? gastosEvento.filter((g) => g.ingresoId === ingreso.id) : [],
    [gastosEvento, ingreso],
  );
  const myPagos = useMemo(
    () => ingreso ? pagosEvento.filter((p) => p.ingresoId === ingreso.id) : [],
    [pagosEvento, ingreso],
  );

  if (!ingreso) return null;

  const totalCostes   = myGastos.reduce((s, g) => s + g.importe, 0);
  const totalCobrado  = myPagos.reduce((s, p) => s + p.importe, 0);
  const pendienteCobro = ingreso.total - totalCobrado;
  const beneficioBruto = ingreso.baseImponible - totalCostes;
  const margen         = ingreso.baseImponible > 0 ? (beneficioBruto / ingreso.baseImponible) * 100 : 0;

  const saveGasto = () => {
    if (!gastoForm || !gastoForm.concepto || gastoForm.importe <= 0) return;
    addGastoEvento({ ...gastoForm, id: uid(), createdAt: new Date().toISOString().slice(0, 10) });
    setGastoForm(null);
  };

  const savePago = () => {
    if (!pagoForm || !pagoForm.concepto || pagoForm.importe <= 0) return;
    addPagoEvento({ ...pagoForm, id: uid(), createdAt: new Date().toISOString().slice(0, 10) });
    setPagoForm(null);
  };

  return (
    <Modal open={true} onClose={onClose} title={ingreso.concepto} width="max-w-3xl">
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
          </button>
        ))}
      </div>

      {/* ── DETALLES ── */}
      {tab === 'detalles' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-surface-700/50 rounded-xl p-3 space-y-0.5">
              <p className="text-xs text-zinc-500">Cliente</p>
              <p className="text-white font-medium">{ingreso.cliente}</p>
            </div>
            <div className="bg-surface-700/50 rounded-xl p-3 space-y-0.5">
              <p className="text-xs text-zinc-500">Tipo de evento</p>
              <p className="text-white font-medium">{EVENT_TYPE_LABELS[ingreso.tipoEvento]}</p>
            </div>
            <div className="bg-surface-700/50 rounded-xl p-3 space-y-0.5">
              <p className="text-xs text-zinc-500">Fecha evento</p>
              <p className="text-white font-medium">{fmtDate(ingreso.fechaEvento)}</p>
            </div>
            <div className="bg-surface-700/50 rounded-xl p-3 space-y-0.5">
              <p className="text-xs text-zinc-500">Estado de pago</p>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${PAYMENT_STATUS_COLORS[ingreso.estadoPago]}`}>
                {PAYMENT_STATUS_LABELS[ingreso.estadoPago]}
              </span>
            </div>
            <div className="bg-surface-700/50 rounded-xl p-3 space-y-0.5">
              <p className="text-xs text-zinc-500">Base imponible</p>
              <p className="text-green-400 font-bold">{fmt(ingreso.baseImponible)}</p>
            </div>
            <div className="bg-surface-700/50 rounded-xl p-3 space-y-0.5">
              <p className="text-xs text-zinc-500">Total con IVA ({ingreso.porcentajeIVA}%)</p>
              <p className="text-white font-bold">{fmt(ingreso.total)}</p>
            </div>
            <div className="bg-surface-700/50 rounded-xl p-3 space-y-0.5">
              <p className="text-xs text-zinc-500">Factura emitida</p>
              <p className="text-white">{ingreso.facturaEmitida ? (ingreso.numeroFactura ? `Sí · ${ingreso.numeroFactura}` : 'Sí') : 'No'}</p>
            </div>
            {ingreso.fechaFactura && (
              <div className="bg-surface-700/50 rounded-xl p-3 space-y-0.5">
                <p className="text-xs text-zinc-500">Fecha factura</p>
                <p className="text-white">{fmtDate(ingreso.fechaFactura)}</p>
              </div>
            )}
          </div>
          {ingreso.notas && (
            <div className="bg-surface-700/30 rounded-xl p-3">
              <p className="text-xs text-zinc-500 mb-1">Notas</p>
              <p className="text-sm text-zinc-300">{ingreso.notas}</p>
            </div>
          )}
          <div className="flex justify-end pt-1">
            <button
              onClick={() => { onClose(); onEdit(ingreso); }}
              className="px-4 py-2 bg-gold-500 text-black text-sm font-semibold rounded-lg hover:bg-gold-400"
            >
              Editar ingreso
            </button>
          </div>
        </div>
      )}

      {/* ── COSTES DEL EVENTO ── */}
      {tab === 'gastos' && (
        <div className="space-y-3">
          {myGastos.length === 0 && !gastoForm && (
            <p className="text-sm text-zinc-500 py-4 text-center">Sin costes registrados para este evento</p>
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
                      <td className="px-3 py-2 text-white">{g.concepto}</td>
                      <td className="px-3 py-2 text-xs text-zinc-400">{g.categoria}</td>
                      <td className="px-3 py-2 text-right text-red-400 font-medium">{fmt(g.importe)}</td>
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
                  <tr className="bg-surface-700/50">
                    <td colSpan={3} className="px-3 py-2 text-xs text-zinc-400 font-semibold">Total costes</td>
                    <td className="px-3 py-2 text-right text-red-400 font-bold">{fmt(totalCostes)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Formulario añadir gasto */}
          {gastoForm ? (
            <div className="bg-surface-700/50 border border-surface-400/20 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">Nuevo coste</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Fecha</label>
                  <input type="date" value={gastoForm.fecha} onChange={(e) => setGastoForm({ ...gastoForm, fecha: e.target.value })} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Categoría</label>
                  <select value={gastoForm.categoria} onChange={(e) => setGastoForm({ ...gastoForm, categoria: e.target.value as GastoEventoCategoria })} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none">
                    {GASTO_EVENTO_CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-zinc-400 mb-1 block">Concepto *</label>
                  <input value={gastoForm.concepto} onChange={(e) => setGastoForm({ ...gastoForm, concepto: e.target.value })} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" placeholder="Ej: DJ externo, Técnico de sonido..." />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Importe (€) *</label>
                  <input type="number" value={gastoForm.importe} onChange={(e) => setGastoForm({ ...gastoForm, importe: Number(e.target.value) })} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Observaciones</label>
                  <input value={gastoForm.observaciones ?? ''} onChange={(e) => setGastoForm({ ...gastoForm, observaciones: e.target.value })} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setGastoForm(null)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"><X size={12} />Cancelar</button>
                <button onClick={saveGasto} className="px-4 py-1.5 bg-gold-500 text-black text-xs font-semibold rounded-lg hover:bg-gold-400">Guardar coste</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setGastoForm(emptyGastoEvento(ingreso))}
              className="flex items-center gap-2 px-3 py-2 bg-surface-700 border border-surface-400/20 text-zinc-300 text-sm rounded-lg hover:text-white w-full justify-center"
            >
              <Plus size={14} /> Añadir coste
            </button>
          )}
        </div>
      )}

      {/* ── PAGOS RECIBIDOS ── */}
      {tab === 'pagos' && (
        <div className="space-y-3">
          {myPagos.length === 0 && !pagoForm && (
            <p className="text-sm text-zinc-500 py-4 text-center">Sin pagos registrados para este evento</p>
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
                      <td className="px-3 py-2 text-right text-green-400 font-medium">{fmt(p.importe)}</td>
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
                  <tr className="bg-surface-700/50">
                    <td colSpan={3} className="px-3 py-2 text-xs text-zinc-400 font-semibold">Total cobrado</td>
                    <td className="px-3 py-2 text-right text-green-400 font-bold">{fmt(totalCobrado)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Formulario añadir pago */}
          {pagoForm ? (
            <div className="bg-surface-700/50 border border-surface-400/20 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">Nuevo pago</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Fecha</label>
                  <input type="date" value={pagoForm.fecha} onChange={(e) => setPagoForm({ ...pagoForm, fecha: e.target.value })} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Método de pago</label>
                  <select value={pagoForm.metodoPago} onChange={(e) => setPagoForm({ ...pagoForm, metodoPago: e.target.value as PagoEvento['metodoPago'] })} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none">
                    {Object.entries(METODO_PAGO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-zinc-400 mb-1 block">Concepto *</label>
                  <input value={pagoForm.concepto} onChange={(e) => setPagoForm({ ...pagoForm, concepto: e.target.value })} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" placeholder="Ej: Señal, Pago total, Resto..." />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Importe (€ con IVA) *</label>
                  <input type="number" value={pagoForm.importe} onChange={(e) => setPagoForm({ ...pagoForm, importe: Number(e.target.value) })} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Observaciones</label>
                  <input value={pagoForm.observaciones ?? ''} onChange={(e) => setPagoForm({ ...pagoForm, observaciones: e.target.value })} className="w-full bg-surface-600 border border-surface-400/30 rounded-lg px-3 py-2 text-white text-sm outline-none" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setPagoForm(null)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"><X size={12} />Cancelar</button>
                <button onClick={savePago} className="px-4 py-1.5 bg-gold-500 text-black text-xs font-semibold rounded-lg hover:bg-gold-400">Guardar pago</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setPagoForm(emptyPagoEvento(ingreso))}
              className="flex items-center gap-2 px-3 py-2 bg-surface-700 border border-surface-400/20 text-zinc-300 text-sm rounded-lg hover:text-white w-full justify-center"
            >
              <Plus size={14} /> Registrar pago
            </button>
          )}
        </div>
      )}

      {/* ── RESUMEN FINANCIERO ── */}
      {tab === 'resumen' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <ResumenKPI label="Facturación total" value={fmt(ingreso.total)} sub="Con IVA" color="text-white" />
            <ResumenKPI label="Base imponible" value={fmt(ingreso.baseImponible)} sub="Sin IVA" color="text-green-400" />
            <ResumenKPI label="Total cobrado" value={fmt(totalCobrado)} sub={`${myPagos.length} pago(s)`} color="text-blue-400" />
            <ResumenKPI
              label="Pendiente de cobro"
              value={fmt(Math.max(0, pendienteCobro))}
              sub={pendienteCobro <= 0 ? '✓ Cobrado al completo' : 'Pendiente'}
              color={pendienteCobro <= 0 ? 'text-green-400' : 'text-yellow-400'}
            />
            <ResumenKPI label="Costes del evento" value={fmt(totalCostes)} sub={`${myGastos.length} partida(s)`} color="text-red-400" />
            <ResumenKPI label="Beneficio bruto" value={fmt(beneficioBruto)} sub="Facturación − Costes" color={beneficioBruto >= 0 ? 'text-gold-400' : 'text-red-400'} />
          </div>
          {/* Margen */}
          <div className={`bg-surface-700/50 border rounded-xl p-4 ${beneficioBruto >= 0 ? 'border-gold-500/20' : 'border-red-500/20'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-500 mb-1">Margen de beneficio</p>
                <p className={`text-3xl font-bold ${margen >= 0 ? 'text-gold-400' : 'text-red-400'}`}>{margen.toFixed(1)}%</p>
                <p className="text-xs text-zinc-500 mt-1">Beneficio / Base imponible × 100</p>
              </div>
              <div className="text-right space-y-1 text-xs text-zinc-400">
                <p>Base: <span className="text-white">{fmt(ingreso.baseImponible)}</span></p>
                <p>Costes: <span className="text-red-400">−{fmt(totalCostes)}</span></p>
                <p className="border-t border-surface-400/30 pt-1">Beneficio: <span className={beneficioBruto >= 0 ? 'text-gold-400' : 'text-red-400'}>{fmt(beneficioBruto)}</span></p>
              </div>
            </div>
            {/* Barra de margen */}
            <div className="mt-3 h-2 bg-surface-600 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${margen >= 30 ? 'bg-green-400' : margen >= 10 ? 'bg-gold-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(100, Math.max(0, margen))}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

const ResumenKPI = ({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) => (
  <div className="bg-surface-700/50 rounded-xl p-3">
    <p className="text-xs text-zinc-500 mb-1">{label}</p>
    <p className={`text-lg font-bold ${color}`}>{value}</p>
    {sub && <p className="text-xs text-zinc-600 mt-0.5">{sub}</p>}
  </div>
);
