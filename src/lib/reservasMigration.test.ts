// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import migration from '../../supabase/migrations/20261108192724_segunda_reserva_ingresos.sql?raw';
import { expect, it } from 'vitest';
it('la migración conserva la primera reserva y valida los nuevos campos', async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE ingresos(id int PRIMARY KEY, reserva numeric, tiene_reserva boolean); INSERT INTO ingresos VALUES(1,200,true);');
    await db.exec(migration);
    expect((await db.query('SELECT reserva::text, numero_reservas, reserva_2::text FROM ingresos')).rows[0]).toEqual({ reserva: '200', numero_reservas: 1, reserva_2: '0.00' });
    await db.exec("UPDATE ingresos SET numero_reservas=2,reserva_2=350,fecha_cobro_reserva_2='2026-11-08',metodo_pago_reserva_2='bizum',reserva_2_incluye_iva=false;");
    expect((await db.query('SELECT reserva + reserva_2 AS total FROM ingresos')).rows[0]).toEqual({ total: '550.00' });
    await expect(db.exec('UPDATE ingresos SET numero_reservas=3')).rejects.toThrow();
    await expect(db.exec('UPDATE ingresos SET reserva_2=-1')).rejects.toThrow();
  } finally { await db.close(); }
});
