import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ReservaFields } from './ReservaFields';
import { cobradoDe, pendienteDe, totalReservasDe, estadoPagoDesdeCobrado } from '../../lib/contabilidad';
import type { Ingreso } from '../../types';
const confirmation = vi.hoisted(() => ({ apply: undefined as undefined | (() => void) }));
vi.mock('../../store/useConfirmStore', () => ({ useConfirmStore: (select: (s: unknown) => unknown) => select({ show: (_: string, apply: () => void) => { confirmation.apply = apply; } }) }));
afterEach(cleanup);
function Form() {
  const [value, setValue] = useState<Partial<Ingreso>>({ tieneReserva: true, reserva: 200, fechaCobroReserva: '2026-10-01', total: 1000, pagosRecibidos: 100 });
  return <><ReservaFields value={value} onChange={(patch) => setValue((old) => ({ ...old, ...patch }))} /><output data-testid="value">{JSON.stringify(value)}</output></>;
}
it('mantiene la reserva existente y permite dos cobros con fecha y método independientes', () => {
  render(<Form />);
  expect((screen.getByLabelText('Número de reservas') as HTMLSelectElement).value).toBe('1');
  fireEvent.change(screen.getByLabelText('Número de reservas'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Reserva 2: importe (€)'), { target: { value: '300' } });
  fireEvent.change(screen.getByLabelText('Reserva 2: fecha'), { target: { value: '2026-11-08' } });
  fireEvent.change(screen.getByLabelText('Reserva 2: método'), { target: { value: 'bizum' } });
  const value = JSON.parse(screen.getByTestId('value').textContent!) as Ingreso;
  expect(value).toMatchObject({ reserva: 200, fechaCobroReserva: '2026-10-01', reserva2: 300, fechaCobroReserva2: '2026-11-08', metodoPagoReserva2: 'bizum' });
  expect(totalReservasDe(value)).toBe(500);
  expect(cobradoDe(value)).toBe(600);
  expect(pendienteDe(value)).toBe(400);
  expect(estadoPagoDesdeCobrado(value.total, cobradoDe(value))).toBe('parcial');
  expect(document.querySelectorAll('details[open]')).toHaveLength(0);
  fireEvent.change(screen.getByLabelText('Número de reservas'), { target: { value: '1' } });
  expect(JSON.parse(screen.getByTestId('value').textContent!).reserva2).toBe(300);
  // Confirmación explícita antes de quitar un pago existente.
  expect(confirmation.apply).toBeTypeOf('function');
  act(() => confirmation.apply!());
  const after = JSON.parse(screen.getByTestId('value').textContent!);
  expect(after).toMatchObject({ numeroReservas: 1, reserva: 200, reserva2: 0 });
  expect(after.fechaCobroReserva2).toBeUndefined();
  expect(totalReservasDe(after)).toBe(200);
});
it('no suma reservas desactivadas y conserva la compatibilidad con una reserva histórica', () => {
  expect(totalReservasDe({ tieneReserva: false, reserva: 200, numeroReservas: 2, reserva2: 300 })).toBe(0);
  expect(totalReservasDe({ tieneReserva: true, reserva: 200 })).toBe(200);
  expect(totalReservasDe({ tieneReserva: true, reserva: 0.1, numeroReservas: 2, reserva2: 0.2 })).toBe(0.3);
});
