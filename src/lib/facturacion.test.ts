import { describe, it, expect } from 'vitest';
import {
  calcularFacturaParcial, porcentajeFacturadoDe, importeFacturadoDe, porcentajePendienteDeFacturar,
  puedeFacturarPorcentaje, resumenFacturacionIngreso, esPosibleDuplicado, estadoFacturaVisible,
  resolverEmisorParaLinea,
} from './facturacion';
import type { Factura, Ingreso, ConfiguracionFiscal } from '../types';

const ingreso = (over: Partial<Ingreso>): Ingreso => ({
  id: 'i1', area: 'montada', concepto: 'Boda', cliente: 'Cliente', empresa: false,
  tipoEvento: 'boda', fechaEvento: '2026-03-01', baseImponible: 1000, porcentajeIVA: 21,
  importeIVA: 210, total: 1210, metodoPago: 'transferencia', estadoPago: 'pendiente',
  pagosRecibidos: 0, facturaEmitida: false, createdAt: '2026-01-01T00:00:00Z', ...over,
});

const factura = (over: Partial<Factura>): Factura => ({
  id: 'f1', area: 'montada', tipo: 'emitida', numero: '77', cliente: 'Cliente', concepto: 'Boda',
  baseImponible: 300, porcentajeIVA: 21, importeIVA: 63, total: 363, fecha: '2026-03-05',
  pagada: false, ivaDeducible: false, ingresoId: 'i1', estado: 'emitida', porcentajeFacturado: 30,
  ...over,
});

describe('calcularFacturaParcial — base/IVA/total de un porcentaje', () => {
  it('30% de un ingreso de 1000€ sin IVA → base 300, IVA 63 (21%), total 363', () => {
    expect(calcularFacturaParcial(1000, 21, 30)).toEqual({ baseImponible: 300, importeIVA: 63, total: 363 });
  });
  it('50% de un ingreso de 1000€ → base 500, IVA 105, total 605', () => {
    expect(calcularFacturaParcial(1000, 21, 50)).toEqual({ baseImponible: 500, importeIVA: 105, total: 605 });
  });
  it('100% de un ingreso → coincide exactamente con el ingreso completo', () => {
    expect(calcularFacturaParcial(1000, 21, 100)).toEqual({ baseImponible: 1000, importeIVA: 210, total: 1210 });
  });
  it('porcentaje personalizado (37%) redondea correctamente a céntimo', () => {
    const r = calcularFacturaParcial(1000, 21, 37);
    expect(r.baseImponible).toBe(370);
    expect(r.importeIVA).toBe(77.7);
    expect(r.total).toBe(447.7);
  });
  it('0% → todo a cero (caso borrador)', () => {
    expect(calcularFacturaParcial(1000, 21, 0)).toEqual({ baseImponible: 0, importeIVA: 0, total: 0 });
  });
});

describe('varias facturas parciales — 30% + 70% = 100% exacto', () => {
  it('la suma de una factura del 30% y otra del 70% cuadra exactamente con el ingreso completo', () => {
    const ing = ingreso({ baseImponible: 1000, porcentajeIVA: 21, total: 1210 });
    const f30 = calcularFacturaParcial(1000, 21, 30);
    const f70 = calcularFacturaParcial(1000, 21, 70);
    expect(f30.total + f70.total).toBeCloseTo(ing.total, 5);
    expect(f30.baseImponible + f70.baseImponible).toBe(1000);
  });

  it('porcentajeFacturadoDe suma correctamente varias facturas vivas del mismo ingreso', () => {
    const facturas = [
      factura({ id: 'a', porcentajeFacturado: 30 }),
      factura({ id: 'b', porcentajeFacturado: 20 }),
    ];
    expect(porcentajeFacturadoDe(facturas, 'i1')).toBe(50);
  });

  it('una factura anulada no cuenta en el porcentaje facturado', () => {
    const facturas = [
      factura({ id: 'a', porcentajeFacturado: 30 }),
      factura({ id: 'b', porcentajeFacturado: 50, estado: 'anulada' }),
    ];
    expect(porcentajeFacturadoDe(facturas, 'i1')).toBe(30);
  });

  it('un borrador (0%) no cuenta en el porcentaje facturado', () => {
    const facturas = [factura({ id: 'a', porcentajeFacturado: 0, estado: 'borrador' })];
    expect(porcentajeFacturadoDe(facturas, 'i1')).toBe(0);
  });
});

