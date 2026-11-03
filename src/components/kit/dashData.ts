import type { Gasto, GastoEvento, Ingreso } from '../../types';
import { pendienteDe } from '../../lib/contabilidad';
import { gastoEventoSinIVA } from '../../lib/ingresoRentabilidad';

/** Datos de presentación del dashboard: categorías por mes y listas cortas. */
export function dashListas(todos: Ingreso[], delAnio: Ingreso[], gastos: Gasto[], gastosEvento: GastoEvento[]) {
  const porCat = new Map<string, number[]>();
  const sumar = (cat: string, fecha: string, v: number) => {
    const mes = new Date(fecha).getMonth();
    if (Number.isNaN(mes)) return;
    const fila = porCat.get(cat) ?? (Array(12).fill(0) as number[]);
    fila[mes] += v;
    porCat.set(cat, fila);
  };
  gastos.forEach((g) => sumar(g.categoria, g.fecha, g.baseImponible));
  gastosEvento.forEach((g) => sumar(g.categoria, g.fecha, gastoEventoSinIVA(g)));
  const total = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const categorias = [...porCat.entries()].sort((a, b) => total(b[1]) - total(a[1])).slice(0, 4).map(([label, values]) => ({ label, values }));
  const hoy = new Date().toISOString().slice(0, 10);
  const proximos = todos.filter((i) => i.fechaEvento >= hoy && i.estadoPago !== 'cancelado').sort((a, b) => a.fechaEvento.localeCompare(b.fechaEvento)).slice(0, 4);
  const porCobrar = delAnio.filter((i) => i.estadoPago !== 'cancelado' && pendienteDe(i) > 0).sort((a, b) => pendienteDe(b) - pendienteDe(a)).slice(0, 4);
  return { categorias, proximos, porCobrar };
}
