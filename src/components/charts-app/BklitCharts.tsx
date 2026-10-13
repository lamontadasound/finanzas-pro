import {useExpenseCategories,categoryColor} from '../../lib/expenseCategoryConfig';
// ── Adaptación propia sobre componentes oficiales de Bklit ──────────────────
// Todo lo importado de "../charts/*" y "../../lib/profit-loss-segments" es
// código oficial del registro https://ui.bklit.com, instalado tal cual con
// `npx shadcn add @bklit/area-chart|ring-chart|bar-chart|profit-loss-line`
// (ver components.json). Las únicas correcciones hechas a ese código son 2
// rutas de import rotas en los ficheros publicados — documentadas inline en
// `charts/chart-loading-label.tsx` y `charts/profit-loss-line.tsx`.
//
// Este fichero SÍ es propio: son wrappers finos que traducen los datos ya
// calculados de Finanzas (fmtShort, meses en español, paleta de marca) a la
// API de composición de Bklit (<AreaChart><Area/><Grid/><XAxis/>...),
// evitando repetir esa composición en cada página. No reimplementan ningún
// gráfico — delegan el renderizado real a los componentes de Bklit.
import { AreaChart } from '../charts/area-chart';
import { Area } from '../charts/area';
import { BarChart } from '../charts/bar-chart';
import { Bar } from '../charts/bar';
import { RingChart } from '../charts/ring-chart';
import { Ring } from '../charts/ring';
import { RingCenter } from '../charts/ring-center';
import { ProfitLossLine } from '../charts/profit-loss-line';
import { Grid } from '../charts/grid';
import { XAxis } from '../charts/x-axis';
import { ChartTooltip } from '../charts/tooltip';
import type { RingData } from '../charts/ring-context';
import { Gauge } from '../charts/gauge';
import { ContentCard2 } from '../ui2/ContentCard';

import { CHART_PALETTE } from '../ui2/chartPalette';
const DEFAULT_BAR_COLOR = CHART_PALETTE[0];

interface MonthPoint { date: Date; [key: string]: unknown }

interface BklitAreaCardProps {
  title: string;
  description?: string;
  data: MonthPoint[];
  series: { key: string; color: string }[];
  status?: 'loading' | 'ready';
}

/** Area Chart real de Bklit — evolución mensual (ingresos/gastos/beneficio). */
export const BklitAreaCard = ({ title, description, data, series, status = 'ready' }: BklitAreaCardProps) => (
  <ContentCard2 title={title} description={description} padding="none">
    <div className="px-4 pb-4">
      <AreaChart data={data} xDataKey="date" status={status} loadingLabel="Cargando…" aspectRatio="2.4 / 1">
        <Grid horizontal strokeDasharray="3 5" />
        {series.map((s) => (
          <Area key={s.key} dataKey={s.key} stroke={s.color} fill={s.color} fillOpacity={0.18} />
        ))}
        <XAxis tickMode="data" numTicks={6} />
        <ChartTooltip showDatePill={false} panelStyle={{minWidth:200}} />
      </AreaChart>
    </div>
  </ContentCard2>
);

interface BklitProfitLossCardProps {
  title: string;
  description?: string;
  data: MonthPoint[];
  dataKey: string;
}

/** Profit/Loss Line real de Bklit — verde cuando el mes es positivo, rojo cuando es negativo. */
export const BklitProfitLossCard = ({ title, description, data, dataKey }: BklitProfitLossCardProps) => (
  <ContentCard2 title={title} description={description} padding="none">
    <div className="px-4 pb-4">
      <AreaChart data={data} xDataKey="date" aspectRatio="2.4 / 1">
        <Grid horizontal strokeDasharray="3 5" highlightRowValues={[0]} />
        <ProfitLossLine dataKey={dataKey} />
        <XAxis tickMode="data" numTicks={6} />
        <ChartTooltip showDatePill={false} panelStyle={{minWidth:200}} />
      </AreaChart>
    </div>
  </ContentCard2>
);

interface BklitRingCardProps {
  title: string;
  description?: string;
  data: RingData[];
  centerLabel: string;
  centerValue: string;
}

