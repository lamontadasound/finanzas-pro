// ── Pruebas del algoritmo de numeración transaccional ───────────────────────
// IMPORTANTE: estas pruebas ejercitan la SIMULACIÓN en memoria de
// `numeracion-transaccional.ts`, no una base de datos Postgres real — este
// entorno no tiene Docker/psql/Supabase local disponibles (comprobado). Son
// una prueba genuina del ALGORITMO (el mismo que implementa el SQL
// preparado), pero no sustituyen un test de integración contra Postgres
// real antes de activar esto en producción — eso queda como pendiente
// explícito en el informe de esta fase.
import { describe, it, expect } from 'vitest';
import { NumeracionSimulada } from './numeracion-transaccional';

describe('Numeración transaccional — dos emisiones simultáneas', () => {
  it('nunca reparte el mismo número a dos facturas concurrentes del mismo emisor/serie', async () => {
    const sim = new NumeracionSimulada();
    sim.confirmarContador('default', '', 1);
    const resultados = await Promise.all([
      sim.emitir({ facturaId: 'f1', emisorId: 'default', serie: '' }),
      sim.emitir({ facturaId: 'f2', emisorId: 'default', serie: '' }),
      sim.emitir({ facturaId: 'f3', emisorId: 'default', serie: '' }),
      sim.emitir({ facturaId: 'f4', emisorId: 'default', serie: '' }),
      sim.emitir({ facturaId: 'f5', emisorId: 'default', serie: '' }),
    ]);
    const numeros = resultados.map((r) => r.numero).sort((a, b) => a - b);
    expect(numeros).toEqual([1, 2, 3, 4, 5]); // consecutivos, sin huecos, sin duplicados
    expect(new Set(numeros).size).toBe(5);
    expect(sim.ultimoNumero('default', '')).toBe(5);
  });
});

describe('Numeración transaccional — fallo DESPUÉS de asignar el número', () => {
  it('el número no queda consumido si algo falla tras calcularlo (rollback real, no como una SEQUENCE)', async () => {
    const sim = new NumeracionSimulada();
    sim.confirmarContador('default', '', 1);

    await expect(sim.emitir({ facturaId: 'fallida', emisorId: 'default', serie: '', simularFalloTrasNumero: true }))
      .rejects.toThrow('Fallo simulado');

    // El contador NO avanzó — el siguiente intento real obtiene el 1, no el 2.
    expect(sim.ultimoNumero('default', '')).toBe(0);
    const { numero } = await sim.emitir({ facturaId: 'buena', emisorId: 'default', serie: '' });
    expect(numero).toBe(1);
  });
});

describe('Numeración transaccional — reintento de la misma solicitud', () => {
  it('reintentar con el mismo facturaId tras un fallo de red devuelve el mismo número, no uno nuevo', async () => {
    const sim = new NumeracionSimulada();
    sim.confirmarContador('default', '', 1);
    const primero = await sim.emitir({ facturaId: 'reintento-1', emisorId: 'default', serie: '' });
    const segundo = await sim.emitir({ facturaId: 'reintento-1', emisorId: 'default', serie: '' }); // mismo facturaId
    expect(segundo.numero).toBe(primero.numero);
    expect(sim.ultimoNumero('default', '')).toBe(1); // no avanzó una segunda vez
  });
});

describe('Numeración transaccional — doble clic en "Emitir"', () => {
  it('dos clics casi simultáneos sobre la misma factura (mismo facturaId) obtienen el mismo número', async () => {
    const sim = new NumeracionSimulada();
    sim.confirmarContador('default', '', 1);
    const [a, b] = await Promise.all([
      sim.emitir({ facturaId: 'doble-clic', emisorId: 'default', serie: '' }),
      sim.emitir({ facturaId: 'doble-clic', emisorId: 'default', serie: '' }),
    ]);
    expect(a.numero).toBe(b.numero);
    expect(sim.ultimoNumero('default', '')).toBe(1);
  });
});

describe('Numeración transaccional — dos facturas parciales simultáneas que superarían el 100%', () => {
  it('bloquea la segunda si, sumadas, superan el total del ingreso — incluso en paralelo', async () => {
    const sim = new NumeracionSimulada();
    sim.confirmarContador('default', '', 1);
    const resultados = await Promise.allSettled([
      sim.emitir({ facturaId: 'p70', emisorId: 'default', serie: '', ingresoId: 'ing1', porcentajeFacturado: 70 }),
      sim.emitir({ facturaId: 'p60', emisorId: 'default', serie: '', ingresoId: 'ing1', porcentajeFacturado: 60 }),
    ]);
    const cumplidas = resultados.filter((r) => r.status === 'fulfilled');
    const rechazadas = resultados.filter((r) => r.status === 'rejected');
    // Exactamente una de las dos (70+60=130 > 100) debe pasar, la otra debe
    // ser rechazada — nunca las dos, aunque se lancen en paralelo, porque
    // ambas comparten el bloqueo de la fila del contador (misma clave
    // emisor/serie) y se serializan una tras otra.
    expect(cumplidas.length).toBe(1);
    expect(rechazadas.length).toBe(1);
    expect((rechazadas[0] as PromiseRejectedResult).reason.message).toMatch(/Superaría el 100%/);
  });

  it('permite dos parciales concurrentes que SÍ caben (30% + 70% = 100%)', async () => {
    const sim = new NumeracionSimulada();
    sim.confirmarContador('default', '', 1);
    const resultados = await Promise.allSettled([
      sim.emitir({ facturaId: 'p30', emisorId: 'default', serie: '', ingresoId: 'ing2', porcentajeFacturado: 30 }),
      sim.emitir({ facturaId: 'p70b', emisorId: 'default', serie: '', ingresoId: 'ing2', porcentajeFacturado: 70 }),
    ]);
    expect(resultados.every((r) => r.status === 'fulfilled')).toBe(true);
  });
});

describe('Numeración transaccional — bloqueo sin numeración confirmada', () => {
  it('no emite nada si el emisor/serie no ha sido confirmado por un administrador', async () => {
    const sim = new NumeracionSimulada();
    await expect(sim.emitir({ facturaId: 'x', emisorId: 'default', serie: '' }))
      .rejects.toThrow('todavía no ha sido confirmada');
  });
});
