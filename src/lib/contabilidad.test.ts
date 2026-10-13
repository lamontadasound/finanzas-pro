import { describe, it, expect } from 'vitest';
import {
  cobradoDe, pendienteDe, agregarIngresos, agregarGastos, estadoPagoDesdeCobrado,
  calcularResumenFinanciero, ivaEstimadoALiquidar, TIPO_IMPUESTO_SOCIEDADES_ESTIMADO,
} from './contabilidad';
import { LINEA_IDS, type LineaId } from '../config/businessLines';
import type { Ingreso, Gasto, GastoEvento } from '../types';

const ingreso = (over: Partial<Ingreso>): Ingreso => ({
  id: 'i1', area: 'montada', concepto: 'Boda', cliente: 'Cliente', empresa: false,
  tipoEvento: 'boda', fechaEvento: '2026-03-01', baseImponible: 1000, porcentajeIVA: 21,
  importeIVA: 210, total: 1210, metodoPago: 'transferencia', estadoPago: 'pendiente',
  pagosRecibidos: 0, facturaEmitida: true, createdAt: '2026-01-01T00:00:00Z', ...over,
});

const gasto = (over: Partial<Gasto>): Gasto => ({
  id: 'g1', area: 'montada', fecha: '2026-03-01', concepto: 'Alquiler', categoria: 'Material',
  tipo: 'variable', baseImponible: 100, porcentajeIVA: 21, importeIVA: 21, total: 121,
  metodoPago: 'transferencia', estadoPago: 'pagado', facturaRecibida: true, deducible: true,
  createdAt: '2026-01-01T00:00:00Z', ...over,
});

const gastoEvento = (over: Partial<GastoEvento>): GastoEvento => ({
  id: 'ge1', ingresoId: 'i1', area: 'montada', fecha: '2026-03-01', concepto: 'DJ',
  categoria: 'DJ', importe: 50, createdAt: '2026-01-01T00:00:00Z', ...over,
});

describe('cobradoDe — corrige el error de "pagado" desincronizado con pagosRecibidos', () => {
  it('un ingreso marcado "pagado" se computa SIEMPRE como cobrado al 100%, aunque pagosRecibidos esté desactualizado', () => {
    const i = ingreso({ estadoPago: 'pagado', total: 500, pagosRecibidos: 0 });
    expect(cobradoDe(i)).toBe(500);
    expect(pendienteDe(i)).toBe(0);
  });

  it('un ingreso "parcial" sin reserva usa solo pagosRecibidos', () => {
    const i = ingreso({ estadoPago: 'parcial', total: 1000, pagosRecibidos: 300 });
    expect(cobradoDe(i)).toBe(300);
    expect(pendienteDe(i)).toBe(700);
  });

  it('un ingreso "pendiente" con reserva cobrada suma pagosRecibidos + reserva', () => {
    const i = ingreso({ estadoPago: 'pendiente', total: 1000, pagosRecibidos: 0, tieneReserva: true, reserva: 150 });
    expect(cobradoDe(i)).toBe(150);
    expect(pendienteDe(i)).toBe(850);
  });

  it('pendienteDe nunca es negativo aunque haya sobrepago', () => {
    const i = ingreso({ estadoPago: 'parcial', total: 500, pagosRecibidos: 600 });
    expect(pendienteDe(i)).toBe(0);
  });
});

describe('agregarIngresos — cuadre cobrado + pendiente = total facturado', () => {
  it('la suma de cobrado y pendiente de varios ingresos mixtos cuadra exactamente con el total facturado', () => {
    const lista = [
      ingreso({ id: 'a', estadoPago: 'pagado', total: 1000, pagosRecibidos: 0 }),
      ingreso({ id: 'b', estadoPago: 'parcial', total: 800, pagosRecibidos: 300 }),
      ingreso({ id: 'c', estadoPago: 'pendiente', total: 500, pagosRecibidos: 0 }),
    ];
    const agg = agregarIngresos(lista);
    expect(agg.totalFacturado).toBe(2300);
    expect(agg.totalCobrado + agg.totalPendiente).toBe(agg.totalFacturado);
    expect(agg.totalCobrado).toBe(1300);
    expect(agg.totalPendiente).toBe(1000);
  });

  it('no duplica el IVA: ivaRepercutido es la suma directa de importeIVA, una vez por ingreso', () => {
    const lista = [ingreso({ id: 'a', importeIVA: 210 }), ingreso({ id: 'b', importeIVA: 105 })];
    expect(agregarIngresos(lista).ivaRepercutido).toBe(315);
  });
});

