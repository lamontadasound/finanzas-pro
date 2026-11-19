import { describe, expect, it } from 'vitest';
import { nuevoContratoCasino, importesCasino, validarContratoCasino, clausulasCasino, anexoCasino, contratoCasinoPdf } from './contratoCasino';

const base = () => {
  const c = nuevoContratoCasino();
  return { ...c, cliente: 'Empresa Ejemplo SL', nif: 'B00000000', fechaEvento: '2027-05-20',
    mesas: [{ ...c.mesas[0], precioBase: 600 }, { ...c.mesas[1], precioBase: 400 }] };
};

describe('contrato de casino', () => {
  it('suma las mesas sin IVA y calcula IVA y pagos', () => {
    expect(importesCasino(base())).toMatchObject({ base: 1000, iva: 210, total: 1210, reserva: 605, resto: 605, es50: true });
    expect(importesCasino({ ...base(), primerPago: 300 })).toMatchObject({ reserva: 300, resto: 910, es50: false });
  });

  it('pide lo mínimo', () => {
    expect(validarContratoCasino(nuevoContratoCasino())).toMatch(/cliente/);
    expect(validarContratoCasino({ ...base(), mesas: base().mesas.map((m) => ({ ...m, precioBase: 0 })) })).toMatch(/precio/);
    expect(validarContratoCasino(base())).toBeNull();
  });

  it('precio con y sin IVA, sin Anexo II y hora extra opcional', () => {
    const cl = clausulasCasino(base());
    expect(cl).toHaveLength(14);
    expect(cl[2].parrafos[0]).toContain('1.210,00 €');
    expect(cl[2].parrafos[0]).toContain('1.000,00 € sin IVA');
    const todo = cl.flatMap((c) => c.parrafos).join(' ');
    expect(todo).not.toContain('Anexo II');
    expect(cl[7].parrafos[0]).toContain('no incluye horas adicionales');
    expect(clausulasCasino({ ...base(), horaExtraMesaBase: 100 })[7].parrafos[0]).toContain('recargo del 40%');
  });

  it('anexo con interlocutor solo si lo hay', () => {
    const a = anexoCasino(base());
    expect(a.evento.join(' ')).not.toContain('Interlocutor');
    expect(a.evento.join(' ')).toContain('solo el Cliente');
    expect(a.casino.join(' ')).toContain('Pago a cuenta a la firma (50%): 605,00 €');
  });

  it('genera el PDF', () => {
    expect(contratoCasinoPdf(base(), { razonSocial: '', nif: '', direccion: '' }).getNumberOfPages()).toBeGreaterThanOrEqual(5);
  });
});
