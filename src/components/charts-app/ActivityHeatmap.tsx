// ── Adaptación propia — NO es un componente oficial de Bklit ────────────────
// El Heatmap oficial del registro de Bklit (`@bklit/heatmap-chart`, ver
// `charts/heatmap/`) depende internamente de `<ParentSize>` de
// `@visx/responsive`, cuyo hook `useParentSize()` envuelve su actualización
// de estado en `lodash.debounce` creado una sola vez vía `useMemo` y
// reutilizado a través del ciclo de montaje→desmontaje→remontaje que React
// 18 Strict Mode ejecuta en desarrollo para los efectos. Una notificación
// prematura del primer `ResizeObserver` (el que se desmonta enseguida) puede
// consumir el flanco "leading" del debounce con un tamaño 0×0, y el segundo
// `ResizeObserver` (el que sobrevive) no siempre fuerza una notificación
// correctora — el estado interno de `ParentSize` se queda anclado en su
// valor por defecto `{width:0, height:0}`, que es exactamente la condición
// `chartWidth < 10 || height < 10` que hace que `HeatmapChart` devuelva
// `null` sin ningún error en consola. Se confirmó leyendo el código fuente
// instalado en `node_modules/@visx/responsive/esm/hooks/useParentSize.js` y
// reproduciendo el fallo de forma intermitente en entornos con Strict Mode.
//
// Para no depender de esa cadena (`ParentSize` → `ResizeObserver` →
// `lodash.debounce`), este componente se implementa con CSS Grid puro: cada
// celda tiene un tamaño fijo en píxeles, así que el grid nunca necesita
// medir su contenedor — no hay ninguna carrera de montaje posible por
// construcción. Reutiliza el mismo sistema visual (paleta por línea de
// negocio, radios, tipografía) y la misma fuente de datos real
// (`buildHeatmapColumns`, ya usada — y verificada — con el Heatmap de
// Bklit). Respeta `prefers-reduced-motion` a través del
// `<MotionConfig reducedMotion="user">` global de `App.tsx`.
import { useMemo, useState, useId } from 'react';
import { motion } from 'framer-motion';
import { DatePeriodSelector } from '../ui2/DatePeriodSelector';
import { ContentCard2 } from '../ui2/ContentCard';
import { buildHeatmapColumns, relativeLevel } from './heatmapUtils';
import type { HeatmapColumn } from './heatmapUtils';

const CELL_SIZE = 11;
const CELL_GAP = 3;
const MESES_ABR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DIAS_ABR = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

const fmtEUR = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const fmtFecha = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

interface TooltipState {
  x: number;
  y: number;
  date: Date;
  count: number;
  revenue: number;
}

interface ActivityHeatmapProps {
  title?: string;
  year: number;
  /** Nº de eventos/actuaciones/partidos/instalaciones por día ("YYYY-MM-DD" → nº). */
  dailyCount: Map<string, number>;
  /** Facturación (con IVA) por día ("YYYY-MM-DD" → €). */
  dailyRevenue: Map<string, number>;
  /** Paleta de 5 niveles (claro→oscuro) coherente con la línea de negocio. */
  levelColors: readonly [string, string, string, string, string];
}

const dateKey = (d: Date) => d.toISOString().slice(0, 10);

