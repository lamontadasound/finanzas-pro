import { useState, useMemo } from 'react';
import { Download } from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { Area, GastoTipo, Ingreso } from '../../types';

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

const MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

interface Props { area: Area }

export const InformesPage = ({ area }: Props) => {
  const allIngresos     = useStore((s) => s.ingresos);
  const allGastos       = useStore((s) => s.gastos);
  const allGastosEvento = useStore((s) => s.gastosEvento);
  const allEquipo       = useStore((s) => s.equipo);
  const ingresos     = useMemo(() => allIngresos.filter((i) => i.area === area), [allIngresos, area]);
  const gastos       = useMemo(() => allGastos.filter((g) => g.area === area), [allGastos, area]);
  const gastosEvento = useMemo(() => allGastosEvento.filter((g) => g.area === area), [allGastosEvento, area]);
  const equipo       = useMemo(() => allEquipo.filter((e) => e.area === area), [allEquipo, area]);

  const [year, setYear] = useState(new Date().getFullYear());
  const [filterTipo, setFilterTipo] = useState<GastoTipo | ''>('');

  // ── Pagos pendientes ───────────────────────────────────────────────────────
  const [filtroPagoAnio, setFiltroPagoAnio] = useState<number | ''>('');
  const [filtroPagoMes, setFiltroPagoMes] = useState<number | ''>('');
  const [filtroPagoCliente, setFiltroPagoCliente] = useState('');
  const [filtroPagoDJ, setFiltroPagoDJ] = useState('');
  const [filtroPagoEstado, setFiltroPagoEstado] = useState<'' | 'pendiente' | 'parcial'>('');
  const [filtroPagoTipoEvento, setFiltroPagoTipoEvento] = useState('');

  const cantidadCobrada = (i: Ingreso) => (i.pagosRecibidos ?? 0) + (i.tieneReserva ? (i.reserva ?? 0) : 0);
  const cantidadPendienteDe = (i: Ingreso) => Math.max(0, i.total - cantidadCobrada(i));
  const diasPendienteDe = (i: Ingreso) => {
    const desde = new Date(i.fechaFactura || i.fechaEvento);
    return Math.max(0, Math.floor((Date.now() - desde.getTime()) / (1000 * 60 * 60 * 24)));
  };
  const estaVencido = (i: Ingreso) => !!i.fechaCobroPrevista && new Date(i.fechaCobroPrevista).getTime() < Date.now();

  const pagosPendientesBase = useMemo(
    () => ingresos.filter((i) => i.estadoPago === 'pendiente' || i.estadoPago === 'parcial'),
    [ingresos],
  );

  const clientesConPagosPendientes = useMemo(
    () => Array.from(new Set(pagosPendientesBase.map((i) => i.cliente))).sort(),
    [pagosPendientesBase],
  );
  const tiposEventoConPagosPendientes = useMemo(
    () => Array.from(new Set(pagosPendientesBase.map((i) => i.tipoEvento))).sort(),
    [pagosPendientesBase],
  );
  const djsConPagosPendientes = useMemo(
    () => Array.from(new Set(pagosPendientesBase.map((i) => i.djRelacionado).filter((d): d is string => !!d))).sort(),
    [pagosPendientesBase],
  );

  const pagosPendientesFiltrados = useMemo(() => pagosPendientesBase.filter((i) => {
    const d = new Date(i.fechaEvento);
    if (filtroPagoAnio !== '' && d.getFullYear() !== filtroPagoAnio) return false;
    if (filtroPagoMes !== '' && d.getMonth() !== filtroPagoMes) return false;
    if (filtroPagoCliente && i.cliente !== filtroPagoCliente) return false;
    if (filtroPagoDJ && i.djRelacionado !== filtroPagoDJ) return false;
    if (filtroPagoEstado && i.estadoPago !== filtroPagoEstado) return false;
    if (filtroPagoTipoEvento && i.tipoEvento !== filtroPagoTipoEvento) return false;
    return true;
  }).sort((a, b) => b.fechaEvento.localeCompare(a.fechaEvento)), [pagosPendientesBase, filtroPagoAnio, filtroPagoMes, filtroPagoCliente, filtroPagoDJ, filtroPagoEstado, filtroPagoTipoEvento]);

  const resumenPagosPendientes = useMemo(() => {
    const hoy = new Date();
    const delMes = pagosPendientesBase.filter((i) => {
      const d = new Date(i.fechaEvento);
      return d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth();
    });
    const delAnio = pagosPendientesBase.filter((i) => new Date(i.fechaEvento).getFullYear() === hoy.getFullYear());
    return {
      totalPendiente: pagosPendientesFiltrados.reduce((a, i) => a + cantidadPendienteDe(i), 0),
      numPendientes: pagosPendientesFiltrados.filter((i) => i.estadoPago === 'pendiente').length,
      numParciales: pagosPendientesFiltrados.filter((i) => i.estadoPago === 'parcial').length,
      numVencidos: pagosPendientesFiltrados.filter((i) => estaVencido(i)).length,
      totalPendienteMes: delMes.reduce((a, i) => a + cantidadPendienteDe(i), 0),
      totalPendienteAnio: delAnio.reduce((a, i) => a + cantidadPendienteDe(i), 0),
    };
  }, [pagosPendientesFiltrados, pagosPendientesBase]);

  const gastosAnio = useMemo(
    () => gastos.filter((g) => new Date(g.fecha).getFullYear() === year && (!filterTipo || g.tipo === filterTipo)),
    [gastos, year, filterTipo],
  );
  const gastosEventoAnio = useMemo(
    () => gastosEvento.filter((g) => new Date(g.fecha).getFullYear() === year && (!filterTipo || g.tipo === filterTipo)),
    [gastosEvento, year, filterTipo],
  );

  const porCategoriaGenerales = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    gastosAnio.forEach((g) => {
      const cur = map.get(g.categoria) ?? { count: 0, total: 0 };
      map.set(g.categoria, { count: cur.count + 1, total: cur.total + g.total });
    });
    return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [gastosAnio]);

  const porCategoriaEvento = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    gastosEventoAnio.forEach((g) => {
      const cur = map.get(g.categoria) ?? { count: 0, total: 0 };
      map.set(g.categoria, { count: cur.count + 1, total: cur.total + g.importe });
    });
    return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [gastosEventoAnio]);

  const yearOpts = useMemo(() => {
    const years = new Set<number>();
    [...ingresos, ...gastos].forEach((x) => years.add(new Date('fecha' in x ? x.fecha : x.fechaEvento).getFullYear()));
    if (!years.size) years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [ingresos, gastos]);

  const monthly = useMemo(() => {
    return MESES_FULL.map((mes, m) => {
      const ingMes = ingresos.filter((i) => {
        const d = new Date(i.fechaEvento); return d.getFullYear() === year && d.getMonth() === m;
      });
      const gasMes = gastos.filter((g) => {
        const d = new Date(g.fecha); return d.getFullYear() === year && d.getMonth() === m && (!filterTipo || g.tipo === filterTipo);
      });
      const gesEvMes = gastosEvento.filter((g) => {
        const d = new Date(g.fecha); return d.getFullYear() === year && d.getMonth() === m && (!filterTipo || g.tipo === filterTipo);
      });

      const totalIng    = ingMes.reduce((a, i) => a + i.total, 0);
      const baseImp     = ingMes.reduce((a, i) => a + i.baseImponible, 0);
      const totalGas    = gasMes.reduce((a, g) => a + g.total, 0);
      const costesEv    = gesEvMes.reduce((a, g) => a + g.importe, 0);
      const beneficio   = baseImp - costesEv;
      const cobrado     = ingMes.filter((i) => i.estadoPago === 'pagado').reduce((a, i) => a + i.total, 0);

      return { mes, totalIng, baseImp, totalGas, costesEv, beneficio, cobrado, numEv: ingMes.length };
    });
  }, [ingresos, gastos, gastosEvento, year, filterTipo]);

  const totals = monthly.reduce((acc, m) => ({
    totalIng:  acc.totalIng  + m.totalIng,
    baseImp:   acc.baseImp   + m.baseImp,
    totalGas:  acc.totalGas  + m.totalGas,
    costesEv:  acc.costesEv  + m.costesEv,
    beneficio: acc.beneficio + m.beneficio,
    cobrado:   acc.cobrado   + m.cobrado,
    numEv:     acc.numEv     + m.numEv,
  }), { totalIng: 0, baseImp: 0, totalGas: 0, costesEv: 0, beneficio: 0, cobrado: 0, numEv: 0 });

  const exportCSV = () => {
    const header = 'Mes;Ingresos;Base Imp.;Gastos;Costes Evento;Beneficio Real;Cobrado;Nº Eventos';
    const rows = monthly.map((m) =>
      [m.mes, m.totalIng.toFixed(2), m.baseImp.toFixed(2), m.totalGas.toFixed(2),
       m.costesEv.toFixed(2), m.beneficio.toFixed(2), m.cobrado.toFixed(2), m.numEv].join(';')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `informe-${area}-${year}.csv`,
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const exportEquipoCSV = () => {
    const header = 'Nombre;Categoría;Fecha Compra;Proveedor;Base Imp.;IVA;Total';
    const rows = equipo.map((e) =>
      [e.nombre, e.categoria, e.fechaCompra, e.proveedor ?? '',
       e.baseImponible.toFixed(2), e.importeIVA.toFixed(2), e.total.toFixed(2)].join(';')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `equipo-${area}.csv`,
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Informes</h1>
          <p className="text-sm text-gray-500">Resumen anual y exportaciones</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
            {yearOpts.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value as GastoTipo | '')} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
            <option value="">Todo tipo de gasto</option>
            <option value="fijo">Fijo</option>
            <option value="variable">Variable</option>
          </select>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 transition-colors">
            <Download size={14} /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Pagos pendientes */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Pagos pendientes de {area === 'montada' ? 'La Montada Sound' : 'DJs'}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{area === 'montada' ? 'Ingresos' : 'Actuaciones'} pendientes de cobrar total o parcialmente</p>
        </div>
        <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 border-b border-gray-100 bg-gray-50/50">
          <div><p className="text-xs text-gray-500">Total pendiente de cobrar</p><p className="font-bold text-amber-700">{fmt(resumenPagosPendientes.totalPendiente)}</p></div>
          <div><p className="text-xs text-gray-500">{area === 'montada' ? 'Facturas' : 'Actuaciones'} pendientes</p><p className="font-bold text-gray-900">{resumenPagosPendientes.numPendientes}</p></div>
          <div><p className="text-xs text-gray-500">Cobradas parcialmente</p><p className="font-bold text-gray-900">{resumenPagosPendientes.numParciales}</p></div>
          <div><p className="text-xs text-gray-500">Pendientes vencidos</p><p className={`font-bold ${resumenPagosPendientes.numVencidos > 0 ? 'text-red-600' : 'text-gray-900'}`}>{resumenPagosPendientes.numVencidos}</p></div>
          <div><p className="text-xs text-gray-500">Pendiente este mes</p><p className="font-bold text-gray-900">{fmt(resumenPagosPendientes.totalPendienteMes)}</p></div>
          <div><p className="text-xs text-gray-500">Pendiente este año</p><p className="font-bold text-gray-900">{fmt(resumenPagosPendientes.totalPendienteAnio)}</p></div>
        </div>
        <div className="px-5 py-3 flex flex-wrap gap-3 border-b border-gray-100">
          <select value={filtroPagoAnio} onChange={(e) => setFiltroPagoAnio(e.target.value ? Number(e.target.value) : '')} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
            <option value="">Todos los años</option>
            {Array.from(new Set(pagosPendientesBase.map((i) => new Date(i.fechaEvento).getFullYear()))).sort((a, b) => b - a).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={filtroPagoMes} onChange={(e) => setFiltroPagoMes(e.target.value !== '' ? Number(e.target.value) : '')} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
            <option value="">Todos los meses</option>
            {MESES_FULL.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select value={filtroPagoCliente} onChange={(e) => setFiltroPagoCliente(e.target.value)} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
            <option value="">Todos los clientes</option>
            {clientesConPagosPendientes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {area === 'dj' && (
            <select value={filtroPagoDJ} onChange={(e) => setFiltroPagoDJ(e.target.value)} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
              <option value="">Todos los DJs</option>
              {djsConPagosPendientes.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          <select value={filtroPagoEstado} onChange={(e) => setFiltroPagoEstado(e.target.value as '' | 'pendiente' | 'parcial')} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
            <option value="">Pendiente y parcial</option>
            <option value="pendiente">Solo pendiente</option>
            <option value="parcial">Solo parcial</option>
          </select>
          <select value={filtroPagoTipoEvento} onChange={(e) => setFiltroPagoTipoEvento(e.target.value)} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
            <option value="">Todos los tipos de evento</option>
            {tiposEventoConPagosPendientes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Concepto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                {area === 'dj' && <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">DJ</th>}
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tipo evento</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nº factura</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total con IVA</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Reserva cobrada</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Pendiente</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Días pendiente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pagosPendientesFiltrados.length === 0 ? (
                <tr><td colSpan={area === 'dj' ? 11 : 10} className="text-center py-10 text-gray-400 text-sm">Sin pagos pendientes</td></tr>
              ) : pagosPendientesFiltrados.map((i) => (
                <tr key={i.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{i.concepto}</td>
                  <td className="px-4 py-3 text-gray-600">{i.cliente}</td>
                  {area === 'dj' && <td className="px-4 py-3 text-gray-600">{i.djRelacionado || <span className="text-gray-300">—</span>}</td>}
                  <td className="px-4 py-3 text-gray-600">{i.tipoEvento}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{i.fechaEvento}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{i.numeroFactura || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900">{fmt(i.total)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600">{i.tieneReserva ? fmt(i.reserva ?? 0) : '—'}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-amber-700">{fmt(cantidadPendienteDe(i))}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${i.estadoPago === 'parcial' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{i.estadoPago}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">{diasPendienteDe(i)}{estaVencido(i) && <span className="ml-1 text-red-600 font-semibold">(vencido)</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabla mensual */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Mes</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ingresos</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Base imp.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Gastos gen.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Costes evento</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Beneficio real</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cobrado</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Eventos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {monthly.map((m) => (
                <tr key={m.mes} className={`hover:bg-gray-50 ${m.numEv === 0 ? 'opacity-40' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-800">{m.mes}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{fmt(m.totalIng)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600">{fmt(m.baseImp)}</td>
                  <td className="px-4 py-3 text-right font-mono text-red-600">{fmt(m.totalGas)}</td>
                  <td className="px-4 py-3 text-right font-mono text-orange-600">{fmt(m.costesEv)}</td>
                  <td className={`px-4 py-3 text-right font-mono font-semibold ${m.beneficio >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(m.beneficio)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600">{fmt(m.cobrado)}</td>
                  <td className="px-4 py-3 text-center text-gray-500">{m.numEv || '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
              <tr>
                <td className="px-4 py-3 text-xs uppercase text-gray-600">Total {year}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-900">{fmt(totals.totalIng)}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-800">{fmt(totals.baseImp)}</td>
                <td className="px-4 py-3 text-right font-mono text-red-700">{fmt(totals.totalGas)}</td>
                <td className="px-4 py-3 text-right font-mono text-orange-700">{fmt(totals.costesEv)}</td>
                <td className={`px-4 py-3 text-right font-mono ${totals.beneficio >= 0 ? 'text-green-800' : 'text-red-700'}`}>{fmt(totals.beneficio)}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-800">{fmt(totals.cobrado)}</td>
                <td className="px-4 py-3 text-center text-gray-700">{totals.numEv}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Gasto por categoría */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">Gastos generales por categoría — {year}</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Categoría</th>
                <th className="text-center px-4 py-2 text-xs font-semibold text-gray-500">Nº</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {porCategoriaGenerales.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-6 text-gray-400 text-sm">Sin gastos en {year}</td></tr>
              ) : porCategoriaGenerales.map(([cat, data]) => (
                <tr key={cat} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{cat}</td>
                  <td className="px-4 py-2.5 text-center text-gray-500">{data.count}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-700">{fmt(data.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">Gastos de evento por categoría — {year}</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Categoría</th>
                <th className="text-center px-4 py-2 text-xs font-semibold text-gray-500">Nº</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {porCategoriaEvento.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-6 text-gray-400 text-sm">Sin gastos en {year}</td></tr>
              ) : porCategoriaEvento.map(([cat, data]) => (
                <tr key={cat} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{cat}</td>
                  <td className="px-4 py-2.5 text-center text-gray-500">{data.count}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-700">{fmt(data.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inventario equipo */}
      {equipo.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Inventario de equipo</h2>
            <button onClick={exportEquipoCSV} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
              <Download size={12} /> Exportar
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Nombre</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Categoría</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Fecha compra</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {equipo.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{e.nombre}</td>
                  <td className="px-4 py-2.5 text-gray-500">{e.categoria}</td>
                  <td className="px-4 py-2.5 text-gray-500">{e.fechaCompra}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-700">{fmt(e.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
