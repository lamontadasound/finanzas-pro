// Plazos y porcentajes negociables de los contratos. Cada contrato declara los
// suyos con su valor por defecto (el del modelo del abogado) y se pueden cambiar
// en cada contrato sin tocar el resto del texto.
export interface Termino { key: string; label: string; unidad: string; def: number; min?: number }
export type Terminos = Record<string, number | undefined>;

const PALABRAS: Record<number, string> = {
  1: 'uno', 2: 'dos', 3: 'tres', 4: 'cuatro', 5: 'cinco', 6: 'seis', 7: 'siete', 8: 'ocho', 9: 'nueve', 10: 'diez', 11: 'once', 12: 'doce',
  13: 'trece', 14: 'catorce', 15: 'quince', 16: 'dieciséis', 17: 'diecisiete', 18: 'dieciocho', 19: 'diecinueve', 20: 'veinte',
  24: 'veinticuatro', 25: 'veinticinco', 30: 'treinta', 36: 'treinta y seis', 40: 'cuarenta', 45: 'cuarenta y cinco', 48: 'cuarenta y ocho',
  60: 'sesenta', 72: 'setenta y dos', 90: 'noventa',
};
const num = (n: number) => PALABRAS[n] ?? n.toLocaleString('es-ES');
/** «diez días naturales», «un día hábil»… */
export const dias = (n: number, adj: '' | 'natural' | 'hábil' = '') =>
  n === 1 ? `un día${adj ? ` ${adj}` : ''}` : `${num(n)} días${adj === 'natural' ? ' naturales' : adj === 'hábil' ? ' hábiles' : ''}`;
export const horas = (n: number, habiles = false) => (n === 1 ? `una hora${habiles ? ' hábil' : ''}` : `${num(n)} horas${habiles ? ' hábiles' : ''}`);
export { num as numeroEnLetra };

/** Valor elegido para un plazo, o el del modelo si no se ha tocado. */
export const valorTermino = (defs: readonly Termino[], t: Terminos | undefined, key: string): number => {
  const d = defs.find((x) => x.key === key);
  if (!d) throw new Error(`Plazo desconocido: ${key}`);
  const val = t?.[key];
  return typeof val === 'number' && Number.isFinite(val) && val >= (d.min ?? 1) ? val : d.def;
};

/** Avisa si algún plazo está por debajo de su mínimo (nunca se cambia en silencio). */
export const errorTerminos = (defs: readonly Termino[], t: Terminos | undefined): string | null => {
  for (const d of defs) {
    const val = t?.[d.key];
    if (val === undefined) continue;
    const min = d.min ?? 1;
    if (!Number.isFinite(val) || val < min) return `Plazos: «${d.label}» tiene que ser ${min} o más.`;
    if (d.unidad === '%' && val > 100) return `Plazos: «${d.label}» no puede pasar del 100 %.`;
    if (d.unidad !== '%' && d.unidad !== 'veces' && !Number.isInteger(val)) return `Plazos: «${d.label}» tiene que ser un número entero.`;
  }
  return null;
};
