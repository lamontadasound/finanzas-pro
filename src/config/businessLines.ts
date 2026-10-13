// ── Configuración central de líneas de negocio ──────────────────────────────
// Clave estable (nunca cambia, aunque el nombre visible sí pueda hacerlo).
// Añadir una nueva línea en el futuro = añadir una entrada aquí, no reescribir
// rutas ni componentes.
export type LineaId = 'montada_sound' | 'dj' | 'real_madrid' | 'montada_installations';

export const LINEA_IDS: LineaId[] = ['montada_sound', 'dj', 'real_madrid', 'montada_installations'];

export interface BusinessLineConfig {
  id: LineaId;
  label: string;
  shortLabel: string;
  routeBase: string;
  /** Valor legado en la columna `area` (TEXT libre, sin CHECK en BD) usado
   *  hasta que se aplique la migración de `linea_negocio`. */
  legacyArea: 'montada' | 'dj' | null;
  tieneInversiones: boolean;
  /** true = ya tiene una implementación funcional completa. */
  activa: boolean;
  /** true = puede recibir datos nuevos hoy sin migración (comparte `area`
   *  legado o tiene columna propia). false = la creación queda bloqueada
   *  con `MigrationRequiredNotice` hasta ejecutar la migración de
   *  `linea_negocio` (ver supabase/migrations/). */
  puedeCrearHoy: boolean;
}

export const BUSINESS_LINES: Record<LineaId, BusinessLineConfig> = {
  montada_sound: {
    id: 'montada_sound',
    label: 'La Montada Sound',
    shortLabel: 'La Montada',
    routeBase: '/lineas/montada-sound',
    legacyArea: 'montada',
    tieneInversiones: true,
    activa: true,
    puedeCrearHoy: true,
  },
  dj: {
    id: 'dj',
    label: 'DJ',
    shortLabel: 'DJ',
    routeBase: '/lineas/dj',
    legacyArea: 'dj',
    tieneInversiones: false,
    activa: true,
    puedeCrearHoy: true,
  },
  real_madrid: {
    id: 'real_madrid',
    label: 'Real Madrid',
    shortLabel: 'Real Madrid',
    routeBase: '/lineas/real-madrid',
    // Hoy vive mezclado dentro de area='dj' (ingresos vía resolveLinea,
    // gastos generales vía lineaNegocio='Real Madrid', equipo con su propia
    // columna area='real_madrid'). Módulo completo desde la Fase D.
    legacyArea: null,
    tieneInversiones: true,
    activa: true,
    puedeCrearHoy: true,
  },
  montada_installations: {
    id: 'montada_installations',
    label: 'La Montada Installations',
    shortLabel: 'Installations',
    routeBase: '/lineas/installations',
    legacyArea: null,
    tieneInversiones: false,
    activa: true,
    // Sin columna propia en Supabase todavía — creación bloqueada hasta
    // ejecutar la migración preparada. Ver MigrationRequiredNotice.
    puedeCrearHoy: false,
  },
};

export const businessLine = (id: LineaId) => BUSINESS_LINES[id];
