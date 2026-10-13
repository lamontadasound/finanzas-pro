import {MotionTabs} from '../../components/ui/MotionTabs';
import {DriveExpenseSummary} from '../../components/facturacion/DriveExpenseSummary';
// ── Resumen contable — Contabilidad consolidada (Fase E) ────────────────────
// Vista conjunta de la sociedad: La Montada Sound + DJ + Real Madrid +
// La Montada Installations. Todas las fórmulas vienen de
// `src/lib/contabilidad.ts` — esta página no calcula nada por su cuenta,
// solo filtra (año/trimestre/mes/línea/estado de cobro) y presenta.
import { useMemo, useState } from 'react';
import { FileCheck, CheckCircle2, Clock, TrendingDown, Scale, TrendingUp } from 'lucide-react';
import { usePermittedFinancialData } from '../../hooks/usePermittedFinancialData';
import { StatCard2 } from '../../components/ui2/StatCard';
import { ContentCard2 } from '../../components/ui2/ContentCard';
import { BklitAreaCard, BklitProfitLossCard, BklitRingCard, BklitBarCard } from '../../components/charts-app/BklitCharts';
import { BUSINESS_LINES, LINEA_IDS, type LineaId } from '../../config/businessLines';
import { lineaDeIngreso, lineaDeGasto, agregarIngresos, agregarGastos, calcularResumenFinanciero, cobradoDe, pendienteDe } from '../../lib/contabilidad';
import type { Ingreso, PaymentStatus } from '../../types';

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', useGrouping: 'always' } as Intl.NumberFormatOptions);
const MESES_ABR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const TRIMESTRES = ['T1', 'T2', 'T3', 'T4'];

const LINEA_COLOR: Record<LineaId, string> = {
  montada_sound: '#4f46e5',
  dj: '#60a5fa',
  real_madrid: '#a78bfa',
  montada_installations: '#9f7668',
};

type EstadoFiltro = 'todos' | PaymentStatus;

