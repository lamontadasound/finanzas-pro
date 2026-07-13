import { useMemo } from 'react';
import { useStore } from '../../store/useStore';
import type { Area } from '../../types';

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

interface Props { area: Area }

export const PagosPage = ({ area }: Props) => {
  const ingresos    = useStore((s) => s.ingresos.filter((i) => i.area === area));
  const pagosEvento = useStore((s) => s.pagosEvento.filter((p) => p.area === area));

  const pendientes = useMemo(() =>
    ingresos.filter((i) => ['pendiente', 'parcial'].includes(i.estadoPago))
      .map((i) => ({
        ...i,
        pendiente: i.total - i.pagosRecibidos,
      }))
      .sort((a, b) => (a.fechaCobroPrevista ?? a.fechaEvento).localeCompare(b.fechaCobroPrevista ?? b.fechaEvento)),
  [ingresos]);

  const cobrados = useMemo(() =>
    ingresos.filter((i) => i.estadoPago === 'pagado').sort((a, b) => (b.fechaPago ?? b.fechaEvento).localeCompare(a.fechaPago ?? a.fechaEvento)),
  [ingresos]);

  const totalPendiente = pendientes.reduce((a, i) => a + i.pendiente, 0);
  const totalCobrado   = cobrados.reduce((a, i) => a + i.total, 0);

  const allPagos = [...pagosEvento].sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pagos recibidos</h1>
        <p className="text-sm text-gray-500">Seguimiento de cobros</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">Por cobrar</p>
          <p className="text-2xl font-bold text-amber-800 tabular-nums">{fmt(totalPendiente)}</p>
          <p className="text-xs text-amber-600 mt-1">{pendientes.length} eventos pendientes</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-2">Cobrado</p>
          <p className="text-2xl font-bold text-green-800 tabular-nums">{fmt(totalCobrado)}</p>
          <p className="text-xs text-green-600 mt-1">{cobrados.length} eventos pagados</p>
        </div>
      </div>

      {/* Pendientes de cobro */}
      {pendientes.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">Pendientes de cobro</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Concepto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha cobro</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Recibido</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Pendiente</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pendientes.map((i) => (
                <tr key={i.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{i.concepto}</td>
                  <td className="px-4 py-3 text-gray-600">{i.cliente}</td>
                  <td className="px-4 py-3 text-gray-500">{i.fechaCobroPrevista ?? i.fechaEvento}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{fmt(i.total)}</td>
                  <td className="px-4 py-3 text-right font-mono text-green-700">{fmt(i.pagosRecibidos)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-amber-700">{fmt(i.pendiente)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${i.estadoPago === 'parcial' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                      {i.estadoPago}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Historial de pagos parciales */}
      {allPagos.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">Historial de pagos parciales</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Concepto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Método</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Importe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allPagos.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{p.fecha}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.concepto}</td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{p.metodoPago}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-green-700">{fmt(p.importe)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pendientes.length === 0 && allPagos.length === 0 && (
        <p className="text-center py-16 text-gray-400 text-sm">No hay pagos registrados</p>
      )}
    </div>
  );
};
