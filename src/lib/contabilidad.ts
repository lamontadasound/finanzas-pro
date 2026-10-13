// ── Fórmulas contables centralizadas — Contabilidad consolidada (Fase E) ────
// Única fuente de verdad para todos los cálculos financieros usados en
// Contabilidad (Resumen contable, Pagos recibidos/pendientes, Informe
// contable). No se duplican estas fórmulas en las páginas: se importan
// desde aquí para garantizar que un mismo concepto (p.ej. "cobrado") se
// calcula siempre igual en toda la app.
//
// Fuente de datos: la tabla `ingresos` (no `facturas`, que hoy está vacía —
// 0 filas en las 13 tablas verificadas — así que basar aquí los cálculos de
// facturación/IVA sobre `facturas` mostraría ceros falsos). Cada `Ingreso`
// ya lleva su propio desglose baseImponible/IVA/total, que es el mismo dato
// ya usado y verificado en InformesPage.tsx.
import type { Ingreso, Gasto, GastoEvento, Impuesto, Factura, PaymentStatus } from '../types';
import type { LineaId } from '../config/businessLines';
import { resolveLinea } from '../config/resolveLinea';

// ── Cobro de un ingreso ──────────────────────────────────────────────────────
// Corrige el error ya detectado y solucionado en el Heatmap/Informes: un
// ingreso marcado como `pagado` debe computarse SIEMPRE como cobrado al
// 100% de su total, con independencia de si `pagosRecibidos` quedó
// desactualizado en algún registro histórico. Para el resto de estados
// ('pendiente'/'parcial'), el cobro real es lo recibido más la reserva ya
// cobrada (si la hay) — igual que en InformesPage.
export const cobradoDe = (i: Ingreso): number => {
  if (i.estadoPago === 'pagado') return i.total;
  return (i.pagosRecibidos ?? 0) + (i.tieneReserva ? (i.reserva ?? 0) : 0);
};

/** Pendiente = total - cobrado, nunca negativo (evita mostrar "pendiente" negativo si hay sobrepago). */
export const pendienteDe = (i: Ingreso): number => Math.max(0, i.total - cobradoDe(i));

/**
 * Deriva `estadoPago` a partir del importe cobrado — única regla usada al
 * registrar, editar o eliminar un cobro (Pagos recibidos/pendientes), para
 * que el estado nunca pueda desincronizarse del importe realmente cobrado.
 */
export const estadoPagoDesdeCobrado = (total: number, cobrado: number): PaymentStatus => {
  if (cobrado <= 0) return 'pendiente';
  if (cobrado < total) return 'parcial';
  return 'pagado';
};

/** Días transcurridos desde la fecha de referencia del cobro (factura si existe, si no el evento). */
export const diasPendienteDe = (i: Ingreso, nowMs: number = Date.now()): number => {
  const ref = i.fechaCobroPrevista ?? i.fechaFactura ?? i.fechaEvento;
  return Math.max(0, Math.floor((nowMs - new Date(ref).getTime()) / (1000 * 60 * 60 * 24)));
};

// ── Clasificación por línea de negocio ───────────────────────────────────────
// Reutiliza `resolveLinea` (misma fuente ya auditada y usada en Informes) —
// nunca se reimplementa aquí un criterio de clasificación distinto.
export const lineaDeIngreso = (i: Ingreso): LineaId =>
  resolveLinea({ id: i.id, area: i.area, tipoEvento: i.tipoEvento, lineaNegocio: i.lineaNegocio });

export const lineaDeGasto = (g: Gasto): LineaId => resolveLinea(g);

/** Igual criterio que `lineaDeGasto` — la tabla `facturas` no tiene
 *  `tipoEvento`, así que Real Madrid solo se distingue por `lineaNegocio`
 *  (campo explícito, no heurística de texto). Sin ese dato, cae en 'dj'. */
export const lineaDeFactura = (f: Factura): LineaId => resolveLinea(f);

// ── Agregados de un conjunto de ingresos (ya filtrado por periodo/línea) ────
export interface IngresosAgregados {
  ingresosSinIVA: number;   // suma de baseImponible
  ivaRepercutido: number;   // suma de importeIVA
  totalFacturado: number;   // suma de total (con IVA) — no depende de `facturas` (vacía)
  totalCobrado: number;     // suma de cobradoDe(i)
  totalPendiente: number;   // suma de pendienteDe(i)
  numIngresos: number;
}

