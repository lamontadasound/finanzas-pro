// ── Derivación de línea de negocio a partir de los datos legados ────────────
// Hoy no existe una columna estable `linea_negocio` en Supabase (salvo el
// campo suelto y parcialmente vacío `linea_negocio` de texto libre en
// ingresos/gastos/impuestos). Mientras no se aplique la migración SQL
// preparada en supabase/migrations/, derivamos la línea real, en este orden:
//   1. area = 'montada'                                        → montada_sound
//   2. id en REAL_MADRID_CONFIRMED_IDS                          → real_madrid
//   3. lineaNegocio === 'Real Madrid'                           → real_madrid
//   4. lineaNegocio === 'La Montada Sound'                      → montada_sound
//   5. area = 'dj' + tipoEvento en ('real_madrid', 'Partido')   → real_madrid
//   6. resto (area='dj')                                        → dj
//
// El paso 3 es la vía "de futuro": todo ingreso/gasto de Real Madrid creado
// desde la Fase D en adelante fija `lineaNegocio:'Real Madrid'` de forma
// explícita (sea cual sea su tipoEvento — Partido, Evento, Servicio…), así
// que no depende de un valor concreto de tipoEvento para clasificarse bien.
//
// REAL_MADRID_CONFIRMED_IDS: los 2 casos que antes eran ambiguos
// (cliente = "Real Madrid" pero tipoEvento = 'Boda') y que Julia confirmó el
// 2026-09-06 como partidos reales. La migración preparada les corrige
// tipoEvento a 'Partido' y linea_negocio a 'real_madrid', pero como esa
// migración NO se ha ejecutado todavía, sus datos en producción siguen con
// tipoEvento='Boda' y linea_negocio=null — por eso necesitan este
// identificador por ID exacto: sin él, el frontend seguiría clasificándolos
// como 'dj' hasta que se migre.
// Auditoría completa (2026-09-06): no hay más registros dudosos — de 17
// ingresos con "Real Madrid" en cliente/concepto, estos 2 son los únicos sin
// tipoEvento='real_madrid'. Ver AUDITORIA.md.
import type { LineaId } from './businessLines';

export const REAL_MADRID_CONFIRMED_IDS = ['tavsmkotyqfms30yxr1', 'gsdi12lqqoms30zk7x'];

interface LineaSource {
  id?: string;
  area: 'montada' | 'dj';
  tipoEvento?: string;
  lineaNegocio?: string;
}

export const resolveLinea = (item: LineaSource): LineaId => {
  const canonical: Record<string, LineaId> = { montada_sound: 'montada_sound', dj: 'dj', real_madrid: 'real_madrid', montada_installations: 'montada_installations', 'La Montada Sound': 'montada_sound', DJs: 'dj', 'Real Madrid': 'real_madrid', 'La Montada Installations': 'montada_installations' };
  if (item.lineaNegocio && canonical[item.lineaNegocio]) return canonical[item.lineaNegocio];
  if (item.area === 'montada') return 'montada_sound';
  if (item.id && REAL_MADRID_CONFIRMED_IDS.includes(item.id)) return 'real_madrid';
  if (item.lineaNegocio === 'Real Madrid') return 'real_madrid';
  if (item.lineaNegocio === 'La Montada Sound') return 'montada_sound';
  if (item.tipoEvento === 'real_madrid' || item.tipoEvento === 'Partido') return 'real_madrid';
  return 'dj';
};

/** Ingresos cuyo cliente sugiere Real Madrid pero cuyo tipoEvento no lo
 *  confirma y cuyo ID no está ya en la lista confirmada — para detectar
 *  automáticamente nuevos casos futuros que necesiten revisión manual. */
export const isAmbiguousRealMadrid = (item: { id?: string; tipoEvento?: string; lineaNegocio?: string; cliente?: string }) =>
  item.lineaNegocio !== 'Real Madrid' &&
  item.tipoEvento !== 'real_madrid' &&
  item.tipoEvento !== 'Partido' &&
  !(item.id && REAL_MADRID_CONFIRMED_IDS.includes(item.id)) &&
  !!item.cliente?.toLowerCase().includes('real madrid');