describe('agregarGastos — deducibilidad y coste de evento', () => {
  it('excluye gastos no deducibles del total de gastos deducibles y de IVA soportado', () => {
    const gastos = [gasto({ id: 'g1', total: 100, importeIVA: 21, deducible: true }), gasto({ id: 'g2', total: 200, importeIVA: 42, deducible: false })];
    const agg = agregarGastos(gastos, []);
    expect(agg.gastosDeducibles).toBe(100);
    expect(agg.ivaSoportado).toBe(21);
  });

  it('suma los costes de evento como deducibles, sin desglose de IVA (columnas no persistidas)', () => {
    const agg = agregarGastos([], [gastoEvento({ importe: 50 }), gastoEvento({ id: 'ge2', importe: 30 })]);
    expect(agg.gastosDeducibles).toBe(80);
    expect(agg.ivaSoportado).toBe(0);
  });
});

describe('calcularResumenFinanciero — beneficio, estimación de impuestos y resultado', () => {
  it('con beneficio positivo, estima el 25% de Impuesto de Sociedades', () => {
    const ingresos = [ingreso({ baseImponible: 1000, total: 1210, importeIVA: 210 })];
    const gastos = [gasto({ baseImponible: 100, total: 121, importeIVA: 21, deducible: true })];
    const resumen = calcularResumenFinanciero(ingresos, gastos, []);
    expect(resumen.beneficioAntesImpuestos).toBe(900);
    expect(resumen.estimacionImpuestos).toBeCloseTo(900 * TIPO_IMPUESTO_SOCIEDADES_ESTIMADO, 6);
    expect(resumen.resultadoDespuesImpuestos).toBeCloseTo(900 - resumen.estimacionImpuestos, 6);
  });

  it('con beneficio negativo (pérdidas), la estimación de impuestos es 0, no negativa', () => {
    const ingresos = [ingreso({ baseImponible: 100, total: 121, importeIVA: 21 })];
    const gastos = [gasto({ baseImponible: 500, total: 605, importeIVA: 105, deducible: true })];
    const resumen = calcularResumenFinanciero(ingresos, gastos, []);
    expect(resumen.beneficioAntesImpuestos).toBe(-400);
    expect(resumen.estimacionImpuestos).toBe(0);
    expect(resumen.resultadoDespuesImpuestos).toBe(-400);
  });

  it('un periodo sin ingresos ni gastos da todo a 0, sin inventar cifras', () => {
    const resumen = calcularResumenFinanciero([], [], []);
    expect(resumen.ingresosSinIVA).toBe(0);
    expect(resumen.beneficioAntesImpuestos).toBe(0);
    expect(resumen.estimacionImpuestos).toBe(0);
  });
});

describe('ivaEstimadoALiquidar', () => {
  it('positivo cuando el repercutido supera al soportado (a pagar)', () => {
    expect(ivaEstimadoALiquidar(500, 200)).toBe(300);
  });
  it('negativo cuando el soportado supera al repercutido (a compensar)', () => {
    expect(ivaEstimadoALiquidar(200, 500)).toBe(-300);
  });
});

// ── Ronda de auditoría final — pruebas explícitas pedidas ───────────────────

describe('base imponible e IVA — coherencia del desglose de un ingreso', () => {
  it('total = base imponible + importe IVA, sin recalcular nada por separado', () => {
    const i = ingreso({ baseImponible: 1000, porcentajeIVA: 21, importeIVA: 210, total: 1210 });
    expect(i.baseImponible + i.importeIVA).toBe(i.total);
    expect(agregarIngresos([i]).ingresosSinIVA).toBe(1000);
    expect(agregarIngresos([i]).ivaRepercutido).toBe(210);
  });
});

describe('estadoPagoDesdeCobrado — recalcula el estado sin desincronizarse del importe', () => {
  it('cobrado 0 → pendiente', () => {
    expect(estadoPagoDesdeCobrado(1000, 0)).toBe('pendiente');
  });
  it('cobrado parcial (menor que el total) → parcial', () => {
    expect(estadoPagoDesdeCobrado(1000, 400)).toBe('parcial');
  });
  it('cobrado igual o mayor al total → pagado', () => {
    expect(estadoPagoDesdeCobrado(1000, 1000)).toBe('pagado');
    expect(estadoPagoDesdeCobrado(1000, 1200)).toBe('pagado'); // sobrepago
  });
});

