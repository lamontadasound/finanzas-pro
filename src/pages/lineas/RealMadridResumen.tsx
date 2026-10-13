import { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Clock, Receipt, Package } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { fmtShort, getAvailableYears } from '../../utils/helpers';
import { resolveLinea, isAmbiguousRealMadrid } from '../../config/resolveLinea';
import { useLineaFinance } from '../../hooks/useLineaFinance';
import { LineaResumenView } from '../../components/lineas/LineaResumenView';
import type { StatCardSpec } from '../../components/lineas/LineaResumenView';
import { ContentCard2 } from '../../components/ui2/ContentCard';
import { AlertTriangle } from 'lucide-react';

// Resumen de la línea "Real Madrid" — misma arquitectura reutilizable que
// DJ (useLineaFinance + LineaResumenView), añadiendo Inversiones y Flujo de
// caja después de inversiones (equipo.area='real_madrid', ya separado a
// nivel de columna desde antes de esta fase).
export const RealMadridResumen = () => {
  const allIngresos = useStore((s) => s.ingresos);
  const allGastos = useStore((s) => s.gastos);
  const allGastosEvento = useStore((s) => s.gastosEvento);
  const allEquipo = useStore((s) => s.equipo);

  const rmIngresosTotal = useMemo(
    () => allIngresos.filter((i) => resolveLinea({ id: i.id, area: i.area, tipoEvento: i.tipoEvento, lineaNegocio: i.lineaNegocio }) === 'real_madrid'),
    [allIngresos],
  );
  const rmGastosTotal = useMemo(() => allGastos.filter((g) => g.area === 'dj' && resolveLinea(g) === 'real_madrid'), [allGastos]);
  const rmEquipoTotal = useMemo(() => allEquipo.filter((e) => e.area === 'real_madrid'), [allEquipo]);
  const ambiguos = useMemo(() => allIngresos.filter((i) => isAmbiguousRealMadrid(i)), [allIngresos]);

  const allYears = useMemo(() => getAvailableYears([...rmIngresosTotal, ...rmGastosTotal]), [rmIngresosTotal, rmGastosTotal]);
  const [year, setYear] = useState(allYears[0] ?? new Date().getFullYear());

  const ingresosAnio = useMemo(() => rmIngresosTotal.filter((i) => new Date(i.fechaEvento).getFullYear() === year), [rmIngresosTotal, year]);
  const gastosAnio = useMemo(() => rmGastosTotal.filter((g) => new Date(g.fecha).getFullYear() === year), [rmGastosTotal, year]);
  const ingresoIds = useMemo(() => new Set(ingresosAnio.map((i) => i.id)), [ingresosAnio]);
  const gastosEventoAnio = useMemo(() => allGastosEvento.filter((g) => ingresoIds.has(g.ingresoId)), [allGastosEvento, ingresoIds]);
  const equipoAnio = useMemo(() => rmEquipoTotal.filter((e) => new Date(e.fechaCompra).getFullYear() === year), [rmEquipoTotal, year]);

  const calc = useLineaFinance(ingresosAnio, gastosAnio, gastosEventoAnio, equipoAnio);

  const monthlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => {
      const ingMes = ingresosAnio.filter((i) => new Date(i.fechaEvento).getMonth() === m);
      const idsMes = new Set(ingMes.map((i) => i.id));
      const gastosEvMes = gastosEventoAnio.filter((g) => idsMes.has(g.ingresoId)).reduce((s, g) => s + g.importe, 0);
      const gastosGenMes = gastosAnio.filter((g) => new Date(g.fecha).getMonth() === m).reduce((s, g) => s + g.baseImponible, 0);
      const ing = ingMes.reduce((s, i) => s + i.baseImponible, 0);
      return {
        date: new Date(year, m, 1),
        Ingresos: ing,
        Gastos: gastosEvMes + gastosGenMes,
        Beneficio: ing - gastosEvMes - gastosGenMes,
      };
    });
  }, [ingresosAnio, gastosEventoAnio, gastosAnio, year]);

  const stats: StatCardSpec[] = [
    { label: 'Ingresos (s/IVA)', value: calc.ingresosOperativos, format: fmtShort, icon: <TrendingUp size={15} />, tone: 'success' },
    { label: 'Gastos (s/IVA)', value: calc.gastosOperativos, format: fmtShort, icon: <TrendingDown size={15} />, tone: 'danger' },
    { label: 'Beneficio operativo', value: calc.beneficioOperativo, format: fmtShort, icon: <DollarSign size={15} />, tone: calc.beneficioOperativo >= 0 ? 'gold' : 'danger' },
    { label: 'Pendiente de cobro', value: calc.pendiente, format: fmtShort, sub: `Cobrado: ${fmtShort(calc.cobrado)}`, icon: <Clock size={15} />, tone: calc.pendiente > 0 ? 'warning' : 'success' },
    { label: 'Inversión del año', value: calc.inversiones, format: fmtShort, icon: <Package size={15} /> },
    { label: 'Flujo tras inversión', value: calc.flujoCajaTrasInversiones, format: fmtShort, icon: <DollarSign size={15} />, tone: calc.flujoCajaTrasInversiones >= 0 ? 'success' : 'danger' },
    { label: 'IVA repercutido', value: calc.ivaRepercutido, format: fmtShort, icon: <Receipt size={15} /> },
    { label: 'Partidos/servicios', value: calc.numEventos, format: String, icon: <TrendingUp size={15} /> },
  ];

  const ringData = [
    { label: 'Cobrado', value: calc.cobrado, maxValue: calc.cobrado + calc.pendiente || 1, color: '#15803d' },
    { label: 'Pendiente', value: calc.pendiente, maxValue: calc.cobrado + calc.pendiente || 1, color: '#dc2626' },
  ];

  return (
    <LineaResumenView
      title="Real Madrid"
      year={year}
      allYears={allYears}
      onYearChange={setYear}
      stats={stats}
      areaChartData={monthlyData}
      areaSeries={[{ key: 'Ingresos', color: '#6d28d9' }, { key: 'Gastos', color: '#f87171' }]}
      ringData={ringData}
      ringCenterLabel="pendiente"
      ringCenterValue={fmtShort(calc.pendiente)}
    >
      {ambiguos.length > 0 && (
        <ContentCard2 title="Casos a revisar" description="Cliente contiene 'Real Madrid' pero el tipo de evento no lo confirma — no se han reclasificado automáticamente">
          <div className="flex items-start gap-3 mb-3 text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-2xl p-3">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <p>Revisa estos registros y confírmame si pertenecen a Real Madrid.</p>
          </div>
          <ul className="divide-y divide-gray-50">
            {ambiguos.map((i) => (
              <li key={i.id} className="py-2 text-sm text-gray-600">{i.concepto} · {i.cliente} · {i.fechaEvento} <span className="text-gray-400">(tipo: {i.tipoEvento})</span></li>
            ))}
          </ul>
        </ContentCard2>
      )}
    </LineaResumenView>
  );
};
