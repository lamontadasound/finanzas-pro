import { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Percent } from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { Area } from '../../types';
import { StatCard } from '../../components/ui/StatCard';
import { MotionTabs } from '../../components/ui/MotionTabs';

const fmt = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const pctFmt = (n: number) => `${n.toFixed(1)}%`;

type Rango = 'mes' | 'trimestre' | 'año';
const MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

interface Props { area: Area }

export const BeneficioPage = ({ area }: Props) => {
  const allIngresos     = useStore((s) => s.ingresos);
  const allGastos       = useStore((s) => s.gastos);
  const allGastosEvento = useStore((s) => s.gastosEvento);
  const ingresos     = useMemo(() => allIngresos.filter((i) => i.area === area), [allIngresos, area]);
  const gastos       = useMemo(() => allGastos.filter((g) => g.area === area), [allGastos, area]);
  const gastosEvento = useMemo(() => allGastosEvento.filter((g) => g.area === area), [allGastosEvento, area]);

  const [rango, setRango] = useState<Rango>('año');
  const [year, setYear] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth());
  const [trimestre, setTrimestre] = useState(Math.floor(new Date().getMonth() / 3));

  const inRange = (fecha: string) => {
    const d = new Date(fecha);
    if (rango === 'mes') return d.getFullYear() === year && d.getMonth() === mes;
    if (rango === 'trimestre') return d.getFullYear() === year && Math.floor(d.getMonth() / 3) === trimestre;
    return d.getFullYear() === year;
  };

  const ingFiltrados = ingresos.filter((i) => inRange(i.fechaEvento));
  const gasFiltrados = gastos.filter((g) => inRange(g.fecha));
  const gasEvFiltrados = gastosEvento.filter((g) => inRange(g.fecha));

  const ingresosTotales = ingFiltrados.reduce((a, i) => a + i.total, 0);
  const baseIngresos    = ingFiltrados.reduce((a, i) => a + i.baseImponible, 0);
  const gastosGenerales = gasFiltrados.reduce((a, g) => a + g.total, 0);
  const gastosDeEventos = gasEvFiltrados.reduce((a, g) => a + g.importe, 0);
  const gastosTotales   = gastosGenerales + gastosDeEventos;
  const baseGastos      = gasFiltrados.reduce((a, g) => a + g.baseImponible, 0);

  const beneficio = baseIngresos - (baseGastos + gastosDeEventos);
  const margen    = baseIngresos > 0 ? (beneficio / baseIngresos) * 100 : 0;

  const label = area === 'montada' ? 'La Montada Sound' : 'DJs';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{label} — Beneficio</h1>
          <p className="text-sm text-gray-500">Ingresos − gastos, sin IVA</p>
        </div>
        <MotionTabs
          layoutId="beneficio-rango"
          value={rango}
          onChange={setRango}
          items={[
            { value: 'mes', label: 'Mes' },
            { value: 'trimestre', label: 'Trimestre' },
            { value: 'año', label: 'Año' },
          ]}
        />
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <button onClick={() => setYear((v) => v - 1)} className="px-2 py-1 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors">‹</button>
          <span className="text-sm font-semibold text-gray-700 w-12 text-center">{year}</span>
          <button onClick={() => setYear((v) => v + 1)} className="px-2 py-1 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors">›</button>
        </div>
        {rango === 'mes' && (
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white">
            {MESES_FULL.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
        )}
        {rango === 'trimestre' && (
          <select value={trimestre} onChange={(e) => setTrimestre(Number(e.target.value))} className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white">
            <option value={0}>Q1 (Ene–Mar)</option>
            <option value={1}>Q2 (Abr–Jun)</option>
            <option value={2}>Q3 (Jul–Sep)</option>
            <option value={3}>Q4 (Oct–Dic)</option>
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Ingresos totales" value={ingresosTotales} format={fmt} sub={`Base: ${fmt(baseIngresos)}`} tone="success" icon={<TrendingUp size={15} />} />
        <StatCard label="Gastos generales" value={gastosGenerales} format={fmt} tone="danger" icon={<TrendingDown size={15} />} />
        <StatCard label="Gastos de eventos" value={gastosDeEventos} format={fmt} tone="warning" icon={<TrendingDown size={15} />} />
        <StatCard label="Gastos totales" value={gastosTotales} format={fmt} tone="danger" icon={<TrendingDown size={15} />} />
        <StatCard label="Beneficio" value={beneficio} format={fmt} sub="Ingresos sin IVA − gastos sin IVA" tone={beneficio >= 0 ? 'gold' : 'danger'} icon={<DollarSign size={15} />} />
        <StatCard label="Margen de beneficio" value={margen} format={pctFmt} sub="Beneficio ÷ ingresos × 100" tone={margen >= 0 ? 'success' : 'danger'} icon={<Percent size={15} />} />
      </div>
    </div>
  );
};
