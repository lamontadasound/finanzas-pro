import { useMemo, useState } from 'react';
import { Plus, Wallet, Edit2, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageHeader, Segmented, Chips, Widget, Money, SplitBar, Dot, Metric, Pill } from '../../components/kit';
import { DateGlyph } from '../../components/ingresos/IngresosViews';
import { RowMenu2 } from '../../components/ui2/RowMenu';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useConfirmStore } from '../../store/useConfirmStore';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { matchesYQM, type YQMValue } from '../../components/ui/yqm';
import { BUSINESS_LINES, type LineaId } from '../../config/businessLines';
import { cobradoDe, pendienteDe, diasPendienteDe, lineaDeIngreso, estadoPagoDesdeCobrado } from '../../lib/contabilidad';
import type { Area, Ingreso, PaymentMethod } from '../../types';

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', useGrouping: 'always' } as Intl.NumberFormatOptions);
const METODOS: PaymentMethod[] = ['efectivo', 'transferencia', 'tarjeta', 'cheque', 'bizum', 'otro'];
const METODO_LABEL: Record<string, string> = { transferencia: 'Transferencia', tarjeta: 'Tarjeta', efectivo: 'Efectivo', bizum: 'Bizum', cheque: 'Cheque', otro: 'Otro' };

interface Props {
  area: Area | 'todos';
  fixedLinea?: LineaId;
  /** Pestaña inicial — "Pagos recibidos" abre en 'cobrado', "Pagos pendientes" en 'porcobrar'. */
  defaultTab?: 'cobrado' | 'porcobrar';
}

