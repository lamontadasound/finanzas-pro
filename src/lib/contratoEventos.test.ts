import { describe, expect, it } from 'vitest';
import { nuevoContratoEventos, importesContrato, validarContratoEventos, clausulasContrato, anexoContrato, fechasEvento, contratoEventosPdf } from './contratoEventos';

const base = () => ({ ...nuevoContratoEventos(), cliente: 'Ana López', nif: '12345678Z', fechaEvento: '2027-06-12', precioTotal: 3025, servicios: 'Pack montaje completo' });

describe('contrato de eventos y bodas', () => {
  it('reparte el 50% de reserva y el resto', () => {
    expect(importesContrato({ precioTotal: 3025 })).toMatchObject({ total: 3025, reserva: 1512.5, resto: 1512.5, base: 2500, iva: 525, es50: true });
    expect(importesContrato({ precioTotal: 0, precioBase: 2500 })).toMatchObject({ total: 3025, iva: 525 });
    expect(importesContrato({ precioTotal: 3025, primerPago: 1000 })).toMatchObject({ reserva: 1000, resto: 2025, es50: false });
    expect(importesContrato({ precioTotal: 3025, primerPago: 9999 }).es50).toBe(true);
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

  it('anexo del modelo v2: autorizado por defecto y particulares solo si hay', () => {
    const a = anexoContrato(base()).flatMap((b) => b.lineas).join(' ');
    expect(a).toContain('solo el Cliente');
    expect(a).not.toContain('INVENTARIO');
    expect(anexoContrato(base()).some((b) => b.titulo === 'CONDICIONES PARTICULARES')).toBe(false);
    expect(anexoContrato({ ...base(), particulares: 'Montaje el día antes' }).some((b) => b.titulo === 'CONDICIONES PARTICULARES')).toBe(true);
  });

  it('horas extra 250 / 350 y sin frases quitadas en la v2', () => {
    const c7 = clausulasContrato(base()).find((c) => c.titulo.startsWith('7.'))!.parrafos.join(' ');
    expect(c7).toContain('250,00 €');
    expect(c7).toContain('350,00 €');
    expect(c7).not.toContain('treinta minutos');
  });

  it('sin hora extra no pone precios de hora extra', () => {
    for (const c of [{ ...base(), hayHoraExtra: false }, { ...base(), horaExtra: 0 }]) {
      const c7 = clausulasContrato(c).find((x) => x.titulo.startsWith('7.'))!.parrafos.join(' ');
      expect(c7).not.toContain('250,00 €');
      expect(c7).toContain('no incluye horas adicionales');
      expect(anexoContrato(c).flatMap((b) => b.lineas).join(' ')).toContain('Hora adicional, IVA incluido: no se contempla');
    }
  });

  it('precio con y sin IVA, y anexo sin apartados vacíos', () => {
    const c2 = clausulasContrato(base()).find((c) => c.titulo.startsWith('2.'))!.parrafos.join(' ');
    expect(c2).toContain('2.500,00 € sin IVA');
    expect(c2).toContain('1.512,50 € IVA incluido (1.250,00 € sin IVA)');
    const titulos = anexoContrato(base()).map((b) => b.titulo);
    expect(titulos).not.toContain('MODELO DE PARTE DE INCIDENCIA');
    expect(titulos).not.toContain('CONDICIONES TÉCNICAS Y PREVENCIÓN ACORDADAS');
    expect(anexoContrato({ ...base(), electrico: '2 tomas 16 A' }).map((b) => b.titulo)).toContain('CONDICIONES TÉCNICAS Y PREVENCIÓN ACORDADAS');
    expect(anexoContrato(base()).flatMap((b) => b.lineas).join(' ')).not.toContain('Interlocutor');
  });

  it('primer pago elegido a mano', () => {
    const c2 = clausulasContrato({ ...base(), primerPago: 1000 }).find((c) => c.titulo.startsWith('2.'))!.parrafos.join(' ');
    expect(c2).toContain('como primer pago 1.000,00 € IVA incluido');
    expect(c2).toContain('El resto del precio, esto es, 2.025,00 €');
    expect(c2).not.toContain('50%');
  });

  it('varios días', () => {
    expect(fechasEvento({ fechaEvento: '2027-06-12', fechaFin: '2027-06-13' })).toMatch(/^del 12 de junio de 2027 al 13 de junio de 2027$/);
  });

  it('genera el PDF', () => {
    const d = contratoEventosPdf(base(), { razonSocial: 'LA MONTADA SOUND, S.L.', nif: 'B21642913', direccion: 'Pozuelo' }, 'CT-TEST');
    expect(d.getNumberOfPages()).toBeGreaterThanOrEqual(8);
  });
});
