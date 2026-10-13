import { describe, it, expect } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { buildHeatmapColumns, levelFor, relativeLevel } from './heatmapUtils';
import { ActivityHeatmap } from './ActivityHeatmap';

afterEach(cleanup);

const key = (y: number, m: number, d: number) => new Date(y, m, d).toISOString().slice(0, 10);

describe('buildHeatmapColumns — agrupación por fecha', () => {
  it('coloca cada día del año en su columna/semana correcta', () => {
    const values = new Map([[key(2026, 2, 10), 3]]); // 10 marzo 2026
    const columns = buildHeatmapColumns(2026, values);
    const flat = columns.flatMap((c) => c.bins);
    const match = flat.find((b) => b.date.toISOString().slice(0, 10) === key(2026, 2, 10));
    expect(match?.count).toBe(3);
  });

  it('cubre el año completo (52 o 53 columnas de domingo a sábado)', () => {
    const columns = buildHeatmapColumns(2026, new Map());
    expect(columns.length).toBeGreaterThanOrEqual(53);
    expect(columns.length).toBeLessThanOrEqual(54);
    const allDays = columns.flatMap((c) => c.bins).filter((b) => b.date.getFullYear() === 2026);
    expect(allDays.length).toBe(365); // 2026 no es bisiesto
  });

  it('no inventa datos en días fuera del rango proporcionado', () => {
    const columns = buildHeatmapColumns(2026, new Map([[key(2026, 0, 1), 5]]));
    const total = columns.flatMap((c) => c.bins).reduce((s, b) => s + b.count, 0);
    expect(total).toBe(5); // solo el día indicado, nada más
  });
});

describe('levelFor — escala de intensidad', () => {
  it('nivel 0 para días sin eventos', () => {
    expect(levelFor(0)).toBe(0);
  });
  it('niveles 1 a 3 para 1, 2 y 3 eventos', () => {
    expect(levelFor(1)).toBe(1);
    expect(levelFor(2)).toBe(2);
    expect(levelFor(3)).toBe(3);
  });
  it('nivel máximo (4) para 4 o más eventos', () => {
    expect(levelFor(4)).toBe(4);
    expect(levelFor(20)).toBe(4);
  });
});

describe('relativeLevel — escala relativa al máximo del conjunto (modo Facturación)', () => {
  it('nivel 0 cuando el valor o el máximo son 0/negativos', () => {
    expect(relativeLevel(0, 1000)).toBe(0);
    expect(relativeLevel(500, 0)).toBe(0);
    expect(relativeLevel(-10, 1000)).toBe(0);
  });

  it('nivel máximo (4) cuando el valor es igual al máximo del año', () => {
    expect(relativeLevel(1000, 1000)).toBe(4);
  });

  it('reparte valores intermedios en tramos 1 a 4 proporcionales al máximo', () => {
    expect(relativeLevel(1, 1000)).toBe(1); // valor mínimo positivo, nunca 0
    expect(relativeLevel(250, 1000)).toBe(1);
    expect(relativeLevel(500, 1000)).toBe(2);
    expect(relativeLevel(750, 1000)).toBe(3);
  });

  it('importes en euros de distinta magnitud no colapsan a un único nivel (regresión del bug de Facturación)', () => {
    // Reproduce el caso real que colapsaba: importes de cientos/miles de €.
    const importes = [120, 480, 950, 1800, 3000];
    const max = Math.max(...importes);
    const niveles = new Set(importes.map((v) => relativeLevel(v, max)));
    expect(niveles.size).toBeGreaterThan(1); // antes del fix: todos caían en el mismo nivel
  });
});

describe('día con varios eventos', () => {
  it('acumula correctamente el recuento de un día con múltiples eventos', () => {
    const dailyCount = new Map<string, number>();
    const d = key(2026, 5, 15);
    // Simula 3 ingresos el mismo día, tal como hacen las páginas reales:
    // dailyCount.set(fecha, (dailyCount.get(fecha) ?? 0) + 1) por cada ingreso.
    [1, 2, 3].forEach(() => dailyCount.set(d, (dailyCount.get(d) ?? 0) + 1));
    const columns = buildHeatmapColumns(2026, dailyCount);
    const bin = columns.flatMap((c) => c.bins).find((b) => b.date.toISOString().slice(0, 10) === d);
    expect(bin?.count).toBe(3);
    expect(levelFor(bin!.count)).toBe(3);
  });
});

