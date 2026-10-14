// ── Previsión fiscal a partir de las FACTURAS ───────────────────────────────
// Solo cuenta lo que está en el apartado Facturas: facturas emitidas
// (creadas en la app o archivadas en Drive) y facturas de gasto archivadas en
// Drive. Es una estimación para tener una idea; la liquidación la hace el
// gestor.
import type { Factura, Ingreso } from '../types';
import type { DriveExpense } from './driveExpenses';

export type Trimestre = 1 | 2 | 3 | 4;
export const TRIMESTRES: Trimestre[] = [1, 2, 3, 4];
export const trimestreDeMes = (mes1a12: number): Trimestre => (Math.floor((mes1a12 - 1) / 3) + 1) as Trimestre;

export interface FacturaFiscal {
  id: string;
  tipo: 'ingreso' | 'gasto';
  numero: string;
  nombre: string;
  anio: number;
  mes: number; // 1-12
  base: number;
  iva: number;
  origen: 'app' | 'drive';
}

export interface DriveIncomeFile { id: string; nombre: string; numero: number | string | null; anio: number; mes: number }

const norm = (n: unknown) => String(n ?? '').trim().replace(/^0+/, '').toLocaleUpperCase('es');
/** "77 y 82", "36 y EFE", "84" → ["77","82"], ["36"], ["84"] (solo números). */
export const numerosDeIngreso = (numero?: string) =>
  (numero ?? '').split(/[\s,;/y]+/i).map(norm).filter((n) => /^\d+$/.test(n));

const fechaPartes = (fecha: string) => {
  const d = new Date(fecha);
  return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
};

/**
 * Reúne todas las facturas con importe. Devuelve también las que no tienen
 * importe conocido para que se puedan revisar.
 */
export function facturasFiscales(
  facturasApp: Factura[], driveIngresos: DriveIncomeFile[], ingresos: Ingreso[], driveGastos: DriveExpense[],
) {
  const out: FacturaFiscal[] = [];
  const sinImporte: { id: string; nombre: string; tipo: 'ingreso' | 'gasto'; anio: number; mes: number }[] = [];

  // 1. Facturas creadas en la app (emitidas y de gasto); nunca borradores ni anuladas.
  const numerosApp = new Set<string>();
  for (const f of facturasApp) {
    if (f.estado === 'borrador' || f.estado === 'anulada' || f.ocultaEn) continue;
    if (f.tipo === 'emitida' && f.numeroSecuencial == null) continue;
    const { anio, mes } = fechaPartes(f.fecha);
    if (f.tipo === 'emitida') numerosApp.add(norm(f.numero));
    out.push({
      id: f.id, tipo: f.tipo === 'emitida' ? 'ingreso' : 'gasto', numero: f.numero, nombre: f.tipo === 'emitida' ? f.cliente : (f.proveedor || f.cliente),
      anio, mes, base: f.baseImponible, iva: f.importeIVA, origen: 'app',
    });
  }

  // 2. Facturas emitidas archivadas en Drive: el importe sale del ingreso con
  //    ese número. Si un ingreso lleva varios números, se reparte a partes iguales.
  const porNumero = new Map<string, { base: number; iva: number }>();
  for (const i of ingresos) {
    const nums = numerosDeIngreso(i.numeroFactura);
    for (const n of nums) {
      const cur = porNumero.get(n) ?? { base: 0, iva: 0 };
      porNumero.set(n, { base: cur.base + i.baseImponible / nums.length, iva: cur.iva + i.importeIVA / nums.length });
    }
  }
  for (const d of driveIngresos) {
    const n = norm(d.numero);
    if (n && numerosApp.has(n)) continue; // ya contada desde la app
    const imp = n ? porNumero.get(n) : undefined;
    if (!imp) { sinImporte.push({ id: d.id, nombre: d.nombre, tipo: 'ingreso', anio: d.anio, mes: d.mes }); continue; }
    out.push({ id: d.id, tipo: 'ingreso', numero: n, nombre: d.nombre, anio: d.anio, mes: d.mes, base: imp.base, iva: imp.iva, origen: 'drive' });
  }

  // 3. Facturas de gasto archivadas en Drive con importe leído.
  for (const g of driveGastos) {
    if (g.estado === 'excluido') continue;
    if (g.estado !== 'leido' || !g.amount) { sinImporte.push({ id: g.id, nombre: g.nombre, tipo: 'gasto', anio: g.anio, mes: g.mes }); continue; }
    const fecha = g.amount.fecha_factura ? fechaPartes(g.amount.fecha_factura) : { anio: g.anio, mes: g.mes };
    out.push({
      id: g.id, tipo: 'gasto', numero: g.amount.numero_factura, nombre: g.amount.proveedor || g.nombre,
      anio: fecha.anio, mes: fecha.mes, base: Number(g.amount.base ?? 0), iva: Number(g.amount.iva ?? 0), origen: 'drive',
    });
  }
  return { facturas: out, sinImporte };
}

export interface Periodo {
  ingresosBase: number;
  ivaFacturado: number;
  gastosBase: number;
  ivaDesgravado: number;
  ivaResultado: number;
  beneficio: number;
  nIngresos: number;
  nGastos: number;
}

/** Totales de un año completo (q omitido) o de un trimestre. */
export function resumenPeriodo(facturas: FacturaFiscal[], anio: number, q?: Trimestre): Periodo {
  const sel = facturas.filter((f) => f.anio === anio && (!q || trimestreDeMes(f.mes) === q));
  const ing = sel.filter((f) => f.tipo === 'ingreso');
  const gas = sel.filter((f) => f.tipo === 'gasto');
  const sum = (xs: FacturaFiscal[], k: 'base' | 'iva') => Math.round(xs.reduce((a, f) => a + f[k], 0) * 100) / 100;
  const ivaFacturado = sum(ing, 'iva');
  const ivaDesgravado = sum(gas, 'iva');
  return {
    ingresosBase: sum(ing, 'base'), ivaFacturado,
    gastosBase: sum(gas, 'base'), ivaDesgravado,
    ivaResultado: ivaFacturado - ivaDesgravado,
    beneficio: sum(ing, 'base') - sum(gas, 'base'),
    nIngresos: ing.length, nGastos: gas.length,
  };
}

// ── Impuesto de Sociedades ──────────────────────────────────────────────────
export type RegimenIS = 'micro' | 'pyme' | 'general' | 'nueva';
export const REGIMEN_IS_LABEL: Record<RegimenIS, string> = {
  micro: 'Microempresa',
  pyme: 'Empresa pequeña',
  general: 'General 25 %',
  nueva: 'Empresa nueva 15 %',
};

/** Tipos según la reforma de 2025 (Ley 7/2024), con su calendario transitorio. */
export function cuotaIS(base: number, regimen: RegimenIS, year: number): number {
  if (base <= 0) return 0;
  if (regimen === 'general') return base * 0.25;
  if (regimen === 'nueva') return base * 0.15;
  if (regimen === 'pyme') {
    const tipo = year <= 2025 ? 0.24 : year === 2026 ? 0.23 : year === 2027 ? 0.22 : year === 2028 ? 0.21 : 0.2;
    return base * tipo;
  }
  const [t1, t2] = year <= 2025 ? [0.21, 0.22] : year === 2026 ? [0.19, 0.21] : [0.17, 0.2];
  return Math.min(base, 50000) * t1 + Math.max(0, base - 50000) * t2;
}