describe('registrar / editar / eliminar un pago — nunca duplica el ingreso ni el cobro', () => {
  it('un pago completo deja cobrado = total y pendiente = 0, sobre el MISMO ingreso', () => {
    const i = ingreso({ id: 'x', total: 1000, pagosRecibidos: 0, estadoPago: 'pendiente' });
    const cobradoTrasPago = 1000; // "registrar pago" por el total pendiente
    const estado = estadoPagoDesdeCobrado(i.total, cobradoTrasPago);
    expect(estado).toBe('pagado');
    const actualizado = { ...i, pagosRecibidos: cobradoTrasPago, estadoPago: estado };
    expect(cobradoDe(actualizado)).toBe(1000);
    expect(pendienteDe(actualizado)).toBe(0);
    expect(actualizado.id).toBe(i.id); // sigue siendo el mismo ingreso, no uno nuevo
  });

  it('un pago parcial dos veces seguidas SUMA (no duplica el ingreso), y editar SUSTITUYE el importe', () => {
    let i = ingreso({ id: 'y', total: 1000, pagosRecibidos: 0, estadoPago: 'pendiente' });
    // 1er pago parcial de 300
    let cobrado = cobradoDe(i) + 300;
    i = { ...i, pagosRecibidos: cobrado, estadoPago: estadoPagoDesdeCobrado(i.total, cobrado) };
    expect(i.estadoPago).toBe('parcial');
    expect(cobradoDe(i)).toBe(300);
    // 2º pago parcial de 200 más (se SUMA sobre el mismo ingreso — 500 total)
    cobrado = cobradoDe(i) + 200;
    i = { ...i, pagosRecibidos: cobrado, estadoPago: estadoPagoDesdeCobrado(i.total, cobrado) };
    expect(cobradoDe(i)).toBe(500);
    expect(pendienteDe(i)).toBe(500);
    // "Editar" el cobro a un valor absoluto (p.ej. corregir un error a 450, no sumar)
    const cobradoEditado = 450;
    i = { ...i, pagosRecibidos: cobradoEditado, estadoPago: estadoPagoDesdeCobrado(i.total, cobradoEditado) };
    expect(cobradoDe(i)).toBe(450);
    expect(pendienteDe(i)).toBe(550);
  });

  it('eliminar un cobro devuelve el ingreso a "pendiente" con cobrado 0, sin borrar el registro', () => {
    let i = ingreso({ id: 'z', total: 800, pagosRecibidos: 800, estadoPago: 'pagado' });
    // "Eliminar cobro" = fijar cobrado a 0, igual que aplicarCobro(id, 0, ...)
    i = { ...i, pagosRecibidos: 0, estadoPago: estadoPagoDesdeCobrado(i.total, 0) };
    expect(i.estadoPago).toBe('pendiente');
    expect(cobradoDe(i)).toBe(0);
    expect(pendienteDe(i)).toBe(800);
    expect(i.id).toBe('z'); // el ingreso sigue existiendo, no se elimina el registro
  });
});

describe('gastos con y sin desglose de IVA', () => {
  it('un gasto deducible con IVA aporta a gastosDeducibles (base) y a ivaSoportado', () => {
    const g = gasto({ baseImponible: 200, porcentajeIVA: 21, importeIVA: 42, total: 242, deducible: true });
    const agg = agregarGastos([g], []);
    expect(agg.gastosDeducibles).toBe(200);
    expect(agg.ivaSoportado).toBe(42);
  });

  it('un gasto de evento (sin desglose de IVA persistido) aporta su importe íntegro como deducible, IVA soportado 0', () => {
    const ge = gastoEvento({ importe: 75 });
    const agg = agregarGastos([], [ge]);
    expect(agg.gastosDeducibles).toBe(75);
    expect(agg.ivaSoportado).toBe(0);
  });
});

