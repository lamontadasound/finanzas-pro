// ── Pruebas — persistencia del id de emisión pendiente ─────────────────────
// Responden directamente a: "cerrar y volver a abrir el modal permite
// recuperar la operación pendiente". Se prueba la persistencia real
// (localStorage de jsdom), no una simulación en memoria.
import { describe, it, expect, beforeEach } from 'vitest';
import { leerEmisionPendiente, obtenerOCrearEmisionPendiente, limpiarEmisionPendiente } from './emisionPendiente';

beforeEach(() => localStorage.clear());

describe('obtenerOCrearEmisionPendiente', () => {
  it('la primera vez crea y persiste un id nuevo', () => {
    const id = obtenerOCrearEmisionPendiente('ing1', () => 'id-nuevo');
    expect(id).toBe('id-nuevo');
    expect(leerEmisionPendiente('ing1')).toBe('id-nuevo');
  });

  it('"cerrar y reabrir el modal" — una segunda llamada para el mismo ingreso devuelve el MISMO id, no crea otro', () => {
    const id1 = obtenerOCrearEmisionPendiente('ing1', () => 'id-primera-apertura');
    // Simula cerrar el modal (el componente se desmonta, useRef se pierde) y
    // volver a abrirlo — se llama otra vez con un generador que devolvería
    // un id distinto SI se ejecutara, pero no debe ejecutarse.
    const id2 = obtenerOCrearEmisionPendiente('ing1', () => 'id-si-se-regenerara-mal');
    expect(id2).toBe(id1);
    expect(id2).toBe('id-primera-apertura');
  });

  it('ingresos distintos obtienen ids independientes', () => {
    const idA = obtenerOCrearEmisionPendiente('ingA', () => 'a');
    const idB = obtenerOCrearEmisionPendiente('ingB', () => 'b');
    expect(idA).not.toBe(idB);
  });
});

describe('limpiarEmisionPendiente', () => {
  it('tras limpiar, la siguiente apertura genera un id nuevo (la operación ya se resolvió)', () => {
    obtenerOCrearEmisionPendiente('ing1', () => 'id-viejo');
    limpiarEmisionPendiente('ing1');
    expect(leerEmisionPendiente('ing1')).toBeNull();
    const idNuevo = obtenerOCrearEmisionPendiente('ing1', () => 'id-siguiente-factura-parcial');
    expect(idNuevo).toBe('id-siguiente-factura-parcial');
  });
});