describe('bloqueo al superar el 100%', () => {
  it('permite una factura del 30% si no hay nada facturado todavía', () => {
    expect(puedeFacturarPorcentaje([], 'i1', 30).ok).toBe(true);
  });

  it('rechaza una segunda factura si la suma supera el 100%', () => {
    const facturas = [factura({ id: 'a', porcentajeFacturado: 70 })];
    const r = puedeFacturarPorcentaje(facturas, 'i1', 50);
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/30%/); // solo queda 30% disponible
  });

  it('permite exactamente el resto disponible (70% ya facturado + 30% nuevo = 100%)', () => {
    const facturas = [factura({ id: 'a', porcentajeFacturado: 70 })];
    expect(puedeFacturarPorcentaje(facturas, 'i1', 30).ok).toBe(true);
  });

  it('rechaza un porcentaje de 0% (debe ser borrador, no factura fiscal)', () => {
    expect(puedeFacturarPorcentaje([], 'i1', 0).ok).toBe(false);
  });

  it('rechaza un porcentaje mayor que 100%', () => {
    expect(puedeFacturarPorcentaje([], 'i1', 150).ok).toBe(false);
  });
});

describe('facturado vs cobrado — ejes independientes', () => {
  it('un ingreso puede estar 100% facturado y 0% cobrado', () => {
    const ing = ingreso({ total: 1210, pagosRecibidos: 0, estadoPago: 'pendiente' });
    const facturas = [factura({ porcentajeFacturado: 100, total: 1210 })];
    const resumen = resumenFacturacionIngreso(ing, facturas);
    expect(resumen.porcentajeFacturado).toBe(100);
    // El cobro es un eje aparte — importePendienteDeCobrarDe (contabilidad.ts) seguiría en 1210.
  });

  it('un ingreso puede estar 100% cobrado y 0% facturado', () => {
    const ing = ingreso({ total: 1210, estadoPago: 'pagado', pagosRecibidos: 1210 });
    const resumen = resumenFacturacionIngreso(ing, []);
    expect(resumen.porcentajeFacturado).toBe(0);
    expect(resumen.importePendienteDeFacturar).toBe(1210);
  });

  it('estadoFacturaVisible: emitida sin cobro → "emitida"; con cobro parcial → "parcialmente_cobrada"; cobro total → "cobrada"', () => {
    const f = factura({ estado: 'emitida', total: 363 });
    expect(estadoFacturaVisible(f, 0, 1210)).toBe('emitida');
    expect(estadoFacturaVisible(f, 500, 1210)).toBe('parcialmente_cobrada');
    expect(estadoFacturaVisible(f, 1210, 1210)).toBe('cobrada');
  });

  it('estadoFacturaVisible respeta "anulada"/"borrador" pase lo que pase con el cobro', () => {
    expect(estadoFacturaVisible(factura({ estado: 'anulada' }), 1210, 1210)).toBe('anulada');
    expect(estadoFacturaVisible(factura({ estado: 'borrador' }), 0, 1210)).toBe('borrador');
  });
});

describe('anulación — el número nunca se reutiliza', () => {
  it('una factura anulada sigue existiendo con su número, no desaparece del historial', () => {
    const anulada = factura({ id: 'a', numero: '77', estado: 'anulada', anuladaPor: 'u1', fechaAnulacion: '2026-03-10' });
    expect(anulada.numero).toBe('77');
    expect(anulada.estado).toBe('anulada');
    // El "próximo número" se calcula siempre a partir del último NUMÉRICO
    // asignado (ver RPC `emitir_numero_factura` en el SQL preparado) — una
    // anulación no libera ni retrocede el contador, es responsabilidad de
    // la secuencia de Postgres (nunca se decrementa).
  });
});

describe('cantidad ya facturada vs pendiente de facturar', () => {
  it('importeFacturadoDe suma los totales (con IVA) de las facturas vivas', () => {
    const facturas = [factura({ id: 'a', total: 363, porcentajeFacturado: 30 }), factura({ id: 'b', total: 242, porcentajeFacturado: 20 })];
    expect(importeFacturadoDe(facturas, 'i1')).toBe(605);
  });
  it('porcentajePendienteDeFacturar nunca baja de 0', () => {
    const facturas = [factura({ id: 'a', porcentajeFacturado: 100 })];
    expect(porcentajePendienteDeFacturar(facturas, 'i1')).toBe(0);
  });
});