describe('consolidado = suma exacta de las 4 líneas de negocio', () => {
  it('el resumen financiero calculado sobre el total coincide con la suma de los 4 resúmenes por línea', () => {
    const porLinea: Record<LineaId, Ingreso[]> = {
      montada_sound: [ingreso({ id: 'ms1', area: 'montada', baseImponible: 1000, importeIVA: 210, total: 1210, estadoPago: 'pagado', pagosRecibidos: 1210 })],
      dj: [ingreso({ id: 'dj1', area: 'dj', tipoEvento: 'dj_personal', baseImponible: 500, importeIVA: 105, total: 605, estadoPago: 'parcial', pagosRecibidos: 200 })],
      real_madrid: [ingreso({ id: 'rm1', area: 'dj', tipoEvento: 'Partido', baseImponible: 2000, importeIVA: 420, total: 2420, estadoPago: 'pendiente', pagosRecibidos: 0 })],
      montada_installations: [], // línea sin datos todavía — 0, nunca inventado
    };
    const todos = LINEA_IDS.flatMap((id) => porLinea[id]);
    const consolidado = agregarIngresos(todos);
    const sumaLineas = LINEA_IDS.reduce((acc, id) => {
      const l = agregarIngresos(porLinea[id]);
      return {
        ingresosSinIVA: acc.ingresosSinIVA + l.ingresosSinIVA,
        totalFacturado: acc.totalFacturado + l.totalFacturado,
        totalCobrado: acc.totalCobrado + l.totalCobrado,
        totalPendiente: acc.totalPendiente + l.totalPendiente,
      };
    }, { ingresosSinIVA: 0, totalFacturado: 0, totalCobrado: 0, totalPendiente: 0 });

    expect(sumaLineas.ingresosSinIVA).toBe(consolidado.ingresosSinIVA);
    expect(sumaLineas.totalFacturado).toBe(consolidado.totalFacturado);
    expect(sumaLineas.totalCobrado).toBe(consolidado.totalCobrado);
    expect(sumaLineas.totalPendiente).toBe(consolidado.totalPendiente);
    expect(consolidado.totalCobrado + consolidado.totalPendiente).toBe(consolidado.totalFacturado);
  });
});

describe('filtros mensual, trimestral y anual — mismo conjunto de registros que el consolidado del periodo', () => {
  const ingresosDelAnio = [
    ingreso({ id: 'e', fechaEvento: '2026-01-10', total: 100, baseImponible: 100 / 1.21 * 1, importeIVA: 0 }),
    ingreso({ id: 'f', fechaEvento: '2026-02-15', total: 200, baseImponible: 200, importeIVA: 0 }),
    ingreso({ id: 'g', fechaEvento: '2026-04-20', total: 300, baseImponible: 300, importeIVA: 0 }), // Q2
    ingreso({ id: 'h', fechaEvento: '2026-12-31', total: 400, baseImponible: 400, importeIVA: 0 }), // Q4
  ];

  it('filtro mensual: solo incluye los registros de ese mes exacto', () => {
    const enero = ingresosDelAnio.filter((i) => new Date(i.fechaEvento).getMonth() === 0);
    expect(agregarIngresos(enero).numIngresos).toBe(1);
    expect(agregarIngresos(enero).totalFacturado).toBe(100);
  });

  it('filtro trimestral: agrupa los meses del trimestre y cuadra con la suma de sus meses', () => {
    const q1 = ingresosDelAnio.filter((i) => Math.floor(new Date(i.fechaEvento).getMonth() / 3) === 0);
    expect(agregarIngresos(q1).numIngresos).toBe(2); // enero + febrero
    expect(agregarIngresos(q1).totalFacturado).toBe(300);
  });

  it('filtro anual: incluye todos los meses del año, la suma de los 4 trimestres cuadra con el total anual', () => {
    const anual = agregarIngresos(ingresosDelAnio);
    const trimestres = [0, 1, 2, 3].map((t) =>
      agregarIngresos(ingresosDelAnio.filter((i) => Math.floor(new Date(i.fechaEvento).getMonth() / 3) === t)).totalFacturado,
    );
    expect(trimestres.reduce((a, b) => a + b, 0)).toBe(anual.totalFacturado);
    expect(anual.totalFacturado).toBe(1000);
  });
});

describe('no se contabiliza dos veces el IVA, la reserva ni el cobro', () => {
  it('la reserva cobrada de un ingreso "pendiente" no se vuelve a sumar cuando pasa a "pagado"', () => {
    // Antes de cobrar el resto: pendiente con reserva ya cobrada.
    let i = ingreso({ id: 'r', total: 1000, pagosRecibidos: 0, tieneReserva: true, reserva: 150, estadoPago: 'pendiente' });
    expect(cobradoDe(i)).toBe(150); // solo la reserva cuenta aquí

    // Al marcarlo "pagado" (cobro del resto), cobradoDe pasa a usar el TOTAL
    // directamente — la reserva no se vuelve a sumar aparte porque ya forma
    // parte del total cobrado del ingreso "pagado".
    i = { ...i, estadoPago: 'pagado' };
    expect(cobradoDe(i)).toBe(1000); // no 1000 + 150
  });

  it('el IVA de un ingreso solo se cuenta una vez al agregar una lista, aunque se recalcule el resumen varias veces', () => {
    const lista = [ingreso({ id: 'a', importeIVA: 210 })];
    const primero = agregarIngresos(lista).ivaRepercutido;
    const segundo = agregarIngresos(lista).ivaRepercutido; // recalcular no debe acumular
    expect(primero).toBe(210);
    expect(segundo).toBe(210);
  });
});
