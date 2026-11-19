import { describe, expect, it } from 'vitest';
import { nuevoContratoAlquiler, jornadasAlquiler, importesAlquiler, validarContratoAlquiler, clausulasAlquiler, anexoAlquiler, contratoAlquilerPdf } from './contratoAlquiler';

const base = () => ({
  ...nuevoContratoAlquiler(), cliente: 'Sonido Sur SL', nif: 'B12345678',
  entregaFecha: '2027-03-12', entregaHora: '10:00', devolucionFecha: '2027-03-14', devolucionHora: '10:00',
  precioDiario: 120, precioAlquiler: 240, fianza: 500,
  equipos: [{ equipo: 'Altavoz RCF ART 912-A', serie: 'RC123', cantidad: 2, accesorios: 'Funda', valor: 900 }],
});

describe('contrato de alquiler de equipos', () => {
  it('cuenta jornadas de 24 h o fracción', () => {
    expect(jornadasAlquiler(base())).toBe(2);
    expect(jornadasAlquiler({ ...base(), devolucionHora: '10:30' })).toBe(3);
    expect(jornadasAlquiler({ ...base(), devolucionFecha: '2027-03-12', devolucionHora: '20:00' })).toBe(1);
    expect(jornadasAlquiler({ ...base(), devolucionFecha: '' })).toBe(0);
  });

  it('el transporte solo cuenta si lo llevamos nosotros', () => {
    expect(importesAlquiler({ ...base(), transporte: 60 }).total).toBe(240);
    expect(importesAlquiler({ ...base(), modalidad: 'entrega', transporte: 60 }).total).toBe(300);
  });

  it('pide lo mínimo', () => {
    expect(validarContratoAlquiler(nuevoContratoAlquiler())).toMatch(/cliente/);
    expect(validarContratoAlquiler({ ...base(), equipos: [{ equipo: ' ', serie: '', cantidad: 1, accesorios: '', valor: 0 }] })).toMatch(/equipo/);
    expect(validarContratoAlquiler({ ...base(), devolucionFecha: '2027-03-10' })).toMatch(/anterior/);
    expect(validarContratoAlquiler(base())).toBeNull();
  });

  it('pone precio y fianza en las cláusulas y el anexo', () => {
    const cl = clausulasAlquiler(base());
    expect(cl).toHaveLength(18);
    expect(cl[3].parrafos[0]).toContain('240,00 €');
    expect(cl[4].parrafos[0]).toContain('500,00 €');
    const a = anexoAlquiler(base()).flatMap((b) => b.lineas).join(' ');
    expect(a).toContain('RECOGIDA Y DEVOLUCIÓN EN ALMACÉN');
    expect(a).toContain('Número de jornadas: 2');
    expect(a).toContain('no aplica');
  });

  it('genera el PDF con anexos', () => {
    const d = contratoAlquilerPdf(base(), { razonSocial: 'LA MONTADA SOUND, S.L.', nif: 'B21642913', direccion: 'Pozuelo' }, 'CT-TEST');
    expect(d.getNumberOfPages()).toBeGreaterThanOrEqual(6);
  });
});
