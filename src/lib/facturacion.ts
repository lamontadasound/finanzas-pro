// ── Facturación — fórmulas centralizadas (Fase H) ───────────────────────────
// Única fuente de verdad para todo cálculo de facturación parcial. Nunca se
// duplica esta lógica en un componente — todo pasa por aquí. Import por
// nombre desde `../lib/facturacion`, igual que `../lib/contabilidad`.
//
// Distinción explícita y constante en todo este módulo: FACTURADO (cuánto
// se ha documentado fiscalmente de un ingreso, 0-100%) es un eje totalmente
// independiente de COBRADO (cuánto dinero ha entrado de verdad — ver
// `cobradoDe`/`pendienteDe` en `lib/contabilidad.ts`). Una factura emitida
// al 100% puede seguir sin cobrar; un ingreso cobrado al 100% puede no
// tener ninguna factura emitida todavía.
import type { Factura, FacturaEstado, Ingreso, ConfiguracionFiscal } from '../types';

export const PORCENTAJES_RAPIDOS = [0, 30, 50, 100] as const;

/** Redondeo a céntimo — evita arrastrar errores de coma flotante en importes. */
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface CalculoFactura {
  baseImponible: number;
  importeIVA: number;
  total: number;
}

/**
 * Calcula base/IVA/total de una factura parcial a partir del importe total
 * SIN IVA del ingreso y el porcentaje a facturar en esta factura concreta.
 * `porcentaje` es 0-100. El IVA se calcula sobre la base resultante, nunca
 * sobre el total del ingreso completo — así una factura del 30% de un
 * ingreso con IVA al 21% lleva el 21% de SU base, no un trozo del IVA total
 * calculado aparte (evita errores de redondeo acumulados entre facturas).
 */
export function calcularFacturaParcial(baseImponibleIngreso: number, porcentajeIVA: number, porcentaje: number): CalculoFactura {
  const baseImponible = round2(baseImponibleIngreso * (porcentaje / 100));
  const importeIVA = round2(baseImponible * (porcentajeIVA / 100));
  return { baseImponible, importeIVA, total: round2(baseImponible + importeIVA) };
}

/** Facturas "vivas" de un ingreso: excluye anuladas y borradores (0%, sin número). */
export const facturasVivasDe = (facturas: Factura[], ingresoId: string): Factura[] =>
  facturas.filter((f) => f.ingresoId === ingresoId && f.tipo === 'emitida' && f.estado !== 'anulada' && f.estado !== 'borrador');

/** Suma del porcentaje ya facturado (facturas vivas) de un ingreso — 0-100, nunca más. */
export const porcentajeFacturadoDe = (facturas: Factura[], ingresoId: string): number =>
  round2(facturasVivasDe(facturas, ingresoId).reduce((a, f) => a + (f.porcentajeFacturado ?? 0), 0));

/** Importe (con IVA) ya facturado de un ingreso — suma de los totales de sus facturas vivas. */
export const importeFacturadoDe = (facturas: Factura[], ingresoId: string): number =>
  round2(facturasVivasDe(facturas, ingresoId).reduce((a, f) => a + f.total, 0));

/** Porcentaje que TODAVÍA se puede facturar de un ingreso (0-100). */
export const porcentajePendienteDeFacturar = (facturas: Factura[], ingresoId: string): number =>
  round2(Math.max(0, 100 - porcentajeFacturadoDe(facturas, ingresoId)));

/**
 * Valida que una nueva factura de `porcentaje`% no haga superar el 100% ya
 * facturado de ese ingreso (incluyendo facturas parciales previas). No mira
 * importes en euros por separado — el porcentaje ES la fuente de verdad, el
 * importe se deriva siempre de él (asegura que 30%+70% cuadra exacto con el
 * 100%, sin depender de que dos redondeos en euros coincidan por casualidad).
 */
export function puedeFacturarPorcentaje(facturas: Factura[], ingresoId: string, porcentaje: number): { ok: boolean; motivo?: string } {
  if (!Number.isFinite(porcentaje)) return { ok: false, motivo: 'Indica un porcentaje válido.' };
  if (porcentaje <= 0) return { ok: false, motivo: 'El porcentaje debe ser mayor que 0% para emitir una factura fiscal (0% es solo un borrador).' };
  if (porcentaje > 100) return { ok: false, motivo: 'El porcentaje no puede superar el 100%.' };
  const yaFacturado = porcentajeFacturadoDe(facturas, ingresoId);
  if (round2(yaFacturado + porcentaje) > 100.001) {
    return { ok: false, motivo: `Ya se ha facturado el ${yaFacturado}% de este ingreso — como máximo puedes facturar ${round2(100 - yaFacturado)}% más.` };
  }
  return { ok: true };
}

