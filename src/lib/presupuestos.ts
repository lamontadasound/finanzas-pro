import type { FotoMontaje } from './fotoMontaje';
import type { LineaId } from '../config/businessLines';

export interface ConceptoPresupuesto { id: string; descripcion: string; detalle?: string; cantidad: number; precio: number | null; descuento?: number; incluido?: boolean }
export interface MarcaPresupuesto { nombre: string; nif: string; direccion: string; telefono: string; email: string; web: string; instagram: string }
export const MARCA_MONTADA: MarcaPresupuesto = { nombre: 'LA MONTADA SOUND', nif: 'B21642913', direccion: 'CALLE PORTUGALETE 68, 28223\nPOZUELO DE ALARCÓN', telefono: '+34 692 311 097', email: 'info@lamontada.es', web: 'www.lamontada.es', instagram: '@lamontadasound' };
export interface PresupuestoContenido {
  fotoMontaje?: FotoMontaje; fechaEvento?: string; marca?: MarcaPresupuesto;
  titulo: string; cliente: string; direccion: string; fecha: string; validez: string;
  solicitud: string; conceptos: ConceptoPresupuesto[]; iva: number;
  notas: string; estado: 'borrador' | 'pendiente' | 'aceptado' | 'rechazado';
}
export interface Presupuesto {
  id: string; numero: number; linea_negocio: LineaId; contenido: PresupuestoContenido; revision: number;
}
export const dinero = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
const centimos = (n: number) => Math.round((n + Number.EPSILON) * 100);
export function totalesPresupuesto(p: PresupuestoContenido) {
  const baseCentimos = p.conceptos.reduce((sum, c) => sum + centimos(c.incluido ? 0 : c.cantidad * ((c.precio ?? 0) - (c.descuento ?? 0))), 0);
  const ivaCentimos = Math.round(baseCentimos * p.iva / 100);
  return { base: baseCentimos / 100, iva: ivaCentimos / 100, total: (baseCentimos + ivaCentimos) / 100,
    pendientes: p.conceptos.filter(c => !c.incluido && c.precio === null).length };
}
export function nuevoPresupuesto(): PresupuestoContenido {
  const today = new Date();
  const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const expiry = new Date(today); expiry.setDate(expiry.getDate() + 30);
  return { marca: { ...MARCA_MONTADA }, fechaEvento: '', titulo: '', cliente: '', direccion: '', fecha: localDate(today), validez: localDate(expiry), solicitud: '', conceptos: [], iva: 21, notas: '', estado: 'borrador' };
}
export const referenciaPresupuesto = (p: Presupuesto) => `PRE-${String(p.numero).padStart(5, '0')}`;

// Recognizes explicit amounts only. Dates, hours, capacity and bare numbers are never prices.
// One service per line/semicolon; optional quantity prefix and an explicit EUR/€ price suffix.
export function conceptosDesdeTexto(texto: string): ConceptoPresupuesto[] {
  return texto.split(/[\n;]+/).map(s => s.trim()).filter(Boolean).slice(0, 100).map(raw => {
    let descripcion = raw.replace(/^[-•]\s*/, '');
    let cantidad = 1;
    const qty = descripcion.match(/^(\d+(?:[.,]\d+)?)\s*[x×]\s*/i);
    if (qty) { cantidad = Number(qty[1].replace(',', '.')); descripcion = descripcion.slice(qty[0].length); }
    const price = descripcion.match(/(?:\s+|:\s*)(\d+(?:\.\d{3})*(?:,\d{1,2})?|\d+\.\d{1,2})\s*(?:€|EUR)(?:\s*(?:\/ud|por unidad|cada un[oa]))?\s*$/i);
    let precio: number | null = null;
    if (price) {
      const s = price[1];
      precio = Number(s.includes(',') ? s.replaceAll('.', '').replace(',', '.') : /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replaceAll('.', '') : s);
      descripcion = descripcion.slice(0, price.index).trim().replace(/(?:\s+(?:a|por)|[:—-])\s*$/i, '').trim();
    }
    return { id: crypto.randomUUID(), descripcion, cantidad, precio };
  });
}
export function validarPresupuesto(p: PresupuestoContenido, paraPdf = false): string | null {
  if (new TextEncoder().encode(JSON.stringify(p)).length > 480000) return 'El presupuesto contiene demasiado texto junto con la foto. Reduce las descripciones o retira la foto.';
  if (p.fotoMontaje && (!/^data:image\/jpeg;base64,/.test(p.fotoMontaje.dataUrl) || p.fotoMontaje.dataUrl.length > 280000 || !Number.isFinite(p.fotoMontaje.ancho) || !Number.isFinite(p.fotoMontaje.alto) || p.fotoMontaje.ancho <= 0 || p.fotoMontaje.alto <= 0)) return 'La foto del montaje no es válida. Vuelve a seleccionarla.';
  if (!p.titulo.trim()) return 'Escribe el título del presupuesto.';
  if (!p.fecha || !p.validez || p.validez < p.fecha) return 'La validez debe ser igual o posterior a la fecha del presupuesto.';
  if (!Number.isFinite(p.iva) || p.iva < 0 || p.iva > 100) return 'Revisa el porcentaje de IVA.';
  if (!p.conceptos.length || p.conceptos.length > 100) return 'Añade entre 1 y 100 conceptos.';
  for (const c of p.conceptos) {
    if (!c.descripcion.trim()) return 'Todos los conceptos necesitan una descripción.';
    if (!Number.isFinite(c.cantidad) || c.cantidad <= 0 || c.cantidad > 1000000) return 'Las cantidades deben ser mayores que cero y como máximo 1.000.000.';
    if (!Number.isFinite(c.descuento ?? 0) || (c.descuento ?? 0) < 0 || (!c.incluido && c.precio !== null && (c.descuento ?? 0) > c.precio)) return 'El descuento por unidad debe estar entre cero y el precio del concepto.';
    if (c.precio !== null && (!Number.isFinite(c.precio) || c.precio < 0 || c.precio > 10000000)) return 'Revisa los precios: deben estar entre 0 y 10.000.000 €.';
  }
  if (paraPdf || p.estado !== 'borrador') {
    if (!p.cliente.trim()) return 'Indica el cliente antes de finalizar el presupuesto.';
    if (p.conceptos.some(c => !c.incluido && c.precio === null)) return 'Completa los precios pendientes antes de finalizar el presupuesto.';
  }
  return null;
}
