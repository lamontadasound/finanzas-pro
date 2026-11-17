import { describe, expect, it } from 'vitest';
import { nuevoContratoEventos, importesContrato, validarContratoEventos, clausulasContrato, anexoContrato, fechasEvento, contratoEventosPdf } from './contratoEventos';

const base = () => ({ ...nuevoContratoEventos(), cliente: 'Ana López', nif: '12345678Z', fechaEvento: '2027-06-12', precioTotal: 3025, servicios: 'Pack montaje completo' });

describe('contrato de eventos y bodas', () => {
  it('reparte el 50% de reserva y el resto', () => {
    expect(importesContrato({ precioTotal: 3025 })).toEqual({ total: 3025, reserva: 1512.5, resto: 1512.5, base: 2500 });
    expect(importesContrato({ precioTotal: 1000.01 }).resto).toBe(500);
  });

  it('pide lo mínimo', () => {
    expect(validarContratoEventos(nuevoContratoEventos())).toMatch(/cliente/);
    expect(validarContratoEventos({ ...base(), fechaFin: '2027-06-10' })).toMatch(/fin/);
    expect(validarContratoEventos(base())).toBeNull();
  });

  it('pone los importes en la cláusula 2 y deja en blanco lo que falta', () => {
    const c2 = clausulasContrato(base()).find((c) => c.titulo.startsWith('2.'))!.parrafos.join(' ');
    expect(c2).toContain('3025,00 €'.replace('3025', '3.025'));
    expect(c2).toContain('1.512,50 €');
    expect(c2).toContain('IBAN ____');
  });

  it('boda muestra contrayentes; evento solo si hay homenajeados', () => {
    const boda = anexoContrato({ ...base(), tipoEvento: 'boda', contrayentes: 'Ana y Luis' }).flatMap((b) => b.lineas).join(' ');
    expect(boda).toContain('Contrayentes: Ana y Luis');
    const ev = anexoContrato({ ...base(), tipoEvento: 'evento' }).flatMap((b) => b.lineas).join(' ');
    expect(ev).not.toContain('Contrayentes');
  });

  it('varios días', () => {
    expect(fechasEvento({ fechaEvento: '2027-06-12', fechaFin: '2027-06-13' })).toMatch(/^del 12 de junio de 2027 al 13 de junio de 2027$/);
  });

  it('genera el PDF', () => {
    const d = contratoEventosPdf(base(), { razonSocial: 'LA MONTADA SOUND, S.L.', nif: 'B21642913', direccion: 'Pozuelo' }, 'CT-TEST');
    expect(d.getNumberOfPages()).toBeGreaterThanOrEqual(8);
  });
});
