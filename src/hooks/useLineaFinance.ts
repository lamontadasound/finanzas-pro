import { useMemo } from 'react';
import { gastoEventoSinIVA } from '../lib/ingresoRentabilidad';
import type { Ingreso, Gasto, GastoEvento, Equipo } from '../types';

// ── Cálculos financieros comunes por línea de negocio ───────────────────────
// Reutilizado por los Resúmenes e Informes de DJ, Real Madrid y (más
// adelante) cualquier línea nueva. Recibe los arrays ya filtrados por línea
// y año (vía resolveLinea en cada página) — este hook no filtra, solo calcula,
// para no acoplarse a cómo cada línea decide qué le pertenece.
//
// Definiciones (obligatorias, ver instrucciones de la Fase D):
//   - Facturación total: importe con IVA.
//   - Ingresos operativos: base imponible (sin IVA).
//   - Gastos operativos: gastos sin IVA vinculados a la actividad (de
//     actuación/instalación + generales).
//   - Beneficio operativo: ingresos operativos − gastos operativos.
//   - Margen: beneficio operativo / ingresos operativos.
//   - Inversiones: importe total mostrado aparte, NUNCA restado del
//     beneficio operativo como si fuera gasto corriente.
//   - Flujo de caja después de inversiones: beneficio operativo − inversiones.
//   - Cobrado: total íntegro si estadoPago='pagado'; si no, solo
//     pagosRecibidos. Pendiente: el resto.
export interface LineaFinanceResult {
  facturacionConIva: number;
  ingresosOperativos: number;
  ivaRepercutido: number;
  gastosActuacion: number;
  gastosGenerales: number;
  gastosOperativos: number;
  beneficioOperativo: number;
  margen: number;
  inversiones: number;
  flujoCajaTrasInversiones: number;
  cobrado: number;
  pendiente: number;
  numEventos: number;
}

export function useLineaFinance(
  ingresos: Ingreso[],
  gastosGenerales: Gasto[],
  gastosVinculados: GastoEvento[],
  equipo: Equipo[] = [],
): LineaFinanceResult {
  return useMemo(() => {
    const facturacionConIva = ingresos.reduce((s, i) => s + i.total, 0);
    const ingresosOperativos = ingresos.reduce((s, i) => s + i.baseImponible, 0);
    const ivaRepercutido = ingresos.reduce((s, i) => s + i.importeIVA, 0);
    const gastosActuacion = gastosVinculados.reduce((s, g) => s + gastoEventoSinIVA(g), 0);
    const gastosGeneralesTotal = gastosGenerales.reduce((s, g) => s + g.baseImponible, 0);
    const gastosOperativos = gastosActuacion + gastosGeneralesTotal;
    const beneficioOperativo = ingresosOperativos - gastosOperativos;
    const margen = ingresosOperativos > 0 ? beneficioOperativo / ingresosOperativos : 0;
    const inversiones = equipo.reduce((s, e) => s + e.total, 0);
    const flujoCajaTrasInversiones = beneficioOperativo - inversiones;
    const cobrado = ingresos.reduce((s, i) => s + (i.estadoPago === 'pagado' ? i.total : i.pagosRecibidos), 0);
    const pendiente = ingresos.reduce((s, i) => s + (i.estadoPago === 'pagado' ? 0 : Math.max(0, i.total - i.pagosRecibidos)), 0);

    return {
      facturacionConIva, ingresosOperativos, ivaRepercutido,
      gastosActuacion, gastosGenerales: gastosGeneralesTotal, gastosOperativos,
      beneficioOperativo, margen, inversiones, flujoCajaTrasInversiones,
      cobrado, pendiente, numEventos: ingresos.length,
    };
  }, [ingresos, gastosGenerales, gastosVinculados, equipo]);
}
