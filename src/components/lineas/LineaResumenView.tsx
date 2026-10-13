import type { ReactNode } from 'react';
import { StatCard2 } from '../ui2/StatCard';
import { BklitAreaCard, BklitRingCard } from '../charts-app/BklitCharts';

// ── Vista de Resumen reutilizable por línea de negocio ──────────────────────
// Usada por DJ y Real Madrid (La Montada Sound mantiene su propia página ya
// aprobada en la Fase C, sin tocar). Recibe las métricas ya calculadas
// (normalmente con `useLineaFinance`) y los datasets de gráfico ya
// preparados — no conoce de dónde vienen los datos, solo los pinta.
export interface StatCardSpec {
  label: string;
  value: number;
  format?: (n: number) => string;
  icon: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'gold';
  sub?: string;
}

interface Props {
  title: string;
  year: number;
  allYears: number[];
  onYearChange: (y: number) => void;
  stats: StatCardSpec[];
  areaChartData: { date: Date; [key: string]: unknown }[];
  areaSeries: { key: string; color: string }[];
  ringData: { label: string; value: number; maxValue: number; color: string }[];
  ringCenterLabel: string;
  ringCenterValue: string;
  children?: ReactNode;
}

export const LineaResumenView = ({
  title, year, allYears, onYearChange, stats,
  areaChartData, areaSeries, ringData, ringCenterLabel, ringCenterValue, children,
}: Props) => (
  <div className="space-y-5">
    <div className="flex items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
        
      </div>
      <select value={year} onChange={(e) => onYearChange(Number(e.target.value))} className="border border-gray-200 text-gray-700 text-sm rounded-full px-4 py-2 outline-none bg-white">
        {allYears.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((s) => <StatCard2 key={s.label} {...s} />)}
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2">
        <BklitAreaCard
          title={`Evolución mensual ${year}`}
          description="Total sin IVA — ingresos y gastos"
          data={areaChartData}
          series={areaSeries}
        />
      </div>
      <BklitRingCard
        title="Cobrado / pendiente"
        description={`Año ${year}`}
        data={ringData}
        centerLabel={ringCenterLabel}
        centerValue={ringCenterValue}
      />
    </div>

    {children}
  </div>
);
