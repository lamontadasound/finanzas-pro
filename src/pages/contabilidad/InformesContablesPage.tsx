// ── Informe contable — comparativa anual consolidada (Fase E) ──────────────
// Drill-down: sociedad completa → línea de negocio, sin duplicar páginas ni
// cálculos — todo pasa por `src/lib/contabilidad.ts`, la misma fuente que
// usa Resumen contable.
import { useMemo, useState } from 'react';
import { Download, ChevronLeft } from 'lucide-react';
import { usePermittedFinancialData } from '../../hooks/usePermittedFinancialData';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { BUSINESS_LINES, LINEA_IDS, type LineaId } from '../../config/businessLines';
import { lineaDeIngreso, lineaDeGasto, calcularResumenFinanciero, ivaEstimadoALiquidar } from '../../lib/contabilidad';

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const TRIMESTRES = ['T1 (Ene–Mar)', 'T2 (Abr–Jun)', 'T3 (Jul–Sep)', 'T4 (Oct–Dic)'];

export const InformesContablesPage = () => {
  const { ingresos: allIngresos, gastos: allGastos, gastosEvento: allGastosEvento, lineasVisibles } = usePermittedFinancialData();

  const [year, setYear] = useState(new Date().getFullYear());
  const [lineaSeleccionada, setLineaSeleccionada] = useState<LineaId | null>(null);

  const yearOpts = useMemo(() => {
    const years = new Set<number>();
    allIngresos.forEach((i) => years.add(new Date(i.fechaEvento).getFullYear()));
    if (!years.size) years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [allIngresos]);

  // ── Filtrado del año, opcionalmente por línea ──────────────────────────────
  const ingresosLinea = (linea: LineaId | null) => allIngresos.filter((i) => {
    if (new Date(i.fechaEvento).getFullYear() !== year) return false;
    return linea == null || lineaDeIngreso(i) === linea;
  });
  const gastosLinea = (linea: LineaId | null) => allGastos.filter((g) => {
    if (new Date(g.fecha).getFullYear() !== year) return false;
    return linea == null || lineaDeGasto(g) === linea;
  });
  const gastosEventoDe = (ingresoIds: Set<string>) => allGastosEvento.filter((g) => ingresoIds.has(g.ingresoId));

  const resumenSociedad = useMemo(() => {
    const ing = ingresosLinea(null);
    const gas = gastosLinea(null);
    const ids = new Set(ing.map((i) => i.id));
    return calcularResumenFinanciero(ing, gas, gastosEventoDe(ids));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allIngresos, allGastos, allGastosEvento, year]);

  const porLinea = useMemo(() => LINEA_IDS.filter((id) => lineasVisibles.includes(id)).map((id) => {
    const ing = ingresosLinea(id);
    const gas = gastosLinea(id);
    const ids = new Set(ing.map((i) => i.id));
    return { linea: id, ...calcularResumenFinanciero(ing, gas, gastosEventoDe(ids)) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [allIngresos, allGastos, allGastosEvento, year, lineasVisibles]);

  const resumenActivo = lineaSeleccionada
    ? porLinea.find((l) => l.linea === lineaSeleccionada)!
    : resumenSociedad;

  // ── Mensual (dentro de la vista activa: sociedad o línea) ────────────────
  const mensual = useMemo(() => {
    const linea = lineaSeleccionada;
    return MESES_FULL.map((mesLabel, m) => {
      const ing = allIngresos.filter((i) => {
        const d = new Date(i.fechaEvento);
        if (d.getFullYear() !== year || d.getMonth() !== m) return false;
        return linea == null || lineaDeIngreso(i) === linea;
      });
      const gas = allGastos.filter((g) => {
        const d = new Date(g.fecha);
        if (d.getFullYear() !== year || d.getMonth() !== m) return false;
        return linea == null || lineaDeGasto(g) === linea;
      });
      const ids = new Set(ing.map((i) => i.id));
      const gasEv = allGastosEvento.filter((g) => ids.has(g.ingresoId));
      const r = calcularResumenFinanciero(ing, gas, gasEv);
      return { mes: mesLabel, ...r };
    });
  }, [allIngresos, allGastos, allGastosEvento, year, lineaSeleccionada]);

  // ── Trimestral (agregado de los 3 meses correspondientes) ─────────────────
  const trimestral = useMemo(() => TRIMESTRES.map((label, t) => {
    const meses = mensual.slice(t * 3, t * 3 + 3);
    return meses.reduce((acc, m) => ({
      trimestre: label,
      ingresosSinIVA: acc.ingresosSinIVA + m.ingresosSinIVA,
      gastosDeducibles: acc.gastosDeducibles + m.gastosDeducibles,
      beneficioAntesImpuestos: acc.beneficioAntesImpuestos + m.beneficioAntesImpuestos,
      totalCobrado: acc.totalCobrado + m.totalCobrado,
      totalPendiente: acc.totalPendiente + m.totalPendiente,
      ivaRepercutido: acc.ivaRepercutido + m.ivaRepercutido,
      ivaSoportado: acc.ivaSoportado + m.ivaSoportado,
      resultadoDespuesImpuestos: acc.resultadoDespuesImpuestos + m.resultadoDespuesImpuestos,
    }), { trimestre: label, ingresosSinIVA: 0, gastosDeducibles: 0, beneficioAntesImpuestos: 0, totalCobrado: 0, totalPendiente: 0, ivaRepercutido: 0, ivaSoportado: 0, resultadoDespuesImpuestos: 0 });
  }), [mensual]);

  const exportCSV = () => {
    const header = 'Mes;Ingresos sin IVA;Gastos deducibles;Beneficio;Cobrado;Pendiente;IVA repercutido;IVA soportado;Resultado tras impuestos';
    const rows = mensual.map((m) =>
      [m.mes, m.ingresosSinIVA.toFixed(2), m.gastosDeducibles.toFixed(2), m.beneficioAntesImpuestos.toFixed(2),
       m.totalCobrado.toFixed(2), m.totalPendiente.toFixed(2), m.ivaRepercutido.toFixed(2), m.ivaSoportado.toFixed(2),
       m.resultadoDespuesImpuestos.toFixed(2)].join(';')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const nombre = lineaSeleccionada ? BUSINESS_LINES[lineaSeleccionada].shortLabel : 'sociedad';
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `informe-contable-${nombre}-${year}.csv` });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const ivaLiquidar = ivaEstimadoALiquidar(resumenActivo.ivaRepercutido, resumenActivo.ivaSoportado);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Informe contable</h1>
          <p className="text-sm text-gray-500">
            {lineaSeleccionada ? (
              <button onClick={() => setLineaSeleccionada(null)} className="inline-flex items-center gap-1 text-gold-600 hover:text-gold-500 font-medium">
                <ChevronLeft size={13} /> Sociedad completa
              </button>
            ) : 'Sociedad completa'}
            {lineaSeleccionada && <> · {BUSINESS_LINES[lineaSeleccionada].label}</>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setYear((v) => v - 1)} className="px-2 py-1 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors">‹</button>
            <span className="text-sm font-semibold text-gray-700 w-12 text-center">{year}</span>
            <button onClick={() => setYear((v) => v + 1)} className="px-2 py-1 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors">›</button>
          </div>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white">
            {yearOpts.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <Button variant="dark" icon={<Download size={14} />} onClick={exportCSV}>Exportar CSV</Button>
        </div>
      </div>

      {/* Comparación por línea de negocio — click para entrar al detalle */}
      <div className="bg-white border border-gray-200 rounded-card shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Comparación por línea de negocio — {year}</h2>
          <p className="text-xs text-gray-500 mt-0.5">Haz clic en una línea para ver su detalle</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Línea</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Ingresos</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Gastos</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Beneficio</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Cobrado</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Pendiente</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Resultado tras imp.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {porLinea.map((l) => (
                <tr key={l.linea} onClick={() => setLineaSeleccionada(l.linea)} className={`cursor-pointer hover:bg-gray-50 transition-colors ${lineaSeleccionada === l.linea ? 'bg-gold-50/60' : ''}`}>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{BUSINESS_LINES[l.linea].label}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-700">{fmt(l.ingresosSinIVA)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-red-600">{fmt(l.gastosDeducibles)}</td>
                  <td className={`px-4 py-2.5 text-right font-mono font-semibold ${l.beneficioAntesImpuestos >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmt(l.beneficioAntesImpuestos)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-600">{fmt(l.totalCobrado)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-amber-700">{fmt(l.totalPendiente)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-700">{fmt(l.resultadoDespuesImpuestos)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
              <tr>
                <td className="px-4 py-2.5 text-xs uppercase text-gray-600">Consolidado</td>
                <td className="px-4 py-2.5 text-right font-mono text-gray-900">{fmt(resumenSociedad.ingresosSinIVA)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-red-700">{fmt(resumenSociedad.gastosDeducibles)}</td>
                <td className={`px-4 py-2.5 text-right font-mono ${resumenSociedad.beneficioAntesImpuestos >= 0 ? 'text-emerald-800' : 'text-red-700'}`}>{fmt(resumenSociedad.beneficioAntesImpuestos)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-gray-800">{fmt(resumenSociedad.totalCobrado)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-gray-800">{fmt(resumenSociedad.totalPendiente)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-gray-800">{fmt(resumenSociedad.resultadoDespuesImpuestos)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* KPIs de la vista activa (sociedad o línea seleccionada) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Ingresos sin IVA" value={resumenActivo.ingresosSinIVA} format={fmt} />
        <StatCard label="Gastos deducibles" value={resumenActivo.gastosDeducibles} format={fmt} tone="danger" />
        <StatCard label="Beneficio antes de impuestos" value={resumenActivo.beneficioAntesImpuestos} format={fmt} tone={resumenActivo.beneficioAntesImpuestos >= 0 ? 'success' : 'danger'} />
        <StatCard label="Resultado tras impuestos (aprox.)" value={resumenActivo.resultadoDespuesImpuestos} format={fmt} />
        <StatCard label="Total cobrado" value={resumenActivo.totalCobrado} format={fmt} tone="success" />
        <StatCard label="Total pendiente" value={resumenActivo.totalPendiente} format={fmt} tone="gold" />
        <StatCard label="IVA repercutido" value={resumenActivo.ivaRepercutido} format={fmt} />
        <StatCard label={ivaLiquidar >= 0 ? 'IVA estimado a pagar' : 'IVA estimado a compensar'} value={Math.abs(ivaLiquidar)} format={fmt} tone={ivaLiquidar >= 0 ? 'gold' : 'success'} />
      </div>

      {/* Comparativa trimestral */}
      <div className="bg-white border border-gray-200 rounded-card shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Comparativa trimestral — {year}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Trimestre</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Ingresos</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Gastos</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Beneficio</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Cobrado</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Pendiente</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Resultado tras imp.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {trimestral.map((t) => (
                <tr key={t.trimestre}>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{t.trimestre}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-700">{fmt(t.ingresosSinIVA)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-red-600">{fmt(t.gastosDeducibles)}</td>
                  <td className={`px-4 py-2.5 text-right font-mono font-semibold ${t.beneficioAntesImpuestos >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmt(t.beneficioAntesImpuestos)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-600">{fmt(t.totalCobrado)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-amber-700">{fmt(t.totalPendiente)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-700">{fmt(t.resultadoDespuesImpuestos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabla mensual */}
      <div className="bg-white border border-gray-200 rounded-card shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Detalle mensual — {year}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Mes</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ingresos</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Gastos</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Beneficio</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cobrado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Pendiente</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">IVA rep.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Resultado tras imp.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mensual.map((m) => (
                <tr key={m.mes} className={`hover:bg-gray-50 ${m.numIngresos === 0 ? 'opacity-40' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-800">{m.mes}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{fmt(m.ingresosSinIVA)}</td>
                  <td className="px-4 py-3 text-right font-mono text-red-600">{fmt(m.gastosDeducibles)}</td>
                  <td className={`px-4 py-3 text-right font-mono font-semibold ${m.beneficioAntesImpuestos >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmt(m.beneficioAntesImpuestos)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600">{fmt(m.totalCobrado)}</td>
                  <td className="px-4 py-3 text-right font-mono text-amber-700">{fmt(m.totalPendiente)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600">{fmt(m.ivaRepercutido)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{fmt(m.resultadoDespuesImpuestos)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
              <tr>
                <td className="px-4 py-3 text-xs uppercase text-gray-600">Total {year}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-900">{fmt(resumenActivo.ingresosSinIVA)}</td>
                <td className="px-4 py-3 text-right font-mono text-red-700">{fmt(resumenActivo.gastosDeducibles)}</td>
                <td className={`px-4 py-3 text-right font-mono ${resumenActivo.beneficioAntesImpuestos >= 0 ? 'text-emerald-800' : 'text-red-700'}`}>{fmt(resumenActivo.beneficioAntesImpuestos)}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-800">{fmt(resumenActivo.totalCobrado)}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-800">{fmt(resumenActivo.totalPendiente)}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-800">{fmt(resumenActivo.ivaRepercutido)}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-800">{fmt(resumenActivo.resultadoDespuesImpuestos)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 px-1">Resultado tras impuestos: estimación orientativa (25% de Impuesto de Sociedades sobre el beneficio) — a validar con la gestoría.</p>
    </div>
  );
};
