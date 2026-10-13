// ── Adaptación propia — utilidad de datos para el Heatmap de actividad ──────
// Agrupa un año completo en semanas de domingo a sábado (53-54 columnas),
// a partir de un mapa "YYYY-MM-DD" → valor (nº de eventos o € del día).
// Usada por `ActivityHeatmap` (implementación propia en CSS Grid — ver ese
// fichero para la razón por la que ya no se usa el Heatmap oficial de
// Bklit). El tipo `HeatmapColumn`/`HeatmapBin` es propio, no del registro.

export interface HeatmapBin {
  bin: number;
  date: Date;
  count: number;
}

export interface HeatmapColumn {
  bin: number;
  bins: HeatmapBin[];
}

const toKey = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Construye las columnas semanales de un año completo a partir de un mapa
 * "YYYY-MM-DD" → valor. Los días fuera del año (relleno de la semana parcial
 * de cierre) llevan count=0 y `ActivityHeatmap` los oculta.
 */
export function buildHeatmapColumns(year: number, dailyValues: Map<string, number>): HeatmapColumn[] {
  const jan1 = new Date(year, 0, 1);
  const start = new Date(jan1);
  start.setDate(start.getDate() - start.getDay()); // retrocede al domingo

  const dec31 = new Date(year, 11, 31);
  const end = new Date(dec31);
  end.setDate(end.getDate() + (6 - end.getDay())); // avanza al sábado

  const columns: HeatmapColumn[] = [];
  const cursor = new Date(start);
  let colIndex = 0;
  while (cursor <= end) {
    const bins: HeatmapBin[] = Array.from({ length: 7 }, (_, dayOfWeek) => {
      const date = new Date(cursor);
      date.setDate(date.getDate() + dayOfWeek);
      const count = date.getFullYear() === year ? (dailyValues.get(toKey(date)) ?? 0) : 0;
      return { bin: dayOfWeek, date, count };
    });
    columns.push({ bin: colIndex, bins });
    cursor.setDate(cursor.getDate() + 7);
    colIndex += 1;
  }
  return columns;
}

/** Umbrales de intensidad de un simple recuento de eventos (0, 1, 2, 3, 4+) —
 *  válido cuando el valor representa "número de eventos del día". */
export function levelFor(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  return 4;
}

/**
 * Escala de intensidad RELATIVA al máximo del propio conjunto de datos —
 * necesaria en el modo "Facturación" del Heatmap: un importe en euros no
 * encaja en los umbrales fijos 0/1/2/3/4+ de `levelFor` (pensados para un
 * recuento pequeño de eventos), así que aquí el nivel se calcula como una
 * fracción del valor máximo presente ese año, repartida en 4 tramos. Con
 * `max<=0` (año sin datos) siempre da nivel 0.
 */
export function relativeLevel(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((value / max) * 4)));
}
