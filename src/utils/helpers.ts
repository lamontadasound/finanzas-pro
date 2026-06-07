import { format, parseISO, getYear, getMonth, getQuarter, isWithinInterval } from 'date-fns';
import { useState, useMemo, useEffect } from 'react';
import { es } from 'date-fns/locale';
import type { Ingreso, Gasto } from '../types';

export const fmt = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n);

export const fmtShort = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

export const fmtDate = (d: string) => {
  try { return format(parseISO(d), 'dd/MM/yyyy', { locale: es }); } catch { return d; }
};

export const getMonthNum = (fecha: string): number => {
  try { return getMonth(parseISO(fecha)) + 1; } catch { return 0; }
};

export const getYearNum = (fecha: string): number => {
  try { return getYear(parseISO(fecha)); } catch { return 0; }
};

export const getMonthName = (num: number): string =>
  ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][num - 1] || '';

export const MONTHS = Array.from({ length: 12 }, (_, i) => ({ num: i + 1, label: getMonthName(i + 1) }));

export const getAvailableYears = (items: { fecha?: string; fechaEvento?: string; fechaCompra?: string }[]): number[] => {
  const years = new Set<number>();
  items.forEach((item) => {
    const d = (item as any).fecha || (item as any).fechaEvento || (item as any).fechaCompra;
    if (d) {
      try { years.add(getYear(parseISO(d))); } catch { /* ignore */ }
    }
  });
  const result = Array.from(years).sort((a, b) => b - a);
  if (result.length === 0) result.push(new Date().getFullYear());
  return result;
};

export type PeriodType = 'month' | 'quarter' | 'year' | 'custom' | 'all';

export interface PeriodFilter {
  type: PeriodType;
  year: number;
  month?: number;
  quarter?: number;
  from?: string;
  to?: string;
}

export const filterByPeriod = <T extends { fecha?: string; fechaEvento?: string }>(
  items: T[],
  filter: PeriodFilter
): T[] => {
  if (filter.type === 'all') return items;
  return items.filter((item) => {
    const dateStr = (item as any).fecha || (item as any).fechaEvento || '';
    if (!dateStr) return false;
    try {
      const d = parseISO(dateStr);
      const y = filter.year;
      if (filter.type === 'year') return getYear(d) === y;
      if (filter.type === 'quarter') return getYear(d) === y && getQuarter(d) === filter.quarter;
      if (filter.type === 'month') return getYear(d) === y && getMonth(d) + 1 === filter.month;
      if (filter.type === 'custom' && filter.from && filter.to) {
        return isWithinInterval(d, { start: parseISO(filter.from), end: parseISO(filter.to) });
      }
    } catch { return false; }
    return false;
  });
};

export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

// Resumen mensual — usa baseImponible para todos los cálculos financieros
export const buildMonthlyTable = (
  ingresos: Ingreso[],
  gastos: Gasto[],
  year: number
) => {
  return MONTHS.map(({ num, label }) => {
    const mis = ingresos.filter((i) => getYear(parseISO(i.fechaEvento)) === year && getMonth(parseISO(i.fechaEvento)) + 1 === num);
    const mgs = gastos.filter((g) => getYear(parseISO(g.fecha)) === year && getMonth(parseISO(g.fecha)) + 1 === num);
    const ing = mis.reduce((s, i) => s + i.baseImponible, 0);
    const gFijo = mgs.filter((g) => g.tipo === 'fijo').reduce((s, g) => s + g.baseImponible, 0);
    const gVar = mgs.filter((g) => g.tipo === 'variable').reduce((s, g) => s + g.baseImponible, 0);
    const gTotal = gFijo + gVar;
    const balance = ing - gTotal;
    const ivaRep = mis.reduce((s, i) => s + i.importeIVA, 0);
    const ivaSop = mgs.filter((g) => g.deducible).reduce((s, g) => s + g.importeIVA, 0);
    return { num, label, ing, gFijo, gVar, gTotal, balance, ivaRep, ivaSop };
  });
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  boda: 'Boda',
  real_madrid: 'Real Madrid',
  alquiler: 'Alquiler',
  evento_privado: 'Evento Privado',
  dj_personal: 'DJ Personal',
  empresa: 'Empresa',
  otro: 'Otro',
};

export const EVENT_TYPE_COLORS: Record<string, string> = {
  boda: 'bg-pink-500/10 text-pink-400',
  real_madrid: 'bg-gold-500/10 text-gold-400',
  alquiler: 'bg-blue-500/10 text-blue-400',
  empresa: 'bg-green-500/10 text-green-400',
  dj_personal: 'bg-purple-500/10 text-purple-400',
  evento_privado: 'bg-orange-500/10 text-orange-400',
  otro: 'bg-zinc-500/10 text-zinc-400',
};

export const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  realizado: 'Realizado',
  cobrado: 'Cobrado',
  facturado: 'Facturado',
};

export const STATUS_COLORS: Record<string, string> = {
  pendiente: 'text-yellow-400 bg-yellow-400/10',
  confirmado: 'text-blue-400 bg-blue-400/10',
  realizado: 'text-purple-400 bg-purple-400/10',
  cobrado: 'text-green-400 bg-green-400/10',
  facturado: 'text-gold-400 bg-gold-400/10',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  parcial: 'Parcial',
  pagado: 'Pagado',
};

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pendiente: 'text-red-400 bg-red-400/10',
  parcial: 'text-yellow-400 bg-yellow-400/10',
  pagado: 'text-green-400 bg-green-400/10',
};

export const GASTO_CATEGORIAS: string[] = [
  'Personal','Transporte','Gasolina','Dietas','Alquiler externo',
  'Técnico','Material','Hotel','Autónomos','Gestoría','Almacén',
  'Seguros','Software','Comunicaciones','Publicidad','Otros',
];

export const METODO_PAGO_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  cheque: 'Cheque',
  otro: 'Otro',
};

// Centralised IVA calculation — used by all pages
export const calcIVA = (base: number, pct: number) => ({
  importeIVA: +(base * pct / 100).toFixed(2),
  total: +(base * (1 + pct / 100)).toFixed(2),
});

// Shared year+month navigation hook
export const useYearMonth = (items: { fecha?: string; fechaEvento?: string }[]) => {
  const years = useMemo(() => {
    const ys = getAvailableYears(items);
    return ys.length ? ys : [new Date().getFullYear()];
  }, [items]);

  const [year, setYear] = useState(() => years[0]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  // Sync year when the available years list changes (e.g. first entry added)
  useEffect(() => {
    if (!years.includes(year)) setYear(years[0]);
  }, [years, year]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  return { year, setYear, month, setMonth, prevMonth, nextMonth, years };
};