export const ActivityHeatmap = ({ title = 'Actividad diaria', year, dailyCount, dailyRevenue, levelColors }: ActivityHeatmapProps) => {
  const [mode, setMode] = useState<'actividad' | 'facturacion'>('actividad');
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const gradientId = useId();
  const hasData = dailyCount.size > 0;

  const columns: HeatmapColumn[] = useMemo(
    () => buildHeatmapColumns(year, mode === 'actividad' ? dailyCount : dailyRevenue),
    [year, mode, dailyCount, dailyRevenue],
  );

  // Nivel relativo al máximo del año en el modo actual — ver `relativeLevel`
  // en heatmapUtils.ts (necesario para que "Facturación", en euros, no
  // colapse todo a un único nivel con los umbrales fijos de recuento).
  const maxValue = useMemo(
    () => columns.reduce((m, c) => c.bins.reduce((m2, b) => Math.max(m2, b.count), m), 0),
    [columns],
  );

  // Etiquetas de mes — una por columna que contiene el día 1 al 7 de un mes
  // nuevo (mismo criterio visual que el eje de Bklit: solo se marca el
  // arranque de cada mes, no todas las columnas).
  const monthLabels = useMemo(() => {
    const labels: { col: number; label: string }[] = [];
    let lastMonth = -1;
    columns.forEach((col, i) => {
      const firstRealBin = col.bins.find((b) => b.date.getFullYear() === year);
      if (!firstRealBin) return;
      const m = firstRealBin.date.getMonth();
      if (m !== lastMonth) {
        labels.push({ col: i, label: MESES_ABR[m] });
        lastMonth = m;
      }
    });
    return labels;
  }, [columns, year]);

  if (!hasData) {
    return (
      <ContentCard2 title={title} description={`${year} — actividad diaria`}>
        <div className="py-10 text-center">
          <p className="text-sm text-gray-400">Todavía no hay actividad para mostrar</p>
        </div>
      </ContentCard2>
    );
  }

  return (
    <ContentCard2
      title={title}
      description={`${year} — actividad diaria`}
      action={
        <DatePeriodSelector
          layoutId={`heatmap-mode-${gradientId}`}
          value={mode}
          onChange={setMode}
          items={[{ value: 'actividad', label: 'Actividad' }, { value: 'facturacion', label: 'Facturación' }]}
        />
      }
    >
      <div className="relative overflow-x-auto pb-1" onMouseLeave={() => setTooltip(null)}>
        <div className="inline-flex flex-col gap-1" style={{ minWidth: columns.length * (CELL_SIZE + CELL_GAP) + 24 }}>
          {/* Meses */}
          <div className="relative h-4" style={{ marginLeft: 20 }}>
            {monthLabels.map(({ col, label }) => (
              <span
                key={col}
                className="absolute text-[10px] text-gray-400"
                style={{ left: col * (CELL_SIZE + CELL_GAP) }}
              >
                {label}
              </span>
            ))}
          </div>

          <div className="flex gap-1">
            {/* Días de la semana */}
            <div className="flex flex-col gap-[3px] pt-0.5" style={{ width: 16 }}>
              {DIAS_ABR.map((d, i) => (
                <span key={i} className="text-[9px] leading-none text-gray-400 h-[11px] flex items-center">
                  {i % 2 === 1 ? d : ''}
                </span>
              ))}
            </div>

            {/* Rejilla */}
            <div
              className="grid grid-flow-col"
              style={{ gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`, gap: CELL_GAP }}
            >
              {columns.map((col, ci) =>
                col.bins.map((bin, ri) => {
                  const inYear = bin.date.getFullYear() === year;
                  if (!inYear) return <div key={`${ci}-${ri}`} style={{ width: CELL_SIZE, height: CELL_SIZE }} />;
                  const level = relativeLevel(bin.count, maxValue);
                  const key = dateKey(bin.date);
                  const revenue = dailyRevenue.get(key) ?? 0;
                  const count = dailyCount.get(key) ?? 0;
                  return (
                    <motion.div
                      key={`${ci}-${ri}`}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.18, delay: Math.min(ci, 40) * 0.004, ease: [0.22, 1, 0.36, 1] }}
                      style={{
                        width: CELL_SIZE,
                        height: CELL_SIZE,
                        borderRadius: 2,
                        backgroundColor: level === 0 ? '#f1f1f3' : levelColors[level],
                        cursor: 'default',
                      }}
                      onMouseEnter={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setTooltip({ x: r.left + r.width / 2, y: r.top, date: bin.date, count, revenue });
                      }}
                    />
                  );
                }),
              )}
            </div>
          </div>

          {/* Leyenda */}
          <div className="flex items-center justify-end gap-1.5 pt-1 pr-1 text-[10px] text-gray-400">
            <span>Menos</span>
            <div className="flex items-center gap-[3px]">
              <div style={{ width: CELL_SIZE, height: CELL_SIZE, borderRadius: 2, backgroundColor: '#f1f1f3' }} />
              {levelColors.map((c) => (
                <div key={c} style={{ width: CELL_SIZE, height: CELL_SIZE, borderRadius: 2, backgroundColor: c }} />
              ))}
            </div>
            <span>Más</span>
          </div>
        </div>

        {tooltip && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.12 }}
            className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-xl bg-gray-900 px-3 py-2 text-xs text-white shadow-lg"
            style={{ left: tooltip.x, top: tooltip.y - 8 }}
          >
            <p className="font-semibold">{fmtFecha(tooltip.date)}</p>
            <p className="text-gray-300">{tooltip.count} {tooltip.count === 1 ? 'evento' : 'eventos'}</p>
            {tooltip.revenue > 0 && <p className="text-gray-300">{fmtEUR(tooltip.revenue)}</p>}
          </motion.div>
        )}
      </div>
    </ContentCard2>
  );
};
