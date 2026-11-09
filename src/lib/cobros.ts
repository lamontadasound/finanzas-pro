// ── Ingresos por fecha de cobro (criterio de caja) ──────────────────────────
// Cada evento se descompone en los cobros reales que ha tenido, fechados el
// día en que entró el dinero: reservas con su fecha de cobro y el resto con
// la fecha de pago. Así una reserva de un evento de 2028 cobrada en 2026
// cuenta en 2026. Los importes cuadran con cobradoDe(): nunca se inventa dinero.
import type { Ingreso, PaymentMethod } from '../types';
import { cobradoDe, totalReservasDe } from './contabilidad';

export type TipoCobro = 'Reserva' | 'Segunda reserva' | 'Resto del pago' | 'Pago completo' | 'Pago parcial';

export interface Cobro {
  id: string;
  ingreso: Ingreso;
  fecha: string;
  importe: number;
  tipo: TipoCobro;
  metodo?: PaymentMethod;
  /** Sin fecha de cobro registrada: se coloca en la fecha del evento. */
  sinFecha: boolean;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function cobrosDeIngreso(i: Ingreso): Cobro[] {
  if (i.estadoPago === 'cancelado' || i.estadoPago === 'presupuesto') return [];
  const out: Cobro[] = [];
  const add = (sufijo: string, importe: number, tipo: TipoCobro, fecha: string | undefined, metodo?: PaymentMethod) => {
    if (!(importe > 0.004)) return;
    out.push({ id: `${i.id}:${sufijo}`, ingreso: i, importe: r2(importe), tipo, fecha: fecha || i.fechaEvento, metodo, sinFecha: !fecha });
  };
  if (i.tieneReserva) {
    add('r1', i.reserva ?? 0, 'Reserva', i.fechaCobroReserva, i.metodoPagoReserva);
    if (i.numeroReservas === 2) add('r2', i.reserva2 ?? 0, 'Segunda reserva', i.fechaCobroReserva2, i.metodoPagoReserva2);
  }
  const reservas = totalReservasDe(i);
  const resto = r2(cobradoDe(i) - reservas);
  const tipo: TipoCobro = i.estadoPago === 'pagado' ? (reservas > 0 ? 'Resto del pago' : 'Pago completo') : 'Pago parcial';
  add('pago', resto, tipo, i.fechaPago, i.metodoPago);
  return out;
}

export const cobrosDe = (ingresos: Ingreso[]) => ingresos.flatMap(cobrosDeIngreso).sort((a, b) => b.fecha.localeCompare(a.fecha));