/** Cantidad cobrada de un ingreso — reexportado desde `contabilidad.ts` para no duplicar la regla. */
export { cobradoDe as importeCobradoDe, pendienteDe as importePendienteDeCobrarDe } from './contabilidad';

export interface ResumenFacturacionIngreso {
  porcentajeFacturado: number;
  porcentajePendiente: number;
  importeFacturado: number;
  importePendienteDeFacturar: number;
  numFacturasVivas: number;
}

export function resumenFacturacionIngreso(ingreso: Ingreso, facturas: Factura[]): ResumenFacturacionIngreso {
  const porcentajeFacturado = porcentajeFacturadoDe(facturas, ingreso.id);
  return {
    porcentajeFacturado,
    porcentajePendiente: round2(100 - porcentajeFacturado),
    importeFacturado: importeFacturadoDe(facturas, ingreso.id),
    importePendienteDeFacturar: round2(ingreso.total - importeFacturadoDe(facturas, ingreso.id)),
    numFacturasVivas: facturasVivasDe(facturas, ingreso.id).length,
  };
}

// ── Detección de duplicados (facturas de gasto adjuntadas) ─────────────────
// Heurística simple y explicable: mismo proveedor + mismo número de
// proveedor, o mismo proveedor + misma fecha + mismo total exacto. Nunca
// bloquea, solo marca `posibleDuplicado` para revisión humana.
export function esPosibleDuplicado(nueva: { proveedor?: string; numeroProveedor?: string; fecha: string; total: number }, existentes: Factura[]): boolean {
  return existentes.some((f) => {
    if (!f.proveedor || !nueva.proveedor) return false;
    if (f.proveedor.trim().toLowerCase() !== nueva.proveedor.trim().toLowerCase()) return false;
    if (nueva.numeroProveedor && f.numeroProveedor && f.numeroProveedor.trim() === nueva.numeroProveedor.trim()) return true;
    return f.fecha === nueva.fecha && round2(f.total) === round2(nueva.total);
  });
}

// ── Estado visible de una factura — combina `estado` con el cobro real ────
// (el cobro real vive en el Ingreso, no en la Factura — esta función solo
// deriva la ETIQUETA a mostrar, nunca almacena un segundo estado de cobro).
export function estadoFacturaVisible(f: Factura, cobradoDelIngreso: number, totalIngreso: number): FacturaEstado {
  if (f.estado === 'anulada' || f.estado === 'borrador' || f.estado === 'pendiente_sincronizar' || f.estado === 'error_sincronizacion') {
    return f.estado;
  }
  if (cobradoDelIngreso <= 0) return 'emitida';
  if (cobradoDelIngreso >= totalIngreso) return 'cobrada';
  return 'parcialmente_cobrada';
}

// ── Emisor fiscal aplicable a una línea de negocio ──────────────────────────
// Única función que decide "qué emisor factura este proyecto" — todo el
// código de facturación (formulario de emisión, PDF, rectificación) debe
// pasar por aquí, nunca asumir un emisor fijo. Si la línea no tiene
// asignación explícita, cae al emisor `id: 'default'` (el migrado del
// antiguo modelo de fila única) — nunca inventa uno ni deja el emisor
// indefinido silenciosamente.
export function resolverEmisorParaLinea(
  emisores: ConfiguracionFiscal[],
  proyectoEmisorMap: Record<string, string>,
  lineaId: string,
): ConfiguracionFiscal | null {
  const emisorId = proyectoEmisorMap[lineaId];
  if (emisorId) {
    const asignado = emisores.find((e) => e.id === emisorId);
    if (asignado && asignado.activo !== false) return asignado;
  }
  // CORRECCIÓN: antes caía a `emisores[0]` (el primero de la lista, sin
  // ningún criterio) cuando no había ni asignación explícita ni emisor
  // 'default' — un fallback arbitrario e impredecible. Ahora, sin
  // asignación explícita, SOLO cae al emisor 'default' (documentado: es el
  // migrado del antiguo modelo de fila única, un fallback con significado,
  // no arbitrario). Si tampoco existe 'default', devuelve `null` — quien
  // llama (el formulario de emisión) debe entonces pedir que se elija un
  // emisor explícitamente, nunca inventar uno.
  return null;
}
