import { describe, expect, it } from 'vitest';
import { dias, horas, errorTerminos, type Terminos } from './contratoTerminos';
import * as E from './contratoEventos';
import * as A from './contratoAlquiler';
import * as C from './contratoCasino';
import * as I from './contratoInstalacion';

const texto = (cl: { parrafos: string[] }[]) => cl.flatMap((c) => c.parrafos).join('\n');
/** Cada plazo, al cambiarlo, tiene que cambiar el texto del contrato. */
const todosCambian = (defs: readonly { key: string; def: number }[], pinta: (t: Terminos) => string) =>
  defs.forEach((d) => expect(pinta({ [d.key]: d.def + 1 }), d.key).not.toBe(pinta({})));

describe('plazos modificables', () => {
  it('escribe bien los números', () => {
    expect([dias(10, 'natural'), dias(1, 'hábil'), dias(21), horas(48), horas(72, true), horas(1)])
      .toEqual(['diez días naturales', 'un día hábil', '21 días', 'cuarenta y ocho horas', 'setenta y dos horas hábiles', 'una hora']);
  });
  it('cada plazo cambia el texto en los cuatro contratos', () => {
    todosCambian(E.TERMINOS_EVENTOS, (t) => texto(E.clausulasContrato({ ...E.nuevoContratoEventos(), terminos: t })));
    todosCambian(A.TERMINOS_ALQUILER, (t) => texto(A.clausulasAlquiler({ ...A.nuevoContratoAlquiler(), terminos: t })));
    todosCambian(C.TERMINOS_CASINO, (t) => texto(C.clausulasCasino({ ...C.nuevoContratoCasino(), horaExtraMesaBase: 100, terminos: t })));
    todosCambian(I.TERMINOS_INSTALACION, (t) => texto(I.clausulasInstalacion({ ...I.nuevoContratoInstalacion(), terminos: t })));
  });
  it('ninguna plantilla se queda sin sustituir', () => {
    for (const s of [texto(E.clausulasContrato(E.nuevoContratoEventos())), texto(A.clausulasAlquiler(A.nuevoContratoAlquiler())), texto(C.clausulasCasino(C.nuevoContratoCasino())), texto(I.clausulasInstalacion(I.nuevoContratoInstalacion()))])
      expect(s).not.toMatch(/\$\{|undefined|NaN/);
  });
  it('avisa de valores imposibles en vez de cambiarlos', () => {
    expect(errorTerminos(A.TERMINOS_ALQUILER, { retencion: 120 })).toMatch(/100/);
    expect(errorTerminos(A.TERMINOS_ALQUILER, { fianza: 0 })).toMatch(/2 o más/);
    expect(errorTerminos(C.TERMINOS_CASINO, { recargo: 0 })).toBeNull();
  });
});

describe('hora extra de eventos', () => {
  const b = () => ({ ...E.nuevoContratoEventos(), precioBase: 1000, precioTotal: 1210 });
  const c7 = (c: E.ContratoEventos) => E.clausulasContrato(c).find((x) => x.titulo.startsWith('7.'))!.parrafos.join(' ');
  it('precio del mismo día propio, o el mismo si se deja vacío', () => {
    expect(c7({ ...b(), horaExtra: 200, horaExtraMismoDia: 220 })).toContain('220,00 € por hora adicional');
    const igual = c7({ ...b(), horaExtra: 200, horaExtraMismoDia: 0 });
    expect(igual).toContain('tanto si se contrata antes como el mismo día');
    expect(igual).not.toContain('350');
  });
  it('se elige qué incluye', () => {
    expect(c7({ ...b(), horaExtraIncluye: ['DJ'], horaExtraOtros: 'luces de pista', horaExtraNoIncluye: 'humo.' }))
      .toContain('Este precio incluye únicamente: DJ y luces de pista. No incluye: personal técnico, equipos y humo.');
  });
  it('los contratos antiguos conservan su precio del mismo día', () => {
    expect(E.cargarContratoEventos({ horaExtra: 300 }).horaExtraMismoDia).toBe(400);
    expect(E.cargarContratoEventos({ horaExtra: 300, horaExtraMismoDia: 0 }).horaExtraMismoDia).toBe(0);
  });
  it('avisa si el primer pago supera el total', () => {
    expect(E.validarContratoEventos({ ...b(), cliente: 'A', nif: 'B', fechaEvento: '2027-01-01', servicios: 'x', primerPago: 5000 })).toMatch(/primer pago/);
  });
});
