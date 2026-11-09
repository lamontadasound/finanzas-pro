import { describe, expect, it } from 'vitest';
import { cobrosDeIngreso } from './cobros';
import type { Ingreso } from '../types';

const ing = (p: Partial<Ingreso>): Ingreso => ({
  id: 'i', area: 'montada', concepto: 'Boda', cliente: 'Ana', empresa: false, tipoEvento: 'Boda',
  fechaEvento: '2028-06-10', baseImponible: 1000, porcentajeIVA: 21, importeIVA: 210, total: 1210,
  metodoPago: 'transferencia', estadoPago: 'pendiente', pagosRecibidos: 0, facturaEmitida: false, createdAt: '', ...p,
});

describe('cobros por fecha de cobro', () => {
  it('una reserva de un evento de 2028 cobrada en 2026 cuenta en 2026', () => {
    const c = cobrosDeIngreso(ing({ tieneReserva: true, reserva: 300, fechaCobroReserva: '2026-03-15' }));
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ fecha: '2026-03-15', importe: 300, tipo: 'Reserva', sinFecha: false });
  });
  it('separa dos reservas y el resto cuando está pagado, sumando el total', () => {
    const c = cobrosDeIngreso(ing({
      estadoPago: 'pagado', fechaPago: '2028-06-12', tieneReserva: true, numeroReservas: 2,
      reserva: 300, fechaCobroReserva: '2026-03-15', reserva2: 200, fechaCobroReserva2: '2027-01-10',
    }));
    expect(c.map((x) => [x.tipo, x.fecha, x.importe])).toEqual([
      ['Reserva', '2026-03-15', 300], ['Segunda reserva', '2027-01-10', 200], ['Resto del pago', '2028-06-12', 710],
    ]);
  });
  it('sin fecha de cobro usa la del evento y lo marca', () => {
    const c = cobrosDeIngreso(ing({ estadoPago: 'pagado', fechaEvento: '2026-05-01' }));
    expect(c[0]).toMatchObject({ tipo: 'Pago completo', fecha: '2026-05-01', sinFecha: true, importe: 1210 });
  });
  it('ignora cancelados, presupuestos y lo no cobrado', () => {
    expect(cobrosDeIngreso(ing({ estadoPago: 'cancelado', pagosRecibidos: 100 }))).toEqual([]);
    expect(cobrosDeIngreso(ing({ estadoPago: 'presupuesto' }))).toEqual([]);
    expect(cobrosDeIngreso(ing({}))).toEqual([]);
  });
  it('un pago parcial se registra como tal', () => {
    const c = cobrosDeIngreso(ing({ estadoPago: 'parcial', pagosRecibidos: 400, fechaPago: '2026-09-01' }));
    expect(c[0]).toMatchObject({ tipo: 'Pago parcial', importe: 400, fecha: '2026-09-01' });
  });
});
