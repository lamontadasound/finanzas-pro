// ── Ejemplos numéricos verificados — rectificación de facturas ─────────────
// Responden directamente a la duda planteada: "excluir la original y sumar
// además una rectificativa puede producir un resultado incorrecto". Se
// verifica con números concretos que NO es así, siempre que la
// rectificativa lleve su propio `porcentajeFacturado`/`total` correctos —
// que es exactamente el bug que se corrigió en
// `crear_factura_rectificativa` (antes no lo fijaba, quedaba en 0).
//
// Estas pruebas ejercitan las funciones REALES de `lib/facturacion.ts`
// sobre datos que simulan el estado de la tabla `facturas` TRAS ejecutar el
// RPC ya corregido — no sustituyen una prueba de integración contra
// Postgres, pero prueban que la lógica de agregación del lado del cliente
// (y el resultado esperado del lado del servidor) son correctos.
import { describe, it, expect } from 'vitest';
import { porcentajeFacturadoDe, importeFacturadoDe, resumenFacturacionIngreso, puedeFacturarPorcentaje } from './facturacion';
import type { Factura, Ingreso } from '../types';

const ingreso = (over: Partial<Ingreso> = {}): Ingreso => ({
  id: 'ing1', area: 'montada', concepto: 'Boda', cliente: 'Cliente', empresa: false,
  tipoEvento: 'boda', fechaEvento: '2026-03-01', baseImponible: 1000, porcentajeIVA: 21,
  importeIVA: 210, total: 1210, metodoPago: 'transferencia', estadoPago: 'pendiente',
  pagosRecibidos: 0, facturaEmitida: true, createdAt: '2026-01-01T00:00:00Z', ...over,
});

const factura = (over: Partial<Factura>): Factura => ({
  id: 'f', area: 'montada', tipo: 'emitida', numero: '1', cliente: 'Cliente', concepto: 'x',
  baseImponible: 0, porcentajeIVA: 21, importeIVA: 0, total: 0, fecha: '2026-03-05',
  pagada: false, ivaDeducible: false, ingresoId: 'ing1', ...over,
});

describe('Rectificación TOTAL — factura del 100% (1210€) anulada por completo', () => {
  it('tras rectificar a 0€/0%, el ingreso queda con 0% facturado y 0€ facturado — no arrastra el importe original', () => {
    const original = factura({ id: 'f1', estado: 'anulada', porcentajeFacturado: 100, total: 1210 });
    // Rectificativa emitida por el RPC ya corregido: 0%, 0€ (anulación total).
    const rectificativa = factura({ id: 'f1r', estado: 'pendiente_sincronizar', porcentajeFacturado: 0, total: 0, facturaRectificaId: 'f1' });
    const facturas = [original, rectificativa];

    expect(porcentajeFacturadoDe(facturas, 'ing1')).toBe(0); // NO queda "100% menos 100%" mal calculado, ni tampoco sigue en 100%
    expect(importeFacturadoDe(facturas, 'ing1')).toBe(0);

    const resumen = resumenFacturacionIngreso(ingreso(), facturas);
    expect(resumen.porcentajeFacturado).toBe(0);
    expect(resumen.porcentajePendiente).toBe(100); // vuelve a estar disponible para facturar de nuevo, correcto tras una anulación total
    expect(resumen.importePendienteDeFacturar).toBe(1210);
  });
});

describe('Rectificación PARCIAL — de 50% (605€) se corrige a 40% (484€)', () => {
  it('el ingreso queda facturado al 40%, NO al 0% (bug corregido) ni al 90% (doble cómputo)', () => {
    const original = factura({ id: 'f1', estado: 'anulada', porcentajeFacturado: 50, total: 605, baseImponible: 500, importeIVA: 105 });
    // Rectificativa CON su propio porcentaje correcto — 40% del ingreso, 484€.
    const rectificativa = factura({
      id: 'f1r', estado: 'pendiente_sincronizar', porcentajeFacturado: 40,
      baseImponible: 400, importeIVA: 84, total: 484, facturaRectificaId: 'f1',
    });
    const facturas = [original, rectificativa];

    // NI 0% (el bug: la rectificativa contaba 0 porque no llevaba porcentaje)
    // NI 90% (el temor: sumar 50 - (-40) o no excluir bien la original)
    expect(porcentajeFacturadoDe(facturas, 'ing1')).toBe(40);
    expect(importeFacturadoDe(facturas, 'ing1')).toBe(484);

    const resumen = resumenFacturacionIngreso(ingreso(), facturas);
    expect(resumen.porcentajeFacturado).toBe(40);
    expect(resumen.porcentajePendiente).toBe(60);
    expect(resumen.importePendienteDeFacturar).toBe(1210 - 484);
  });

  it('tras la rectificación parcial, SÍ se puede emitir una factura nueva por el 60% restante sin superar el 100%', () => {
    const original = factura({ id: 'f1', estado: 'anulada', porcentajeFacturado: 50 });
    const rectificativa = factura({ id: 'f1r', estado: 'pendiente_sincronizar', porcentajeFacturado: 40, total: 484 });
    const facturas = [original, rectificativa];
    expect(puedeFacturarPorcentaje(facturas, 'ing1', 60).ok).toBe(true);
    expect(puedeFacturarPorcentaje(facturas, 'ing1', 61).ok).toBe(false); // 40+61=101 > 100
  });
});

describe('Cobro — eje independiente, la rectificación de lo FACTURADO no lo toca', () => {
  it('el importe cobrado del ingreso no cambia por rectificar una factura (el cobro vive en Ingreso, no en Factura)', () => {
    // Ingreso ya cobrado parcialmente (605€ de 1210€) ANTES de la rectificación.
    const ing = ingreso({ pagosRecibidos: 605, estadoPago: 'parcial' });
    const original = factura({ id: 'f1', estado: 'anulada', porcentajeFacturado: 50, total: 605 });
    const rectificativa = factura({ id: 'f1r', estado: 'pendiente_sincronizar', porcentajeFacturado: 40, total: 484 });
    const resumen = resumenFacturacionIngreso(ing, [original, rectificativa]);
    // El cobro (pagosRecibidos) es responsabilidad de contabilidad.ts, no de
    // esta función — se comprueba aquí que resumenFacturacionIngreso no lo
    // altera ni lo mezcla con el importe facturado.
    expect(ing.pagosRecibidos).toBe(605); // sin cambios
    expect(resumen.importeFacturado).toBe(484); // el facturado SÍ cambió (correcto), el cobrado no se tocó
  });
});
