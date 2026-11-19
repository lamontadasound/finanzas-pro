// Maquetación común de los contratos de La Montada en PDF (eventos, alquileres…):
// logo y franja marrón en cada página, texto justificado, títulos de cláusula,
// tablas sencillas, bloque de firmas y pie con referencia y número de página.
import { jsPDF } from 'jspdf';
import { BRAND_LOGO } from './brandLogo';

export const BLANCO = '____________________';
export const v = (s: string | number | undefined) => (String(s ?? '').trim() || BLANCO);
export const euros = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' } as Intl.NumberFormatOptions) + ' €';
export const fechaLarga = (iso: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
};

export interface EmisorContrato { razonSocial: string; nif: string; direccion: string }
export const parteMontada = (emisor: EmisorContrato, firmante: string) =>
  `De una parte, ${emisor.razonSocial || 'LA MONTADA SOUND, S.L.'}, con NIF ${emisor.nif || 'B21642913'} y domicilio en ${emisor.direccion || 'calle Portugalete 68, 28223 Pozuelo de Alarcón (Madrid)'}, representada por ${v(firmante)}, con facultades suficientes, en adelante, “La Montada”.`;

type RGB = readonly [number, number, number];
export const BROWN: RGB = [75, 56, 54];
const X = 26, W = 166, BOTTOM = 272;

export function nuevoDocContrato() {
  const d = new jsPDF({ compress: true });
  let y = 0;
  const header = () => {
    d.setFillColor(255, 255, 255); d.rect(0, 0, 210, 297, 'F');
    d.setFillColor(...BROWN); d.rect(8, 0, 1.7, 297, 'F');
    const size = 58 * 1563 / 1110;
    d.addImage(BRAND_LOGO, 'PNG', 21 - 228 * size / 1563, 12 - 703 * size / 1563, size, size);
    y = 46;
  };
  const next = () => { d.addPage(); header(); };
  const text = (value: string, opts: { bold?: boolean; size?: number; gap?: number; color?: RGB } = {}) => {
    const size = opts.size ?? 9.6;
    d.setFont('helvetica', opts.bold ? 'bold' : 'normal'); d.setFontSize(size); d.setTextColor(...(opts.color ?? [28, 28, 28] as const));
    const lh = size * 0.47;
    // Texto justificado: cada línea ocupa todo el ancho, salvo la última de
    // cada párrafo (o antes de un salto de línea), que va alineada a la izquierda.
    for (const parrafo of value.split('\n')) {
      const lines = d.splitTextToSize(parrafo, W) as string[];
      lines.forEach((line, i) => {
        if (y > BOTTOM) next();
        const words = line.trim().split(/\s+/);
        const last = i === lines.length - 1;
        if (last || words.length < 2) { d.text(line.trim(), X, y); }
        else {
          const libre = W - words.reduce((a, w) => a + d.getTextWidth(w), 0);
          const hueco = libre / (words.length - 1);
          let x = X;
          for (const w of words) { d.text(w, x, y); x += d.getTextWidth(w) + hueco; }
        }
        y += lh;
      });
    }
    y += opts.gap ?? 2.4;
  };
  const titulo = (t: string) => { if (y > BOTTOM - 22) next(); y += 1.5; text(t, { bold: true, size: 10, gap: 1.6, color: BROWN }); };

  /** Tabla con bordes finos; `anchos` en proporción. Repite la cabecera al saltar de página. */
  const tabla = (cabecera: string[], filas: string[][], anchos: number[], opts: { altoMin?: number } = {}) => {
    const suma = anchos.reduce((a, b) => a + b, 0);
    const cols = anchos.map((a) => (a / suma) * W);
    const pad = 1.6, size = 8.2, lh = size * 0.45;
    const celdas = (fila: string[], bold: boolean) => {
      d.setFont('helvetica', bold ? 'bold' : 'normal'); d.setFontSize(size);
      return fila.map((t, i) => d.splitTextToSize(t, cols[i] - pad * 2) as string[]);
    };
    const pinta = (fila: string[], bold: boolean) => {
      const ls = celdas(fila, bold);
      const alto = Math.max(opts.altoMin && !bold ? opts.altoMin : 0, Math.max(...ls.map((l) => l.length)) * lh + pad * 2);
      if (y + alto > BOTTOM + 6) { next(); if (!bold) pinta(cabecera, true); }
      d.setDrawColor(...BROWN); d.setLineWidth(0.2);
      if (bold) { d.setFillColor(244, 239, 236); d.rect(X, y, W, alto, 'F'); }
      let x = X;
      ls.forEach((l, i) => {
        d.rect(x, y, cols[i], alto);
        d.setFont('helvetica', bold ? 'bold' : 'normal'); d.setFontSize(size); d.setTextColor(...(bold ? BROWN : [28, 28, 28] as const));
        l.forEach((t, j) => d.text(t, x + pad, y + pad + lh * (j + 0.78)));
        x += cols[i];
      });
      y += alto;
    };
    if (y > BOTTOM - 20) next();
    pinta(cabecera, true);
    filas.forEach((f) => pinta(f, false));
    y += 3.5;
  };

  /** Dos líneas de firma con el nombre debajo. */
  const firmas = (izq: [string, string], der: [string, string], gap = 18) => {
    y += gap;
    if (y > BOTTOM - 4) { next(); y += gap; }
    d.setDrawColor(...BROWN); d.setLineWidth(0.2); d.line(X, y, X + 70, y); d.line(X + 95, y, X + 165, y); y += 5.5;
    d.setFont('helvetica', 'bold'); d.setFontSize(9); d.setTextColor(28, 28, 28);
    d.text(izq[0], X, y); d.text(der[0], X + 95, y); y += 4.6;
    d.setFont('helvetica', 'normal');
    d.text((d.splitTextToSize(izq[1], 70) as string[])[0], X, y); d.text((d.splitTextToSize(der[1], 70) as string[])[0], X + 95, y);
    y += 6;
  };

  const pie = () => {
    const n = d.getNumberOfPages();
    for (let p = 1; p <= n; p++) {
      d.setPage(p); d.setFont('helvetica', 'normal'); d.setFontSize(8); d.setTextColor(...BROWN);
      d.text(`${p} / ${n}`, X, 288);
    }
  };

  header();
  return {
    d, text, titulo, tabla, firmas, pie, next,
    get y() { return y; }, set y(n: number) { y = n; },
    BOTTOM,
  };
}

const BANCOS: Record<string, string> = {
  '2100': 'CaixaBank', '2038': 'CaixaBank', '0049': 'Banco Santander', '0030': 'Banco Santander', '0182': 'BBVA',
  '0081': 'Banco Sabadell', '0128': 'Bankinter', '1465': 'ING', '0073': 'Openbank', '2085': 'Ibercaja',
  '3058': 'Cajamar', '0239': 'EVO Banco', '2095': 'Kutxabank', '0487': 'Banco Mare Nostrum', '0238': 'Banco Pastor',
  '0019': 'Deutsche Bank', '1491': 'Triodos Bank', '0186': 'Banco Mediolanum', '3025': 'Caixa d\'Enginyers',
  '2080': 'Abanca', '3035': 'Laboral Kutxa', '0061': 'Banca March', '0234': 'Banco Caminos', '1583': 'Revolut',
};
/** Banco a partir de un IBAN español (código de entidad). */
export const bancoDeIban = (iban?: string) => {
  const limpio = (iban ?? '').replace(/\s+/g, '').toUpperCase();
  return /^ES\d{6}/.test(limpio) ? BANCOS[limpio.slice(4, 8)] ?? '' : '';
};
