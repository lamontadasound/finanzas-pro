import { describe, it, expect, vi } from 'vitest';
import { db } from './db';
import { fixtureIngresos } from '../dev/fixtures';
const saved = vi.hoisted(() => ({ row: {} as Record<string, unknown> }));
vi.mock('./supabase', () => ({ supabase: { from: () => ({
  insert: async (row: Record<string, unknown>) => { saved.row = row; return { error: null }; },
  select: () => ({ eq: () => ({ single: async () => ({ data: saved.row, error: null }) }) }),
}) } }));
vi.mock('../store/useAuthStore', () => ({ useAuthStore: { getState: () => ({}) } }));
describe('reservas: guardar y volver a cargar', () => {
  it('conserva importes, fechas, métodos e IVA de ambos pagos', async () => {
    const ingreso = { ...fixtureIngresos[0], tieneReserva: true, numeroReservas: 2 as const, reserva: 200, fechaCobroReserva: '2026-10-01', metodoPagoReserva: 'transferencia' as const, reservaIncluyeIva: true, reserva2: 350, fechaCobroReserva2: '2026-11-08', metodoPagoReserva2: 'bizum' as const, reserva2IncluyeIva: false };
    await db.ingresos.insert(ingreso);
    expect(saved.row).toMatchObject({ numero_reservas: 2, reserva: 200, reserva_2: 350, metodo_pago_reserva_2: 'bizum', reserva_2_incluye_iva: false });
    expect(await db.ingresos.getById(ingreso.id)).toMatchObject(ingreso);
  });
  it('lee ingresos antiguos como una reserva sin inventar un segundo pago', async () => {
    saved.row = { id: 'old', tiene_reserva: true, reserva: 200 };
    expect(await db.ingresos.getById('old')).toMatchObject({ reserva: 200, numeroReservas: 1, reserva2: 0 });
  });
});
