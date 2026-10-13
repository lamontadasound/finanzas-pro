import { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Clock, Receipt } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { fmtShort, fmtInt, buildMonthlyTable, getAvailableYears } from '../../utils/helpers';
import { StatCard2 } from '../../components/ui2/StatCard';
import { BklitAreaCard, BklitRingCard } from '../../components/charts-app/BklitCharts';

// Resumen de la línea "La Montada Sound" — Fase C. Reutiliza exactamente los
// mismos cálculos que el Dashboard global (buildMonthlyTable, IVA, beneficio
// real por eventos), filtrados a area='montada'.
export const MontadaSoundResumen = () => {
  const allIngresos = useStore((s) => s.ingresos);
  const allGastos = useStore((s) => s.gastos);
  const allGastosEvento = useStore((s) => s.gastosEvento);
  const ingresos = useMemo(() => allIngresos.filter((i) => i.area === 'montada'), [allIngresos]);
  const gastos = useMemo(() => allGastos.filter((g) => g.area === 'montada'), [allGastos]);
  const gastosEvento = useMemo(() => allGastosEvento.filter((g) => g.area === 'montada'), [allGastosEvento]);

  const allYears = useMemo(() => getAvailableYears([...ingresos, ...gastos]), [ingresos, gastos]);
  const [year, setYear] = useState(allYears[0] ?? new Date().getFullYear());

  const ingresosAnio = useMemo(() => ingresos.filter((i) => new Date(i.fechaEvento).getFullYear() === year), [ingresos, year]);
  const gastosAnio = useMemo(() => gastos.filter((g) => new Date(g.fecha).getFullYear() === year), [gastos, year]);

  const totalIngresos = ingresosAnio.reduce((s, i) => s + i.baseImponible, 0);
  const totalGastos = gastosAnio.reduce((s, g) => s + g.baseImponible, 0);
  const ingresoIds = new Set(ingresosAnio.map((i) => i.id));
  const costesEvento = gastosEvento.filter((g) => ingresoIds.has(g.ingresoId)).reduce((s, g) => s + g.importe, 0);
  const beneficioOperativo = totalIngresos - totalGastos - costesEvento;
  const ivaRep = ingresosAnio.reduce((s, i) => s + i.importeIVA, 0);
  const pendienteCobro = ingresosAnio.reduce((s, i) => s + (i.estadoPago === 'pagado' ? 0 : Math.max(0, i.total - i.pagosRecibidos)), 0);
  const cobrado = ingresosAnio.reduce((s, i) => s + (i.estadoPago === 'pagado' ? i.total : i.pagosRecibidos), 0);

  const monthlyData = useMemo(() => buildMonthlyTable(ingresos, gastos, year), [ingresos, gastos, year]);
  const areaChartData = monthlyData.map((row) => ({ date: new Date(year, row.num - 1, 1), Ingresos: row.ing, Gastos: row.gTotal }));

  const cobradoVsPendiente = useMemo(() => {
    const total = cobrado + pendienteCobro || 1;
    return [
      { label: 'Cobrado', value: cobrado, maxValue: total, color: '#15803d' },
      { label: 'Pendiente', value: pendienteCobro, maxValue: total, color: '#dc2626' },
    ];
  }, [cobrado, pendienteCobro]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">La Montada Sound</h1>
          
        </div>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="border border-gray-200 text-gray-700 text-sm rounded-full px-4 py-2 outline-none bg-white">
          {allYears.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard2 label="Ingresos (s/IVA)" value={totalIngresos} format={fmtShort} icon={<TrendingUp size={15} />} tone="success" />
        <StatCard2 label="Gastos (s/IVA)" value={totalGastos + costesEvento} format={fmtShort} icon={<TrendingDown size={15} />} tone="danger" />
        <StatCard2 label="Beneficio operativo" value={beneficioOperativo} format={fmtShort} icon={<DollarSign size={15} />} tone={beneficioOperativo >= 0 ? 'gold' : 'danger'} />
        <StatCard2 label="Pendiente de cobro" value={pendienteCobro} format={fmtShort} sub={`Cobrado: ${fmtShort(cobrado)}`} icon={<Clock size={15} />} tone={pendienteCobro > 0 ? 'warning' : 'success'} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard2 label="IVA repercutido" value={ivaRep} format={fmtShort} icon={<Receipt size={15} />} />
        <StatCard2 label="Eventos del año" value={ingresosAnio.length} format={fmtInt} icon={<TrendingUp size={15} />} />
        <StatCard2 label="Coste de eventos" value={costesEvento} format={fmtShort} icon={<TrendingDown size={15} />} />
        <StatCard2 label="Margen" value={totalIngresos > 0 ? Math.round((beneficioOperativo / totalIngresos) * 100) : 0} format={(n) => `${n}%`} icon={<DollarSign size={15} />} tone={beneficioOperativo >= 0 ? 'success' : 'danger'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <BklitAreaCard
            title={`Evolución mensual ${year}`}
            description="Total sin IVA — ingresos y gastos"
            data={areaChartData}
            series={[
              { key: 'Ingresos', color: '#4f46e5' },
              { key: 'Gastos', color: '#f87171' },
            ]}
          />
        </div>
        <BklitRingCard
          title="Cobrado / pendiente"
          description={`Año ${year}`}
          data={cobradoVsPendiente}
          centerLabel="pendiente"
          centerValue={fmtShort(pendienteCobro)}
        />
      </div>
    </div>
  );
};