/** Ring Chart real de Bklit — cobrado frente a pendiente (o cualquier par de estados). */
export const BklitRingCard = ({ title, description, data, centerLabel, centerValue }: BklitRingCardProps) => (
  <ContentCard2 title={title} description={description}>
    <div className="flex flex-wrap items-center gap-6">
      <div className="w-36 h-36 flex-shrink-0">
        <RingChart data={data} baseInnerRadius={44} strokeWidth={11} ringGap={5}>
          {data.map((_, i) => <Ring key={i} index={i} />)}
          <RingCenter defaultLabel={centerLabel} valueClassName="text-lg font-bold text-gray-900" labelClassName="text-[10px] text-gray-400">
            {() => (
              <>
                <p className="text-lg font-bold text-gray-900">{centerValue}</p>
                <p className="text-[10px] text-gray-400">{centerLabel}</p>
              </>
            )}
          </RingCenter>
        </RingChart>
      </div>
      <div className="flex-1 space-y-2.5 min-w-0">
        {data.map((d) => (
          <div key={d.label} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-gray-600 truncate">{d.label}</span>
            </span>
            <span className="font-semibold text-gray-900 flex-shrink-0">{Math.round((d.value / d.maxValue) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  </ContentCard2>
);

interface BklitBarCardProps {
  title: string;
  description?: string;
  data: Record<string, unknown>[];
  xDataKey: string;
  dataKey: string;
  color?: string;
}

/**
 * Bar Chart real de Bklit — gastos por categoría.
 * Nota de adaptación: `<XAxis>` está pensado para la escala temporal de
 * AreaChart (fechas). Al componerlo dentro de `<BarChart>` (escala de banda
 * categórica) el "fake time scale" que expone BarChart para compatibilidad
 * pierde su condición de función al construirse con spread (`{...scale}`),
 * y XAxis revienta con "xScale is not a function". Es un problema de esa
 * combinación de piezas oficiales, no del componente Bar en sí — así que
 * aquí se usa BarChart+Bar+Grid+ChartTooltip (100% Bklit) y las etiquetas de
 * categoría se pintan aparte, a mano, en vez de con <XAxis>.
 */
export const BklitBarCard = ({ title, description, data, xDataKey, dataKey, color }: BklitBarCardProps) => {
 const {categories}=useExpenseCategories();
 const colors=data.map(d=>color??categoryColor(String(d[xDataKey]),categories));
 return <ContentCard2 title={title} description={description} padding="none">
    <div className="px-4 pb-2" aria-hidden="true">
      <BarChart data={data} xDataKey={xDataKey} aspectRatio="2.4 / 1" barGap={0.3}>
        <Grid horizontal strokeDasharray="3 5" />
        <Bar dataKey={dataKey} fill={color ?? DEFAULT_BAR_COLOR} categoryColors={colors} />
      </BarChart>
    </div>
    <ul className="expense-chart-legend">
      {data.map((d, i) => <li key={String(d[xDataKey])}>
        <span className="expense-category-dot" style={{backgroundColor:colors[i]}} aria-hidden="true"/>
        <span>{String(d[xDataKey])}</span><strong>{Number(d[dataKey]??0).toLocaleString('es-ES',{style:'currency',currency:'EUR',useGrouping:'always'} as Intl.NumberFormatOptions)}</strong>
      </li>)}
    </ul>
  </ContentCard2>;
};

// ── Gauge ────────────────────────────────────────────────────────────────
interface BklitGaugeCardProps {
  title?: string;
  /** Ingresos operativos (sin IVA) del periodo — si es 0, se muestra "Sin
   *  datos" en vez de un porcentaje engañoso. */
  ingresosOperativos: number;
  /** Margen ya calculado como fracción (beneficio / ingresos), NO en %. */
  margen: number;
}

const gaugeTone = (marginPct: number) => {
  if (marginPct < 0) return { active: '#ef4444', track: '#fee2e2' };       // rojo: pérdidas
  if (marginPct < 15) return { active: '#b7791f', track: '#fef3c7' };      // ámbar: margen medio-bajo
  return { active: '#15803d', track: '#dcfce7' };                          // verde: margen alto
};

/**
 * Gauge real de Bklit — margen operativo = beneficio operativo / ingresos
 * sin IVA × 100. El relleno visual se acota a 0–100 (así un 340% de margen
 * no desborda el arco), pero el texto central siempre muestra el valor real,
 * incluida cualquier cifra por encima de 100% o negativa.
 */
export const BklitGaugeCard = ({ title = 'Margen operativo', ingresosOperativos, margen }: BklitGaugeCardProps) => {
  if (ingresosOperativos <= 0) {
    return (
      <ContentCard2 title={title} description="Beneficio sobre ingresos sin IVA">
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <p className="text-2xl font-bold text-gray-300">Sin datos</p>
          <p className="text-xs text-gray-400 mt-1">No hay ingresos en este periodo para calcular un margen.</p>
        </div>
      </ContentCard2>
    );
  }
  const marginPct = margen * 100;
  const visualValue = Math.max(0, Math.min(100, marginPct));
  const tone = gaugeTone(marginPct);
  return (
    <ContentCard2 title={title} description="Beneficio sobre ingresos sin IVA">
      <div className="flex flex-col items-center">
        <div className="w-full max-w-[280px]" aria-hidden="true">
          <Gauge
            value={visualValue}
            activeFill={tone.active}
            inactiveFill={tone.track}
            totalNotches={40}
          />
        </div>
        <p className="gauge-value" aria-label={`Margen operativo: ${marginPct.toLocaleString('es-ES', {maximumFractionDigits:1})}%`}>{marginPct.toLocaleString('es-ES', {maximumFractionDigits:1})}%</p>
        <p className="gauge-caption">Margen operativo</p>
      </div>
    </ContentCard2>
  );
};

// El Heatmap ya NO se implementa aquí con el componente oficial de Bklit —
// ver `ActivityHeatmap.tsx` (implementación propia, misma fuente de datos y
// mismo sistema visual) y su cabecera para la causa raíz confirmada.