export const ResumenContablePage = () => {
  const { ingresos, gastos, gastosEvento, lineasVisibles } = usePermittedFinancialData();

  const [view,setView]=useState<'resumen'|'resultados'>('resumen');
  const [year, setYear] = useState<number | 'todos'>(new Date().getFullYear());
  const [trimestre, setTrimestre] = useState<number | 'todos'>('todos');
  const [mes, setMes] = useState<number | 'todos'>('todos');
  const [lineaFiltro, setLineaFiltro] = useState<LineaId | 'todas'>('todas');
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>('todos');

  const yearOpts = useMemo(() => {
    const years = new Set<number>();
    ingresos.forEach((i) => years.add(new Date(i.fechaEvento).getFullYear()));
    gastos.forEach((g) => years.add(new Date(g.fecha).getFullYear()));
    if (!years.size) years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [ingresos, gastos]);

  const enPeriodo = (fecha: string) => {
    const d = new Date(fecha);
    if (year !== 'todos' && d.getFullYear() !== year) return false;
    if (trimestre !== 'todos' && Math.floor(d.getMonth() / 3) !== trimestre) return false;
    if (mes !== 'todos' && d.getMonth() !== mes) return false;
    return true;
  };

  // ── Filtrado consolidado — sociedad completa por defecto ──────────────────
  const ingresosFiltrados = useMemo(() => ingresos.filter((i) => {
    if (!enPeriodo(i.fechaEvento)) return false;
    if (lineaFiltro !== 'todas' && lineaDeIngreso(i) !== lineaFiltro) return false;
    if (estadoFiltro !== 'todos' && i.estadoPago !== estadoFiltro) return false;
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [ingresos, year, trimestre, mes, lineaFiltro, estadoFiltro]);

  const gastosFiltrados = useMemo(() => gastos.filter((g) => {
    if (!enPeriodo(g.fecha)) return false;
    if (lineaFiltro !== 'todas' && lineaDeGasto(g) !== lineaFiltro) return false;
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [gastos, year, trimestre, mes, lineaFiltro]);

  const ingresoIdsFiltrados = useMemo(() => new Set(ingresosFiltrados.map((i) => i.id)), [ingresosFiltrados]);
  const gastosEventoFiltrados = useMemo(
    () => gastosEvento.filter((g) => ingresoIdsFiltrados.has(g.ingresoId)),
    [gastosEvento, ingresoIdsFiltrados],
  );

  const resumen = useMemo(
    () => calcularResumenFinanciero(ingresosFiltrados, gastosFiltrados, gastosEventoFiltrados),
    [ingresosFiltrados, gastosFiltrados, gastosEventoFiltrados],
  );

  // ── Evolución mensual (Area Chart) ────────────────────────────────────────
  // Construida directamente a partir de `ingresosFiltrados`/`gastosFiltrados`
  // — el MISMO conjunto ya filtrado por año/trimestre/mes/línea/estado que
  // usan las tarjetas y la tabla de detalle. Antes se recalculaba desde los
  // datos SIN filtrar (solo aplicaba año y línea, ignorando trimestre, mes
  // y estado de cobro), lo que podía mostrar en el gráfico un conjunto de
  // registros distinto al de las tarjetas — corregido en esta auditoría.
  const evolucionMensual = useMemo(() => {
    const buckets = new Map<string, { date: Date; ingresos: Ingreso[] }>();
    ingresosFiltrados.forEach((i) => {
      const d = new Date(i.fechaEvento);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!buckets.has(key)) buckets.set(key, { date: new Date(d.getFullYear(), d.getMonth(), 1), ingresos: [] });
      buckets.get(key)!.ingresos.push(i);
    });
    gastosFiltrados.forEach((g) => {
      const d = new Date(g.fecha);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!buckets.has(key)) buckets.set(key, { date: new Date(d.getFullYear(), d.getMonth(), 1), ingresos: [] });
    });
    const gastosPorBucket = new Map<string, typeof gastosFiltrados>();
    gastosFiltrados.forEach((g) => {
      const d = new Date(g.fecha);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      gastosPorBucket.set(key, [...(gastosPorBucket.get(key) ?? []), g]);
    });
    return Array.from(buckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, bucket]) => {
        const idsMes = new Set(bucket.ingresos.map((i) => i.id));
        const gasMes = gastosPorBucket.get(key) ?? [];
        const gasEvMes = gastosEventoFiltrados.filter((g) => idsMes.has(g.ingresoId));
        const agIng = agregarIngresos(bucket.ingresos);
        const agGas = agregarGastos(gasMes, gasEvMes);
        return {
          date: bucket.date,
          mesLabel: MESES_ABR[bucket.date.getMonth()],
          ingresos: agIng.ingresosSinIVA,
          gastos: agGas.gastosDeducibles,
          beneficio: agIng.ingresosSinIVA - agGas.gastosDeducibles,
          cobrado: agIng.totalCobrado,
        };
      });
  }, [ingresosFiltrados, gastosFiltrados, gastosEventoFiltrados]);

  // ── Comparativa por línea de negocio (Bar Chart) ──────────────────────────
  const porLinea = useMemo(() => LINEA_IDS.filter((id) => lineasVisibles.includes(id)).map((id) => {
    const ingLinea = ingresosFiltrados.filter((i) => lineaDeIngreso(i) === id);
    const gasLinea = gastosFiltrados.filter((g) => lineaDeGasto(g) === id);
    const idsLinea = new Set(ingLinea.map((i) => i.id));
    const gasEvLinea = gastosEventoFiltrados.filter((g) => idsLinea.has(g.ingresoId));
    const r = calcularResumenFinanciero(ingLinea, gasLinea, gasEvLinea);
    return { linea: id, label: BUSINESS_LINES[id].shortLabel, ...r };
  }), [ingresosFiltrados, gastosFiltrados, gastosEventoFiltrados, lineasVisibles]);

  // Cuadre: la suma de los totales por línea debe ser exactamente el consolidado.
  const sumaLineas = porLinea.reduce((a, l) => a + l.totalFacturado, 0);
  const cuadraConsolidado = Math.abs(sumaLineas - resumen.totalFacturado) < 0.01;

  const detalle = useMemo(
    () => [...ingresosFiltrados].sort((a, b) => b.fechaEvento.localeCompare(a.fechaEvento)).slice(0, 30),
    [ingresosFiltrados],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Resumen contable</h1>
        
      </div>

      <MotionTabs layoutId="contabilidad-vista" value={view} onChange={setView} items={[{value:"resumen",label:"Resumen"},{value:"resultados",label:"Estado de resultados"}]}/>
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={year} onChange={(e) => { setYear(e.target.value === 'todos' ? 'todos' : Number(e.target.value)); }} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
          <option value="todos">Todos los años</option>
          {yearOpts.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={trimestre} onChange={(e) => setTrimestre(e.target.value === 'todos' ? 'todos' : Number(e.target.value))} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
          <option value="todos">Todos los trimestres</option>
          {TRIMESTRES.map((t, i) => <option key={t} value={i}>{t}</option>)}
        </select>
        <select value={mes} onChange={(e) => setMes(e.target.value === 'todos' ? 'todos' : Number(e.target.value))} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
          <option value="todos">Todos los meses</option>
          {MESES_FULL.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>
        <select value={lineaFiltro} onChange={(e) => setLineaFiltro(e.target.value as LineaId | 'todas')} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
          <option value="todas">Toda la sociedad</option>
          {LINEA_IDS.filter((id) => lineasVisibles.includes(id)).map((id) => <option key={id} value={id}>{BUSINESS_LINES[id].label}</option>)}
        </select>
        <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value as EstadoFiltro)} className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
          <option value="todos">Todos los estados de cobro</option>
          <option value="pagado">Pagado</option>
          <option value="parcial">Parcial</option>
          <option value="pendiente">Pendiente</option>
          <option value="presupuesto">Presupuesto</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>

      {lineaFiltro === 'todas' && estadoFiltro === 'todos' && lineasVisibles.length === 4 ? <DriveExpenseSummary statement={view==='resultados'} year={year} month={mes} quarter={trimestre} income={resumen.ingresosSinIVA} outputVat={resumen.ivaRepercutido}/> : <p className="text-sm text-gray-500">La estimación de Drive corresponde a toda la sociedad. Requiere acceso a las cuatro líneas y los filtros «Toda la sociedad» y «Todos los estados de cobro».</p>}
      {view==='resumen'&&<>
      <h2 className="text-lg font-semibold">Control de actividad · registros de la app</h2>
      {/* ── Cifra protagonista — mismo lenguaje que el Dashboard: el número ─
          que de verdad importa aquí (resultado tras impuestos) primero,
          grande, con el resto como contexto, no 10 tarjetas de igual peso. */}
      <div className="bg-white border border-gray-100 rounded-card shadow-card px-6 py-7 sm:px-8 sm:py-8">
        <p className="text-sm text-gray-400 mb-1.5">Resultado operativo antes de impuestos</p>
        <p className={`text-[2.75rem] sm:text-5xl font-bold tracking-tight leading-none ${resumen.beneficioAntesImpuestos >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
          {fmt(resumen.beneficioAntesImpuestos)}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium"><CheckCircle2 size={14} /> {fmt(resumen.totalCobrado)} cobrado</span>
          {resumen.totalPendiente > 0 && (
            <span className="inline-flex items-center gap-1.5 text-amber-600 font-medium"><Clock size={14} /> {fmt(resumen.totalPendiente)} pendiente</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard2 label="Ingresos sin IVA" value={resumen.ingresosSinIVA} format={fmt} icon={<TrendingUp size={16} />} tone="default" />
        <StatCard2 label="Total facturado" value={resumen.totalFacturado} format={fmt} icon={<FileCheck size={16} />} tone="default" />
        <StatCard2 label="Gastos registrados" value={resumen.gastosDeducibles} format={fmt} icon={<TrendingDown size={16} />} tone="danger" />
        <StatCard2 label="Beneficio operativo" value={resumen.beneficioAntesImpuestos} format={fmt} sub="Antes de impuestos" icon={<Scale size={16} />} tone={resumen.beneficioAntesImpuestos >= 0 ? 'success' : 'danger'} />
      </div>
      {/* Evolución mensual — Area Chart Bklit (mismo conjunto filtrado que las tarjetas) */}
      <BklitAreaCard
        title={year === 'todos' ? 'Evolución mensual — todos los años' : `Evolución mensual — ${year}`}
        description="Ingresos, gastos y cobrado (sin IVA) del periodo y línea filtrados"
        data={evolucionMensual}
        series={[
          { key: 'ingresos', color: '#2563eb' },
          { key: 'gastos', color: '#dc2626' },
          { key: 'cobrado', color: '#15803d' },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ring Chart — cobrado vs pendiente */}
        <BklitRingCard
          title="Cobrado frente a pendiente"
          description="Cobrado y pendiente"
          centerLabel="Total facturado"
          centerValue={fmt(resumen.totalFacturado)}
          data={[
            { label: 'Cobrado', value: resumen.totalCobrado, maxValue: resumen.totalFacturado || 1, color: '#15803d' },
            { label: 'Pendiente', value: resumen.totalPendiente, maxValue: resumen.totalFacturado || 1, color: '#dc2626' },
          ]}
        />

        {/* Profit/Loss — resultado mensual */}
        <BklitProfitLossCard
          title="Beneficio mensual"
          description="Verde si el mes es positivo, rojo si es negativo"
          data={evolucionMensual}
          dataKey="beneficio"
        />
      </div>

      {/* Bar Chart — comparación por línea de negocio */}
      <BklitBarCard
        title="Comparación por línea de negocio"
        description="Ingresos sin IVA por línea"
        data={porLinea.map((l) => ({ label: l.label, ingresosSinIVA: l.ingresosSinIVA }))}
        xDataKey="label"
        dataKey="ingresosSinIVA"
      />

      {/* Cuadre por línea */}
      <ContentCard2 title="Cuadre por línea de negocio" description={cuadraConsolidado ? 'La suma de las líneas coincide exactamente con el consolidado.' : 'Aviso: la suma no coincide con el consolidado.'}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Línea</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Facturado</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Cobrado</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Pendiente</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Beneficio antes imp.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {porLinea.map((l) => (
                <tr key={l.linea}>
                  <td className="px-3 py-2.5 font-medium text-gray-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: LINEA_COLOR[l.linea] }} />
                    {l.label}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-700">{fmt(l.totalFacturado)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-emerald-700">{fmt(l.totalCobrado)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-amber-700">{fmt(l.totalPendiente)}</td>
                  <td className={`px-3 py-2.5 text-right font-mono font-semibold ${l.beneficioAntesImpuestos >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmt(l.beneficioAntesImpuestos)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
              <tr>
                <td className="px-3 py-2.5 text-xs uppercase text-gray-600">Consolidado</td>
                <td className="px-3 py-2.5 text-right font-mono text-gray-900">{fmt(resumen.totalFacturado)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-gray-900">{fmt(resumen.totalCobrado)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-gray-900">{fmt(resumen.totalPendiente)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-gray-900">{fmt(resumen.beneficioAntesImpuestos)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </ContentCard2>

      {/* Tabla de detalle — últimos 30 ingresos del periodo filtrado */}
      <ContentCard2 title="Detalle de ingresos" description={`${ingresosFiltrados.length} ingreso(s) en el periodo filtrado — mostrando los ${Math.min(30, ingresosFiltrados.length)} más recientes`}>
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Línea</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Total</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Cobrado</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Pendiente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {detalle.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400 text-sm">Sin ingresos en el periodo/filtros seleccionados</td></tr>
              ) : detalle.map((i: Ingreso) => (
                <tr key={i.id}>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{i.fechaEvento}</td>
                  <td className="px-3 py-2 text-gray-800">{i.cliente}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{BUSINESS_LINES[lineaDeIngreso(i)].shortLabel}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-700">{fmt(i.total)}</td>
                  <td className="px-3 py-2 text-right font-mono text-emerald-700">{fmt(cobradoDe(i))}</td>
                  <td className="px-3 py-2 text-right font-mono text-amber-700">{fmt(pendienteDe(i))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ContentCard2>
      </>}
    </div>
  );
};
