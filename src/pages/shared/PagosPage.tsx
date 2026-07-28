import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Modal } from '../../components/ui/Modal';
import { YearQuarterMonthNav, matchesYQM, type YQMValue } from '../../components/ui/YearQuarterMonthNav';
import type { Area, Ingreso, PaymentMethod } from '../../types';

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const METODOS: PaymentMethod[] = ['efectivo', 'transferencia', 'tarjeta', 'cheque', 'bizum', 'otro'];

interface Props { area: Area | 'todos' }

const diasPendiente = (i: Ingreso) => {
  const ref = i.fechaCobroPrevista ?? i.fechaEvento;
  const dias = Math.floor((Date.now() - new Date(ref).getTime()) / (1000 * 60 * 60 * 24));
  return dias;
};

export const PagosPage = ({ area }: Props) => {
  const allIngresos  = useStore((s) => s.ingresos);
  const updateIngreso = useStore((s) => s.updateIngreso);
  const canEdit = useAuthStore((s) => s.canEdit);
  const ingresos = useMemo(
    () => area === 'todos' ? allIngresos : allIngresos.filter((i) => i.area === area),
    [allIngresos, area],
  );

  const [tab, setTab] = useState<'cobrado' | 'porcobrar'>('porcobrar');
  const [filterArea, setFilterArea] = useState<Area | 'todos'>('todos');
  const [pagoModal, setPagoModal] = useState<Ingreso | null>(null);
  const [pagoImporte, setPagoImporte] = useState(0);
  const [pagoMetodo, setPagoMetodo] = useState<PaymentMethod>('transferencia');
  const [nav, setNav] = useState<YQMValue>({ year: null, trimestre: null, month: null });

  const base = useMemo(
    () => area === 'todos' && filterArea !== 'todos' ? ingresos.filter((i) => i.area === filterArea) : ingresos,
    [ingresos, area, filterArea],
  );

  const enElPeriodo = useMemo(() => base.filter((i) => matchesYQM(i.fechaEvento, nav)), [base, nav]);
  const navItems = useMemo(() => base.map((i) => ({ fecha: i.fechaEvento, total: i.total })), [base]);
  const completo = nav.year != null && nav.trimestre != null && nav.month != null;

  const cobrados   = useMemo(() => enElPeriodo.filter((i) => i.estadoPago === 'pagado').sort((a, b) => (b.fechaPago ?? b.fechaEvento).localeCompare(a.fechaPago ?? a.fechaEvento)), [enElPeriodo]);
  const porCobrar  = useMemo(() => enElPeriodo.filter((i) => ['pendiente', 'parcial'].includes(i.estadoPago)).sort((a, b) => diasPendiente(b) - diasPendiente(a)), [enElPeriodo]);

  const totalCobrado   = cobrados.reduce((a, i) => a + i.total, 0);
  const totalPendiente = porCobrar.reduce((a, i) => a + (i.total - i.pagosRecibidos), 0);

  const lista = tab === 'cobrado' ? cobrados : porCobrar;

  const openPago = (i: Ingreso) => { setPagoModal(i); setPagoImporte(Math.max(0, i.total - i.pagosRecibidos)); setPagoMetodo(i.metodoPago); };
  const closePago = () => setPagoModal(null);

  const registrarPago = () => {
    if (!pagoModal || pagoImporte <= 0) return;
    const nuevoCobrado = pagoModal.pagosRecibidos + pagoImporte;
    const estado = nuevoCobrado <= 0 ? 'pendiente' : nuevoCobrado < pagoModal.total ? 'parcial' : 'pagado';
    updateIngreso(pagoModal.id, {
      pagosRecibidos: nuevoCobrado,
      estadoPago: estado,
      metodoPago: pagoMetodo,
      fechaPago: estado === 'pagado' ? new Date().toISOString().slice(0, 10) : pagoModal.fechaPago,
    });
    closePago();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pagos recibidos</h1>
        <p className="text-sm text-gray-500">Seguimiento de cobros</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">Por cobrar</p>
          <p className="text-2xl font-bold text-amber-800 tabular-nums">{fmt(totalPendiente)}</p>
          <p className="text-xs text-amber-600 mt-1">{porCobrar.length} facturas pendientes</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-2">Cobrado</p>
          <p className="text-2xl font-bold text-green-800 tabular-nums">{fmt(totalCobrado)}</p>
          <p className="text-xs text-green-600 mt-1">{cobrados.length} ingresos cobrados</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2">
          <button onClick={() => setTab('porcobrar')} className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === 'porcobrar' ? 'bg-amber-500 text-black' : 'bg-white border border-gray-200 text-gray-600'}`}>Por cobrar</button>
          <button onClick={() => setTab('cobrado')} className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === 'cobrado' ? 'bg-amber-500 text-black' : 'bg-white border border-gray-200 text-gray-600'}`}>Cobrado</button>
        </div>
        {area === 'todos' && (
          <select value={filterArea} onChange={(e) => setFilterArea(e.target.value as Area | 'todos')} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
            <option value="todos">Todas las áreas</option>
            <option value="montada">La Montada Sound</option>
            <option value="dj">DJs</option>
          </select>
        )}
      </div>

      <YearQuarterMonthNav items={navItems} value={nav} onChange={setNav} />

      {completo && (
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {lista.length === 0 ? (
          <p className="text-center py-16 text-gray-400 text-sm">Sin registros en esta vista</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                {area === 'todos' && <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Área</th>}
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cobrado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Pendiente</th>
                {tab === 'porcobrar' && <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Días</th>}
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lista.map((i) => (
                <tr key={i.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{i.cliente}</p>
                    <p className="text-xs text-gray-400">{i.concepto}</p>
                  </td>
                  {area === 'todos' && <td className="px-4 py-3 text-gray-500 text-xs">{i.area === 'montada' ? 'Montada' : 'DJ'}</td>}
                  <td className="px-4 py-3 text-gray-500">{i.fechaEvento}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{fmt(i.total)}</td>
                  <td className="px-4 py-3 text-right font-mono text-green-700">{fmt(i.pagosRecibidos)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-amber-700">{fmt(i.total - i.pagosRecibidos)}</td>
                  {tab === 'porcobrar' && <td className="px-4 py-3 text-center text-xs text-gray-500">{diasPendiente(i)}</td>}
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${i.estadoPago === 'pagado' ? 'bg-green-100 text-green-700' : i.estadoPago === 'parcial' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                      {i.estadoPago}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {tab === 'porcobrar' && canEdit(i.area) && (
                      <button onClick={() => openPago(i)} className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-500 font-medium">
                        <Plus size={12} /> Registrar pago
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      )}

      <Modal isOpen={!!pagoModal} onClose={closePago} title="Registrar pago parcial" size="sm">
        {pagoModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{pagoModal.concepto} · {pagoModal.cliente}</p>
            <div>
              <label className="label-form">Importe a registrar (€)</label>
              <input type="number" step="0.01" value={pagoImporte} onChange={(e) => setPagoImporte(parseFloat(e.target.value) || 0)} className="input-form" />
            </div>
            <div>
              <label className="label-form">Método de pago</label>
              <select value={pagoMetodo} onChange={(e) => setPagoMetodo(e.target.value as PaymentMethod)} className="input-form">
                {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <p className="text-xs text-gray-400">
              El historial detallado por pago (fecha, usuario, observaciones) estará disponible tras aplicar la migración pendiente. De momento se actualiza el importe cobrado acumulado del ingreso.
            </p>
            <div className="flex gap-3 pt-2">
              <button onClick={closePago} className="flex-1 py-2 border border-gray-200 text-sm rounded-xl hover:bg-gray-50">Cancelar</button>
              <button onClick={registrarPago} className="flex-1 py-2 bg-amber-500 text-black text-sm font-semibold rounded-xl hover:bg-amber-400">Registrar</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