describe('periodo sin datos', () => {
  it('un año entero sin ningún evento produce todas las celdas a 0, sin inventar actividad', () => {
    const columns = buildHeatmapColumns(2026, new Map());
    const total = columns.flatMap((c) => c.bins).reduce((s, b) => s + b.count, 0);
    expect(total).toBe(0);
  });

  it('ActivityHeatmap muestra el estado vacío cuando no hay datos, sin dibujar ninguna rejilla', () => {
    const { getByText, queryByText } = render(
      <ActivityHeatmap
        year={2026}
        dailyCount={new Map()}
        dailyRevenue={new Map()}
        levelColors={['#eee', '#ddd', '#ccc', '#bbb', '#aaa']}
      />,
    );
    expect(getByText('Todavía no hay actividad para mostrar')).toBeTruthy();
    expect(queryByText('Menos')).toBeNull();
  });
});

describe('exactitud de datos — la suma de celdas coincide con el total de eventos', () => {
  it('la suma de todas las celdas del año es igual al número de eventos agregados', () => {
    // Simula 13 ingresos reales repartidos en varias fechas, alguna con más
    // de un evento el mismo día — igual que hace InformesPage con datos reales.
    const fechas = [
      key(2026, 1, 3), key(2026, 1, 3), // 2 eventos el mismo día
      key(2026, 2, 10), key(2026, 4, 1), key(2026, 4, 15),
      key(2026, 5, 20), key(2026, 5, 20), key(2026, 5, 20), // 3 eventos el mismo día
      key(2026, 6, 1), key(2026, 8, 9), key(2026, 8, 22),
      key(2026, 9, 3), key(2026, 9, 17),
    ];
    const dailyCount = new Map<string, number>();
    fechas.forEach((f) => dailyCount.set(f, (dailyCount.get(f) ?? 0) + 1));

    const columns = buildHeatmapColumns(2026, dailyCount);
    const total = columns.flatMap((c) => c.bins).reduce((s, b) => s + b.count, 0);
    expect(total).toBe(fechas.length); // 13, igual que el nº de ingresos reales

    const multiEventDay = columns.flatMap((c) => c.bins).find((b) => b.date.toISOString().slice(0, 10) === key(2026, 5, 20));
    expect(multiEventDay?.count).toBe(3);
    expect(levelFor(multiEventDay!.count)).toBe(3);
  });
});

describe('20 montajes/remontajes seguidos — 0 rejillas vacías cuando hay datos', () => {
  it('se remonta 20 veces con datos reales y siempre dibuja la rejilla completa', () => {
    const dailyCount = new Map<string, number>();
    [1, 5, 5, 5, 12, 20, 28].forEach((d) => dailyCount.set(key(2026, 5, d), 1));
    dailyCount.set(key(2026, 5, 5), 3); // día con varios eventos, ya sumado arriba

    let failures = 0;
    for (let i = 0; i < 20; i += 1) {
      const { queryByText, unmount } = render(
        <ActivityHeatmap
          year={2026}
          dailyCount={dailyCount}
          dailyRevenue={new Map()}
          levelColors={['#eee', '#ddd', '#ccc', '#bbb', '#aaa']}
        />,
      );
      const rendered = !!queryByText('Menos') && !!queryByText('Más');
      if (!rendered) failures += 1;
      unmount();
      cleanup();
    }
    expect(failures).toBe(0);
  });
});

describe('montaje con contenedor de tamaño inicialmente 0 (jsdom no calcula layout real)', () => {
  it('renderiza la rejilla completa aunque el entorno de test no mida ningún ancho/alto real', () => {
    // jsdom no implementa layout: TODOS los elementos miden 0x0. Si
    // ActivityHeatmap dependiera de ParentSize/ResizeObserver como el
    // Heatmap oficial de Bklit, este test no encontraría ninguna celda.
    // Al ser una rejilla CSS con celdas de tamaño fijo, no hay ninguna
    // medición de contenedor de por medio — debe renderizar igualmente.
    const dailyCount = new Map([[key(2026, 3, 1), 2]]);
    const { container, getByText } = render(
      <ActivityHeatmap
        year={2026}
        dailyCount={dailyCount}
        dailyRevenue={new Map()}
        levelColors={['#eee', '#ddd', '#ccc', '#bbb', '#aaa']}
      />,
    );
    expect(getByText('Menos')).toBeTruthy();
    expect(getByText('Más')).toBeTruthy();
    // 53-54 semanas × 7 días de celdas (incluye las de relleno fuera de año)
    const cells = container.querySelectorAll('[style*="border-radius: 2px"]');
    expect(cells.length).toBeGreaterThan(300);
  });
});
