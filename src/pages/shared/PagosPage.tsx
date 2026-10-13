import { useMemo, useState } from 'react';
import { Plus, Wallet, CheckCircle2, Edit2, Trash2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useConfirmStore } from '../../store/useConfirmStore';
import { Modal } from '../../components/ui/Modal';
import { StatCard } from '../../components/ui/StatCard';
import { MotionTabs } from '../../components/ui/MotionTabs';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { YearQuarterMonthNav } from '../../components/ui/YearQuarterMonthNav';
import { matchesYQM, type YQMValue } from '../../components/ui/yqm';
import { BUSINESS_LINES, LINEA_IDS, type LineaId } from '../../config/businessLines';
import { cobradoDe, pendienteDe, diasPendienteDe, lineaDeIngreso, estadoPagoDesdeCobrado } from '../../lib/contabilidad';
import type { Area, Ingreso, PaymentMethod } from '../../types';

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const METODOS: PaymentMethod[] = ['efectivo', 'transferencia', 'tarjeta', 'cheque', 'bizum', 'otro'];
const MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

interface Props {
  area: Area | 'todos';
  fixedLinea?: LineaId;
  /** Pestaña inicial — "Pagos recibidos" abre en 'cobrado', "Pagos pendientes" en 'porcobrar'. */
  defaultTab?: 'cobrado' | 'porcobrar';
}

