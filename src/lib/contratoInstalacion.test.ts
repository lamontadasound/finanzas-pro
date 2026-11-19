import { describe, expect, it } from 'vitest';
import { nuevoContratoInstalacion, importesInstalacion, validarContratoInstalacion, clausulasInstalacion, anexoInstalacion, contratoInstalacionPdf } from './contratoInstalacion';

const base = () => ({ ...nuevoContratoInstalacion(), cliente: 'Hotel Ejemplo SL', nif: 'B00000000', lugar: 'Calle Ejemplo 1, salón', precioBase: 2000,
  material: [{ equipo: 'Proyector láser', cantidad: 1, ubicacion: 'Techo', garantia: '3 años' }] });

describe('contrato de instalación', () => {
  it('precio sin IVA, IVA y pagos', () => {
    expect(importesInstalacion(base())).toMatchObject({ base: 2000, iva: 420, total: 2420, reserva: 1210, resto: 1210, es50: true });
    expect(importesInstalacion({ ...base(), primerPago: 1000 })).toMatchObject({ reserva: 1000, resto: 1420, es50: false });
  });
  it('pide lo mínimo', () => {
    expect(validarContratoInstalacion(nuevoContratoInstalacion())).toMatch(/cliente/);
    expect(validarContratoInstalacion({ ...base(), material: [] })).toMatch(/equipo/);
    expect(validarContratoInstalacion(base())).toBeNull();
  });
  it('cláusulas con datos', () => {
    const cl = clausulasInstalacion(base());
    expect(cl).toHaveLength(18);
    expect(cl[2].parrafos[0]).toContain('2.000,00 € sin IVA');
    expect(cl[2].parrafos[2]).toContain('1.210,00 € IVA incluido');
    expect(cl[9].parrafos[1]).toContain('12 meses');
    expect(cl[11].parrafos[0]).toContain('aseguradora y póliza: ____');
  });
  it('anexo con trabajos marcados', () => {
    const a = anexoInstalacion({ ...base(), trabajos: ['Montaje y anclaje', 'Configuración'] });
    expect(a.trabajos[0]).toBe('Trabajos incluidos: Montaje y anclaje / configuración.');
    expect(a.trabajos[3]).toContain('NO');
  });
  it('genera el PDF', () => {
    expect(contratoInstalacionPdf(base(), { razonSocial: '', nif: '', direccion: '' }).getNumberOfPages()).toBeGreaterThanOrEqual(7);
  });
});