export const agregarIngresos = (ingresos: Ingreso[]): IngresosAgregados => ingresos.reduce(
  (acc, i) => ({
    ingresosSinIVA: acc.ingresosSinIVA + i.baseImponible,
    ivaRepercutido: acc.ivaRepercutido + i.importeIVA,
    totalFacturado: acc.totalFacturado + i.total,
    totalCobrado: acc.totalCobrado + cobradoDe(i),
    totalPendiente: acc.totalPendiente + pendienteDe(i),
    numIngresos: acc.numIngresos + 1,
  }),
  { ingresosSinIVA: 0, ivaRepercutido: 0, totalFacturado: 0, totalCobrado: 0, totalPendiente: 0, numIngresos: 0 },
);

// ── Agregados de gastos (generales, deducibles) + gastos de evento ─────────
// Los gastos de evento (`GastoEvento`) heredan siempre la deducibilidad —
// son costes directos de producción de cada actuación/evento — y su IVA no
// se contabiliza aparte porque esas columnas son nuevas y todavía no
// persisten en Supabase (ver comentario en `types/index.ts`): sumar
// `importeIVA` de gastosEvento hoy sería sumar `undefined`→0 siempre, así
// que se trata su `importe` como coste deducible sin desglose de IVA.
export interface GastosAgregados {
  gastosDeducibles: number;  // gastos.baseImponible (deducible=true, sin IVA) + gastosEvento.importe
  ivaSoportado: number;      // gastos.importeIVA (deducible=true) — único origen real de IVA soportado
  numGastos: number;
}

export const agregarGastos = (gastos: Gasto[], gastosEvento: GastoEvento[]): GastosAgregados => {
  const deducibles = gastos.filter((g) => g.deducible);
  return {
    // baseImponible (sin IVA) — nunca `total`: mezclar un gasto con IVA
    // incluido contra `ingresosSinIVA` inflaría el gasto deducible y
    // falsearía el beneficio antes de impuestos.
    gastosDeducibles:
      deducibles.reduce((a, g) => a + g.baseImponible, 0) +
      gastosEvento.reduce((a, g) => a + g.importe, 0),
    ivaSoportado: deducibles.reduce((a, g) => a + g.importeIVA, 0),
    numGastos: gastos.length + gastosEvento.length,
  };
};

// ── Beneficio, impuestos estimados y resultado ──────────────────────────────
// Tipo general del Impuesto de Sociedades en España (25%) — se usa solo
// como estimación orientativa, nunca como liquidación real. Constante
// única y centralizada: si cambia, se cambia aquí y en ningún otro sitio.
export const TIPO_IMPUESTO_SOCIEDADES_ESTIMADO = 0.25;

export interface ResumenFinanciero extends IngresosAgregados, GastosAgregados {
  beneficioAntesImpuestos: number;
  estimacionImpuestos: number;
  resultadoDespuesImpuestos: number;
}

/**
 * Beneficio antes de impuestos = ingresos sin IVA - gastos deducibles (sin
 * IVA en el caso de gastos generales, coste íntegro en gastos de evento —
 * mismo criterio que `margenOperativo` ya usado y verificado en
 * InformesPage.tsx, no se reinventa aquí un cálculo distinto).
 * Estimación de impuestos = 25% del beneficio, solo si es positivo (una
 * pérdida no genera una cuota de Sociedades a estimar).
 */
export const calcularResumenFinanciero = (ingresos: Ingreso[], gastos: Gasto[], gastosEvento: GastoEvento[]): ResumenFinanciero => {
  const ing = agregarIngresos(ingresos);
  const gas = agregarGastos(gastos, gastosEvento);
  const beneficioAntesImpuestos = ing.ingresosSinIVA - gas.gastosDeducibles;
  const estimacionImpuestos = beneficioAntesImpuestos > 0 ? beneficioAntesImpuestos * TIPO_IMPUESTO_SOCIEDADES_ESTIMADO : 0;
  return {
    ...ing,
    ...gas,
    beneficioAntesImpuestos,
    estimacionImpuestos,
    resultadoDespuesImpuestos: beneficioAntesImpuestos - estimacionImpuestos,
  };
};

/** IVA a pagar (positivo) o a compensar (negativo) — repercutido - soportado. */
export const ivaEstimadoALiquidar = (ivaRepercutido: number, ivaSoportado: number): number => ivaRepercutido - ivaSoportado;

// ── Impuestos registrados (tabla `impuestos`) — SOLO datos reales guardados ─
// Nunca se inventan registros de cuota de autónomo, nóminas o Sociedades
// cuando no existen — estas funciones devuelven 0/[] si no hay datos, y la
// UI debe mostrar "Sin datos registrados" en ese caso, nunca un importe.
export const impuestosPorTipo = (impuestos: Impuesto[], tipo: Impuesto['tipo']) => impuestos.filter((i) => i.tipo === tipo);

export const totalImpuestosRegistrados = (impuestos: Impuesto[]): number => impuestos.reduce((a, i) => a + i.importe, 0);