const estadoTone = (estado: Ingreso['estadoPago']) =>
  estado === 'pagado' ? 'success' : estado === 'parcial' ? 'warning' : 'danger' as const;

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
  const [filterCliente, setFilterCliente] = useState('');
  const [filterFactura, setFilterFactura] = useState('');
  const [filterMetodo, setFilterMetodo] = useState<PaymentMethod | ''>('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [pagoModal, setPagoModal] = useState<Ingreso | null>(null);
  const [pagoModo, setPagoModo] = useState<'registrar' | 'editar'>('registrar');
  const [pagoImporte, setPagoImporte] = useState(0);
  const [pagoMetodo, setPagoMetodo] = useState<PaymentMethod>('transferencia');
  const [nav, setNav] = useState<YQMValue>({ year: null, trimestre: null, month: null });

  const base = useMemo(
    () => filterLinea === 'todas' ? ingresos : ingresos.filter((i) => lineaDeIngreso(i) === filterLinea),
    [ingresos, filterLinea],
  );

  const enElPeriodo = useMemo(() => base.filter((i) => matchesYQM(i.fechaEvento, nav)), [base, nav]);
  const navItems = useMemo(() => base.map((i) => ({ fecha: i.fechaEvento, total: i.baseImponible })), [base]);

  const clientesDisponibles = useMemo(() => Array.from(new Set(base.map((i) => i.cliente))).sort(), [base]);

  const pasaFiltrosComunes = (i: Ingreso) => {
    if (filterCliente && i.cliente !== filterCliente) return false;
    if (filterFactura && !(i.numeroFactura ?? '').toLowerCase().includes(filterFactura.toLowerCase())) return false;
    if (filterMetodo && i.metodoPago !== filterMetodo) return false;
    return true;
  };

  // "Pagado" = cobrado al 100% (cobradoDe centraliza esa regla, evita el
  // error histórico de "pagado" sin pagosRecibidos sincronizado).
  const cobrados   = useMemo(
    () => enElPeriodo.filter((i) => i.estadoPago === 'pagado' && pasaFiltrosComunes(i))
      .sort((a, b) => (b.fechaPago ?? b.fechaEvento).localeCompare(a.fechaPago ?? a.fechaEvento)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enElPeriodo, filterCliente, filterFactura, filterMetodo],
  );
  // Ordenados de más antiguo a más reciente — "quién falta por pagar desde hace más tiempo" primero.
  const porCobrar  = useMemo(
    () => enElPeriodo.filter((i) => ['pendiente', 'parcial'].includes(i.estadoPago) && pasaFiltrosComunes(i))
      .sort((a, b) => diasPendienteDe(b) - diasPendienteDe(a)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enElPeriodo, filterCliente, filterFactura, filterMetodo],
  );

  const totalCobrado   = cobrados.reduce((a, i) => a + cobradoDe(i), 0);
  const totalPendiente = porCobrar.reduce((a, i) => a + pendienteDe(i), 0);

  // Totales por mes y por línea — solo para la vista de pendientes.
  const totalesPorMes = useMemo(() => {
    const map = new Map<string, number>();
    porCobrar.forEach((i) => {
      const d = new Date(i.fechaEvento);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map.set(key, (map.get(key) ?? 0) + pendienteDe(i));
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [porCobrar]);

  const totalesPorLinea = useMemo(() => {
    const map = new Map<LineaId, number>();
    porCobrar.forEach((i) => {
      const l = lineaDeIngreso(i);
      map.set(l, (map.get(l) ?? 0) + pendienteDe(i));
    });
    return LINEA_IDS.filter((id) => map.has(id)).map((id) => [id, map.get(id) ?? 0] as const);
  }, [porCobrar]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{tab === 'cobrado' ? 'Pagos recibidos' : 'Pagos pendientes'}</h1>
        
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Por cobrar" value={totalPendiente} format={fmt} sub={`${porCobrar.length} ingresos pendientes`} tone="danger" icon={<Wallet size={15} />} />
        <StatCard label="Cobrado" value={totalCobrado} format={fmt} sub={`${cobrados.length} ingresos cobrados`} tone="success" icon={<CheckCircle2 size={15} />} />
      </div>

      <div className="flex flex-wrap gap-3 items-center justify-between">
        <MotionTabs
          layoutId="pagos-tab"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'porcobrar', label: 'Pendientes' },
            { value: 'cobrado', label: 'Recibidos' },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          {!fixedLinea && <select aria-label="Filtrar por línea" value={filterLinea} onChange={(e) => setFilterLinea(e.target.value as LineaId | 'todas')} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
            <option value="todas">Todas las líneas</option>
            {lineasVisibles.map((id) => <option key={id} value={id}>{BUSINESS_LINES[id].label}</option>)}
          </select>}
          <select value={filterCliente} onChange={(e) => setFilterCliente(e.target.value)} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
            <option value="">Todos los clientes</option>
            {clientesDisponibles.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={filterFactura} onChange={(e) => setFilterFactura(e.target.value)} placeholder="Nº factura…" className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white w-32" />
          <select value={filterMetodo} onChange={(e) => setFilterMetodo(e.target.value as PaymentMethod | '')} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
            <option value="">Todos los métodos</option>
            {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <YearQuarterMonthNav items={navItems} value={nav} onChange={setNav} />
      {tab==='porcobrar'&&<section aria-label="Pendientes por apartado" className="space-y-4">
        {porCobrar.some(i=>diasPendienteDe(i)>=30)&&<div role="status" className="rounded-2xl bg-red-50 text-red-800 p-4"><strong>{porCobrar.filter(i=>diasPendienteDe(i)>=30).length} cobros pendientes desde hace 30 días o más</strong><p className="text-sm">Desde la fecha del evento.</p></div>}
        <div className="grid md:grid-cols-2 gap-4">{totalesPorLinea.map(([id,amount])=><section key={id} className="payment-line-card"><div className="flex justify-between gap-3"><h2 className="font-semibold">{BUSINESS_LINES[id].shortLabel}</h2><strong className="text-red-600">{fmt(amount)}</strong></div><ul className="divide-y mt-3">{porCobrar.filter(i=>lineaDeIngreso(i)===id).map(i=><li key={i.id} className="flex items-center gap-3 py-3"><span className="client-avatar">{i.cliente.slice(0,1).toUpperCase()}</span><div className="min-w-0 flex-1"><strong className="block truncate text-sm">{i.cliente}</strong><span className="text-xs text-gray-500">{i.fechaEvento} · {i.concepto}</span></div><div className="text-right"><span className="block text-sm font-semibold">{fmt(pendienteDe(i))}</span>{canEditLinea(id)&&<button className="text-blue-700 text-xs min-h-8" onClick={()=>openPago(i)}>Registrar cobro</button>}</div></li>)}</ul></section>)}</div>
      </section>}


      {tab === 'porcobrar' && (totalesPorMes.length > 0 || totalesPorLinea.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-card shadow-card p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Pendiente por mes</h3>
            <div className="space-y-1">
              {totalesPorMes.map(([key, total]) => {
                const [, m] = key.split('-');
                return (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{MESES_FULL[Number(m) - 1]}</span>
                    <span className="font-mono font-medium text-red-700">{fmt(total)}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-card shadow-card p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Pendiente por línea</h3>
            <div className="space-y-1">
              {totalesPorLinea.map(([id, total]) => (
                <div key={id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{BUSINESS_LINES[id].label}</span>
                  <span className="font-mono font-medium text-red-700">{fmt(total)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {(
      <div className="bg-white border border-gray-200 rounded-card shadow-card overflow-hidden">
        {lista.length === 0 ? (
          <EmptyState icon={<Wallet size={22} />} title="Sin registros en esta vista" description="Prueba a cambiar de pestaña, línea o periodo." />
        ) : (
          <>
          {/* Tabla — escritorio/tablet */}
          <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Línea</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Método</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nº factura</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Recibido</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Pendiente</th>
                {tab === 'porcobrar' && <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Días</th>}
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lista.map((i) => (
                <tr key={i.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{i.cliente}</p>
                    <p className="text-xs text-gray-400">{i.concepto}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{BUSINESS_LINES[lineaDeIngreso(i)].shortLabel}</td>
                  <td className="px-4 py-3 text-gray-500">{i.fechaEvento}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs capitalize">{i.metodoPago}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{i.numeroFactura || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{fmt(i.total)}</td>
                  <td className="px-4 py-3 text-right font-mono text-accent-700">{fmt(cobradoDe(i))}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-red-700">{fmt(pendienteDe(i))}</td>
                  {tab === 'porcobrar' && <td className="px-4 py-3 text-center text-xs text-gray-500">{diasPendienteDe(i)}</td>}
                  <td className="px-4 py-3 text-center"><Badge tone={estadoTone(i.estadoPago)}>{i.estadoPago}</Badge></td>
                  <td className="px-4 py-3">
                    {tab === 'porcobrar' && canEditLinea(lineaDeIngreso(i)) && (
                      <button onClick={() => openPago(i)} className="flex items-center gap-1 text-xs text-gold-600 hover:text-gold-500 font-medium transition-colors">
                        <Plus size={12} /> Registrar pago
                      </button>
                    )}
                    {tab === 'cobrado' && (canEditLinea(lineaDeIngreso(i)) || canDeleteLinea(lineaDeIngreso(i))) && (
                      <div className="flex items-center justify-end gap-1">
                        {canEditLinea(lineaDeIngreso(i)) && (
                          <button onClick={() => openEditarCobro(i)} aria-label="Editar cobro" className="p-1.5 text-gray-400 hover:text-gold-500 hover:bg-gold-50 rounded-lg transition-colors"><Edit2 size={13} /></button>
                        )}
                        {canDeleteLinea(lineaDeIngreso(i)) && (
                          <button onClick={() => eliminarCobro(i)} aria-label="Eliminar cobro" className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={13} /></button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* Tarjetas — móvil */}
          <div className="sm:hidden divide-y divide-gray-100">
            {lista.map((i) => (
              <div key={i.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{i.cliente}</p>
                    <p className="text-xs text-gray-400 truncate">{i.concepto}</p>
                  </div>
                  <Badge tone={estadoTone(i.estadoPago)} className="flex-shrink-0">{i.estadoPago}</Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{i.fechaEvento} · {BUSINESS_LINES[lineaDeIngreso(i)].shortLabel}</span>
                  {tab === 'porcobrar' && <span>{diasPendienteDe(i)} días</span>}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span className="capitalize">{i.metodoPago}</span>
                  <span>{i.numeroFactura || '—'}</span>
                </div>
                <div className="flex items-center justify-between text-sm pt-1">
                  <span className="text-gray-500">Total <span className="font-mono text-gray-800">{fmt(i.total)}</span></span>
                  <span className="text-gray-500">Pendiente <span className="font-mono font-semibold text-red-700">{fmt(pendienteDe(i))}</span></span>
                </div>
                {tab === 'porcobrar' && canEditLinea(lineaDeIngreso(i)) && (
                  <Button size="sm" variant="secondary" icon={<Plus size={12} />} onClick={() => openPago(i)} className="w-full mt-1">
                    Registrar pago
                  </Button>
                )}
                {tab === 'cobrado' && (canEditLinea(lineaDeIngreso(i)) || canDeleteLinea(lineaDeIngreso(i))) && (
                  <div className="flex gap-2 mt-1">
                    {canEditLinea(lineaDeIngreso(i)) && (
                      <Button size="sm" variant="secondary" icon={<Edit2 size={12} />} onClick={() => openEditarCobro(i)} className="flex-1">Editar</Button>
                    )}
                    {canDeleteLinea(lineaDeIngreso(i)) && (
                      <Button size="sm" variant="secondary" icon={<Trash2 size={12} />} onClick={() => eliminarCobro(i)} className="flex-1">Eliminar</Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          </>
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
