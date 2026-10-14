import { describe, expect, it } from 'vitest';
import { facturasFiscales, resumenPeriodo, cuotaIS, numerosDeIngreso } from './previsionFiscal';
import type { Factura, Ingreso } from '../types';
import type { DriveExpense } from './driveExpenses';

const ing = (p: Partial<Ingreso>): Ingreso => ({
  id: Math.random().toString(), area: 'montada', concepto: 'x', cliente: 'c', empresa: false, tipoEvento: 'Boda',
  fechaEvento: '2026-02-10', baseImponible: 1000, porcentajeIVA: 21, importeIVA: 210, total: 1210,
  metodoPago: 'transferencia', estadoPago: 'pendiente', pagosRecibidos: 0, facturaEmitida: true, createdAt: '', ...p,
});
const fac = (p: Partial<Factura>): Factura => ({
  id: Math.random().toString(), area: 'montada', tipo: 'emitida', numero: '90', cliente: 'Cliente', concepto: '',
  baseImponible: 500, porcentajeIVA: 21, importeIVA: 105, total: 605, fecha: '2026-10-05', pagada: false, ivaDeducible: true,
  numeroSecuencial: 90, estado: 'emitida', ...p,
} as Factura);
const gasto = (estado: DriveExpense['estado'], base = 100, iva = 21): DriveExpense => ({
  id: Math.random().toString(), nombre: 'Gasto.pdf', anio: 2026, mes: 2, url: '', actualizado_en: null, sincronizado_en: '', estado,
  amount: { file_id: '', source_modified_at: null, estado: 'leido', proveedor: 'Prov', numero_factura: 'A1', fecha_factura: '2026-02-03', base, iva, total: base + iva, retencion: 0, nota: '' },
});

describe('previsión desde facturas', () => {
  it('separa números de factura de un ingreso', () => {
    expect(numerosDeIngreso('77 y 82')).toEqual(['77', '82']);
    expect(numerosDeIngreso('36 y EFE')).toEqual(['36']);
    expect(numerosDeIngreso(undefined)).toEqual([]);
  });

  it('suma facturas de la app y de Drive sin duplicar, y lista las que no tienen importe', () => {
    const { facturas, sinImporte } = facturasFiscales(
      [fac({}), fac({ numero: '91', estado: 'borrador' }), fac({ numero: '92', estado: 'anulada' })],
      [
        { id: 'd90', nombre: 'Factura 90.pdf', numero: 90, anio: 2026, mes: 10 },
        { id: 'd10', nombre: 'Factura 10.pdf', numero: 10, anio: 2026, mes: 2 },
        { id: 'd11', nombre: 'Factura 11.pdf', numero: 11, anio: 2026, mes: 2 },
      ],
      [ing({ numeroFactura: '10' })],
      [gasto('leido'), gasto('pendiente'), gasto('excluido')],
    );
    expect(facturas.filter((f) => f.tipo === 'ingreso').map((f) => f.numero).sort()).toEqual(['10', '90']);
    expect(sinImporte.map((s) => s.id)).toContain('d11');
    expect(sinImporte.filter((s) => s.tipo === 'gasto')).toHaveLength(1);

    const t1 = resumenPeriodo(facturas, 2026, 1);
    expect(t1.ivaFacturado).toBe(210);
    expect(t1.ivaDesgravado).toBe(21);
    expect(t1.ivaResultado).toBe(189);
    expect(t1.beneficio).toBe(900);
    const anio = resumenPeriodo(facturas, 2026);
    expect(anio.ingresosBase).toBe(1500);
  });

  it('reparte un ingreso con dos facturas a partes iguales', () => {
    const { facturas } = facturasFiscales([], [
      { id: 'a', nombre: 'F77', numero: 77, anio: 2026, mes: 9 },
      { id: 'b', nombre: 'F82', numero: 82, anio: 2026, mes: 9 },
    ], [ing({ numeroFactura: '77 y 82' })], []);
    expect(facturas.map((f) => f.base)).toEqual([500, 500]);
  });

  it('cuota de Sociedades por régimen', () => {
    expect(cuotaIS(-100, 'general', 2026)).toBe(0);
    expect(cuotaIS(100000, 'general', 2026)).toBe(25000);
    expect(cuotaIS(100000, 'micro', 2026)).toBeCloseTo(50000 * 0.19 + 50000 * 0.21);
    expect(cuotaIS(10000, 'nueva', 2026)).toBe(1500);
    expect(cuotaIS(10000, 'pyme', 2026)).toBeCloseTo(2300);
  });
});