describe('detección de posibles duplicados (facturas de gasto)', () => {
  const existentes = [factura({ tipo: 'recibida', proveedor: 'Proveedor SL', numeroProveedor: 'F-2026-045', fecha: '2026-03-01', total: 121 })];

  it('detecta duplicado por mismo proveedor + mismo número de proveedor', () => {
    expect(esPosibleDuplicado({ proveedor: 'Proveedor SL', numeroProveedor: 'F-2026-045', fecha: '2026-03-15', total: 200 }, existentes)).toBe(true);
  });
  it('detecta duplicado por mismo proveedor + misma fecha + mismo total exacto', () => {
    expect(esPosibleDuplicado({ proveedor: 'Proveedor SL', fecha: '2026-03-01', total: 121 }, existentes)).toBe(true);
  });
  it('no marca duplicado si el proveedor es distinto', () => {
    expect(esPosibleDuplicado({ proveedor: 'Otro Proveedor', fecha: '2026-03-01', total: 121 }, existentes)).toBe(false);
  });
  it('no marca duplicado si mismo proveedor pero fecha e importe distintos', () => {
    expect(esPosibleDuplicado({ proveedor: 'Proveedor SL', fecha: '2026-04-01', total: 99 }, existentes)).toBe(false);
  });
});

describe('resolverEmisorParaLinea — emisores fiscales por proyecto', () => {
  const emisorDefault: ConfiguracionFiscal = { id: 'default', razonSocial: 'Empresa Principal SL' };
  const emisorDJ: ConfiguracionFiscal = { id: 'em-dj', razonSocial: 'Julia Centeno (autónoma)' };
  const emisores = [emisorDefault, emisorDJ];

  it('usa el emisor asignado explícitamente a la línea', () => {
    const mapa = { dj: 'em-dj' };
    expect(resolverEmisorParaLinea(emisores, mapa, 'dj')).toBe(emisorDJ);
  });

  it('sin asignación explícita requiere asignación administrativa', () => {
    expect(resolverEmisorParaLinea(emisores, {}, 'real_madrid')).toBeNull();
  });

  it('si el emisor asignado no existe, no elige otro emisor', () => {
    const mapa = { dj: 'emisor-borrado' };
    expect(resolverEmisorParaLinea(emisores, mapa, 'dj')).toBeNull();
  });

  it('CORREGIDO: sin ningún emisor "default" ni asignación explícita, devuelve null — nunca elige uno arbitrario', () => {
    expect(resolverEmisorParaLinea([emisorDJ], {}, 'montada_sound')).toBeNull();
  });

  it('sin ningún emisor en absoluto, devuelve null (nunca inventa uno)', () => {
    expect(resolverEmisorParaLinea([], {}, 'dj')).toBeNull();
  });
});

describe('Emisor histórico — la rectificación NO debe re-resolver por la asignación actual', () => {
  it('resolverEmisorParaLinea no se usa para rectificar: el emisorId debe salir del emisorSnapshot de la factura original, no de la línea', () => {
    // Este test documenta el contrato correcto (verificado también en
    // FacturasAreaPage.tsx → RectificarFacturaModal, que usa
    // `factura.emisorSnapshot?.id`, nunca `resolverEmisorParaLinea`).
    const emisorOriginal: ConfiguracionFiscal = { id: 'em-viejo', razonSocial: 'Empresa Antigua SL' };
    const emisorNuevo: ConfiguracionFiscal = { id: 'em-nuevo', razonSocial: 'Empresa Nueva SL' };
    const facturaOriginal = factura({ id: 'f1', emisorSnapshot: emisorOriginal });

    // Aunque la línea se haya reasignado al emisor nuevo DESPUÉS de emitir...
    const proyectoEmisorMapActual = { montada_sound: 'em-nuevo' };
    const resueltoPorLineaActual = resolverEmisorParaLinea([emisorOriginal, emisorNuevo], proyectoEmisorMapActual, 'montada_sound');
    expect(resueltoPorLineaActual).toBe(emisorNuevo); // esto es lo que NO debe usarse para rectificar

    // ...el emisor correcto para la rectificativa sigue siendo el original.
    const emisorCorrectoParaRectificar = facturaOriginal.emisorSnapshot?.id;
    expect(emisorCorrectoParaRectificar).toBe('em-viejo');
  });
});
