import { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Clock, Receipt } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { fmtShort, getAvailableYears } from '../../utils/helpers';
import { resolveLinea } from '../../config/resolveLinea';
import { useLineaFinance } from '../../hooks/useLineaFinance';
import { LineaResumenView } from '../../components/lineas/LineaResumenView';
import type { StatCardSpec } from '../../components/lineas/LineaResumenView';

// Resumen de la línea "DJ" — reutiliza useLineaFinance + LineaResumenView
// (mismos componentes que Real Madrid). area='dj' + resolveLinea==='dj'
// excluye explícitamente los partidos de Real Madrid, que comparten la
// misma tabla hoy.
export const DjResumen = () => {
  const allIngresos = useStore((s) => s.ingresos);
  const allGastos = useStore((s) => s.gastos);
  const allGastosEvento = useStore((s) => s.gastosEvento);

  const djIngresosTotal = useMemo(
    () => allIngresos.filter((i) => i.area === 'dj' && resolveLinea({ id: i.id, area: i.area, tipoEvento: i.tipoEvento, lineaNegocio: i.lineaNegocio }) === 'dj'),
    [allIngresos],
  );
  const djGastosTotal = useMemo(() => allGastos.filter((g) => g.area === 'dj' && resolveLinea(g) === 'dj'), [allGastos]);

  const allYears = useMemo(() => getAvailableYears([...djIngresosTotal, ...djGastosTotal]), [djIngresosTotal, djGastosTotal]);
  const [year, setYear] = useState(allYears[0] ?? new Date().getFullYear());

  const ingresosAnio = useMemo(() => djIngresosTotal.filter((i) => new Date(i.fechaEvento).getFullYear() === year), [djIngresosTotal, year]);
  const gastosAnio = useMemo(() => djGastosTotal.filter((g) => new Date(g.fecha).getFullYear() === year), [djGastosTotal, year]);
  const ingresoIds = useMemo(() => new Set(ingresosAnio.map((i) => i.id)), [ingresosAnio]);
  const gastosEventoAnio = useMemo(() => allGastosEvento.filter((g) => g.area === 'dj' && ingresoIds.has(g.ingresoId)), [allGastosEvento, ingresoIds]);

  const calc = useLineaFinance(ingresosAnio, gastosAnio, gastosEventoAnio);

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
    { label: 'IVA repercutido', value: calc.ivaRepercutido, format: fmtShort, icon: <Receipt size={15} /> },
    { label: 'Actuaciones del año', value: calc.numEventos, format: String, icon: <TrendingUp size={15} /> },
    { label: 'Gastos de actuación', value: calc.gastosActuacion, format: fmtShort, icon: <TrendingDown size={15} /> },
    { label: 'Margen', value: Math.round(calc.margen * 100), format: (n) => `${n}%`, icon: <DollarSign size={15} />, tone: calc.beneficioOperativo >= 0 ? 'success' : 'danger' },
  ];

  const ringData = [
    { label: 'Cobrado', value: calc.cobrado, maxValue: calc.cobrado + calc.pendiente || 1, color: '#15803d' },
    { label: 'Pendiente', value: calc.pendiente, maxValue: calc.cobrado + calc.pendiente || 1, color: '#dc2626' },
  ];

  return (
    <LineaResumenView
      title="DJ"
      year={year}
      allYears={allYears}
      onYearChange={setYear}
      stats={stats}
      areaChartData={monthlyData}
      areaSeries={[{ key: 'Ingresos', color: '#3b82f6' }, { key: 'Gastos', color: '#f87171' }]}
      ringData={ringData}
      ringCenterLabel="pendiente"
      ringCenterValue={fmtShort(calc.pendiente)}
    />
  );
};