export const PagosPage = ({ area, defaultTab = 'porcobrar', fixedLinea }: Props) => {
  const allIngresosStore = useStore((s) => s.ingresos);
  const updateIngreso = useStore((s) => s.updateIngreso);
  const canEditLinea = useAuthStore((s) => s.canEditLinea);
  const canDeleteLinea = useAuthStore((s) => s.canDeleteLinea);
  const lineasVisibles = useAuthStore((s) => s.lineasVisibles());
  const showConfirm = useConfirmStore((s) => s.show);
  // Filtro de permisos (Fase F) — un ingreso de una línea sin permiso no
  // debe aparecer aquí aunque el módulo Contabilidad esté activado.
  const allIngresos = useMemo(
    () => allIngresosStore.filter((i) => lineasVisibles.includes(lineaDeIngreso(i)) && (!fixedLinea || lineaDeIngreso(i)===fixedLinea)),
    [allIngresosStore, lineasVisibles, fixedLinea],
  );
  const ingresos = useMemo(
    () => area === 'todos' ? allIngresos : allIngresos.filter((i) => i.area === area),
    [allIngresos, area],
  );

  const [tab, setTab] = useState<'cobrado' | 'porcobrar'>(defaultTab);
  const [filterLinea, setFilterLinea] = useState<LineaId | 'todas'>('todas');
  const [savingPayment, setSavingPayment] = useState(false);
  const [pagoModal, setPagoModal] = useState<Ingreso | null>(null);
  const [pagoModo, setPagoModo] = useState<'registrar' | 'editar'>('registrar');
  const [pagoImporte, setPagoImporte] = useState(0);
  const [pagoMetodo, setPagoMetodo] = useState<PaymentMethod>('transferencia');
  const [nav, setNav] = useState<YQMValue>({ year: null, trimestre: null, month: null });
  const [verTodos, setVerTodos] = useState(false);

  const base = useMemo(
    () => filterLinea === 'todas' ? ingresos : ingresos.filter((i) => lineaDeIngreso(i) === filterLinea),
    [ingresos, filterLinea],
  );

  const enElPeriodo = useMemo(() => base.filter((i) => matchesYQM(i.fechaEvento, nav)), [base, nav]);



  // "Pagado" = cobrado al 100% (cobradoDe centraliza esa regla, evita el
  // error histórico de "pagado" sin pagosRecibidos sincronizado).
  const cobrados   = useMemo(
    () => enElPeriodo.filter((i) => i.estadoPago === 'pagado')
      .sort((a, b) => (b.fechaPago ?? b.fechaEvento).localeCompare(a.fechaPago ?? a.fechaEvento)),
    [enElPeriodo],
  );
  // Ordenados de más antiguo a más reciente — "quién falta por pagar desde hace más tiempo" primero.
  const porCobrar  = useMemo(
    () => enElPeriodo.filter((i) => ['pendiente', 'parcial'].includes(i.estadoPago))
      .sort((a, b) => diasPendienteDe(b) - diasPendienteDe(a)),
    [enElPeriodo],
  );

  const totalCobrado   = cobrados.reduce((a, i) => a + cobradoDe(i), 0);
  const totalPendiente = porCobrar.reduce((a, i) => a + pendienteDe(i), 0);

  const lista = tab === 'cobrado' ? cobrados : porCobrar;

  const openPago = (i: Ingreso) => {
    setPagoModal(i); setPagoModo('registrar');
    setPagoImporte(Math.max(0, pendienteDe(i))); setPagoMetodo(i.metodoPago);
  };
  // "Editar" opera sobre el mismo Ingreso (nunca crea un registro nuevo):
  // permite corregir el importe total ya cobrado, p.ej. tras un error al
  // registrar un pago. El campo pasa a representar el cobrado ABSOLUTO,
  // no un incremento — se distingue con `pagoModo`.
  const openEditarCobro = (i: Ingreso) => {
    setPagoModal(i); setPagoModo('editar');
    setPagoImporte(cobradoDe(i)); setPagoMetodo(i.metodoPago);
  };
  const closePago = () => setPagoModal(null);

  // Recalcula estadoPago/pendiente a partir del cobrado resultante — misma
  // regla centralizada que `cobradoDe`/`pendienteDe`, así el estado nunca
  // se desincroniza del importe.
  const aplicarCobro = async (ingresoId: string, nuevoCobrado: number, metodo: PaymentMethod) => {
    const cobrado = Math.max(0, nuevoCobrado);
    const ingreso = allIngresos.find((x) => x.id === ingresoId);
    if (!ingreso) return;
    const estado = estadoPagoDesdeCobrado(ingreso.total, cobrado);
    return await updateIngreso(ingresoId, {
      pagosRecibidos: cobrado,
      estadoPago: estado,
      metodoPago: metodo,
      fechaPago: estado === 'pagado' ? new Date().toISOString().slice(0, 10) : (estado === 'pendiente' ? undefined : ingreso.fechaPago),
    });
  };

  const registrarPago = async () => {
    if (!pagoModal || savingPayment) return;
    if (pagoModo === 'registrar' && pagoImporte <= 0) return;
    if (pagoModo === 'editar' && pagoImporte < 0) return;
    const nuevoCobrado = pagoModo === 'editar' ? pagoImporte : cobradoDe(pagoModal) + pagoImporte;
    setSavingPayment(true);
    try { if (await aplicarCobro(pagoModal.id, nuevoCobrado, pagoMetodo)) closePago(); }
    finally { setSavingPayment(false); }
  };

  // Deshace/elimina el cobro registrado — vuelve el ingreso a "pendiente"
  // sin duplicar ni crear ningún registro nuevo, solo corrige el existente.
  const eliminarCobro = (i: Ingreso) => {
    showConfirm(
      `¿Eliminar el cobro registrado de ${fmt(cobradoDe(i))} para "${i.cliente}"? El ingreso volverá a estado "pendiente".`,
      () => aplicarCobro(i.id, 0, i.metodoPago),
    );
  };

  const LIMIT = 12;
  const visibles = verTodos ? lista : lista.slice(0, LIMIT);
  const tramos = [
    { label: 'Reciente o por venir', value: porCobrar.filter((i) => diasPendienteDe(i) < 30).reduce((a, i) => a + pendienteDe(i), 0), color: 'var(--tint-a)' },
    { label: '30 a 60 días', value: porCobrar.filter((i) => diasPendienteDe(i) >= 30 && diasPendienteDe(i) < 60).reduce((a, i) => a + pendienteDe(i), 0), color: '#ff9f0a' },
    { label: 'Más de 60 días', value: porCobrar.filter((i) => diasPendienteDe(i) >= 60).reduce((a, i) => a + pendienteDe(i), 0), color: '#ff3b30' },
  ];
  const years = [...new Set(base.map((i) => new Date(i.fechaEvento).getFullYear()))].sort((x, y) => y - x);

  return (
    <div>
      <PageHeader title="Pagos">
        <Segmented id="pagos-tab" value={tab} onChange={(v) => { setTab(v); setVerTodos(false); }}
          options={[{ value: 'porcobrar', label: 'Por cobrar' }, { value: 'cobrado', label: 'Cobrado' }]} />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Chips label="Año" value={nav.year ?? 'todos'} onChange={(v) => { setNav({ year: v === 'todos' ? null : Number(v), trimestre: null, month: null }); setVerTodos(false); }}
          options={[{ value: 'todos' as const, label: 'Todos' }, ...years.map((y) => ({ value: y, label: String(y) }))]} />
        {!fixedLinea && lineasVisibles.length > 1 && (<><span className="w-px h-6 bg-black/10 mx-1" aria-hidden />
          <Chips label="Línea" value={filterLinea} onChange={(v) => setFilterLinea(v)}
            options={[{ value: 'todas' as const, label: 'Todas' }, ...lineasVisibles.map((id) => ({ value: id, label: BUSINESS_LINES[id].shortLabel }))]} /></>
        )}
      </div>

      <div className="bento mb-4">
        <Widget className="span-2 hero-card flex flex-col">
          <p className="text-[13px] font-medium opacity-75">{tab === 'porcobrar' ? 'Pendiente de cobro' : 'Cobrado'}</p>
          <p className="hero-value mt-3"><Money value={tab === 'porcobrar' ? totalPendiente : totalCobrado} /></p>
          <p className="mt-2 text-[15px] opacity-80">{lista.length} {lista.length === 1 ? 'evento' : 'eventos'}</p>
        </Widget>
        {tab === 'porcobrar' ? (
          <Widget className="span-2" title="Antigüedad" delay={0.05}>
            <SplitBar parts={tramos} />
            <div className="mt-4 space-y-2.5">
              {tramos.map((t) => (
                <div key={t.label} className="flex items-center justify-between text-[14px]">
                  <span className="flex items-center gap-2 text-ink-2"><Dot color={t.color} />{t.label}</span>
                  <b className="num">{fmt(t.value)}</b>
                </div>
              ))}
            </div>
          </Widget>
        ) : (
          <>
            <Metric label="Por cobrar" value={totalPendiente} tone={totalPendiente > 0 ? 'warning' : 'neutral'} delay={0.05} />
            <Metric label="Cobros" value={cobrados.length} kind="count" delay={0.08} />
          </>
        )}
      </div>

      {lista.length === 0 ? (
        <EmptyState icon={<Wallet size={22} />} title={tab === 'porcobrar' ? 'Todo cobrado' : 'Sin cobros en este periodo'} />
      ) : (
        <div className="widget" style={{ padding: 0 }}>
          {visibles.map((i, idx) => {
            const dias = diasPendienteDe(i);
            const linea = lineaDeIngreso(i);
            return (
              <motion.div key={i.id} className="list-row"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', bounce: 0, duration: 0.45, delay: Math.min(idx, 12) * 0.02 }}>
                <DateGlyph date={i.fechaEvento} />
                <span className="list-main">
                  <b>{i.cliente}</b>
                  <small>{[i.concepto, !fixedLinea && BUSINESS_LINES[linea].shortLabel, i.numeroFactura].filter(Boolean).join(' · ')}</small>
                </span>
                {tab === 'porcobrar' && <Pill tone={dias >= 60 ? 'negative' : dias >= 30 ? 'warning' : 'neutral'}>{dias} d</Pill>}
                <span className="list-amount num">
                  {fmt(tab === 'porcobrar' ? pendienteDe(i) : cobradoDe(i))}
                  <small>{tab === 'porcobrar' ? (i.estadoPago === 'parcial' ? `de ${fmt(i.total)}` : 'pendiente') : (i.fechaPago ?? METODO_LABEL[i.metodoPago] ?? i.metodoPago)}</small>
                </span>
                {tab === 'porcobrar' && canEditLinea(linea) && (
                  <button className="chip-btn" onClick={() => openPago(i)}><Plus size={13} strokeWidth={2.4} />Cobro</button>
                )}
                {tab === 'cobrado' && (canEditLinea(linea) || canDeleteLinea(linea)) && (
                  <RowMenu2 actions={[
                    ...(canEditLinea(linea) ? [{ label: 'Editar cobro', icon: <Edit2 size={13} />, onClick: () => openEditarCobro(i) }] : []),
                    ...(canDeleteLinea(linea) ? [{ label: 'Eliminar cobro', icon: <Trash2 size={13} />, danger: true, onClick: () => eliminarCobro(i) }] : []),
                  ]} />
                )}
              </motion.div>
            );
          })}
          {lista.length > LIMIT && (
            <button className="w-full py-3.5 text-[14px] font-semibold text-[var(--blue)] border-t border-black/[.06]" onClick={() => setVerTodos((v) => !v)}>
              {verTodos ? 'Ver menos' : `Ver todos (${lista.length})`}
            </button>
          )}
        </div>
      )}

      <Modal
        isOpen={!!pagoModal}
        onClose={closePago}
        title={pagoModo === 'editar' ? 'Editar cobro' : 'Registrar pago parcial'}
        subtitle={pagoModal ? `${pagoModal.concepto} · ${pagoModal.cliente}` : undefined}
        size="sm"
      >
        {pagoModal && (
          <div className="space-y-4">
            <div>
              <label className="label-form">{pagoModo === 'editar' ? 'Importe total cobrado (€)' : 'Importe a registrar (€)'}</label>
              <input type="number" step="0.01" value={pagoImporte} onChange={(e) => setPagoImporte(parseFloat(e.target.value) || 0)} className="input-form" />
              {pagoModo === 'editar' && (
                <p className="text-xs text-gray-400 mt-1">Sustituye el importe cobrado hasta ahora ({fmt(cobradoDe(pagoModal))}) por este valor — no se suma, se corrige.</p>
              )}
            </div>
            <div>
              <label className="label-form">Método de pago</label>
              <select value={pagoMetodo} onChange={(e) => setPagoMetodo(e.target.value as PaymentMethod)} className="input-form">
                {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <p className="text-xs text-gray-400">
              El historial detallado por pago (fecha, usuario, observaciones) estará disponible tras aplicar la migración pendiente. De momento se actualiza el importe cobrado acumulado del ingreso — no se crea ningún registro nuevo, siempre es el mismo ingreso.
            </p>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={closePago} className="flex-1">Cancelar</Button>
              <Button variant="primary" disabled={savingPayment} onClick={registrarPago} className="flex-1">{pagoModo === 'editar' ? 'Guardar' : 'Registrar'}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
