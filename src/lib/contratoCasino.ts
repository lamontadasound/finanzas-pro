// Contrato de servicio de casino para eventos (modelo del abogado, 2026).
// El texto legal es fijo; solo se rellenan los datos del Anexo I. Lo que se
// deja vacío sale en el PDF como una línea en blanco para completar a mano.
// El parte de incidencia NO va dentro del contrato: es una hoja aparte.
import { BLANCO, BROWN, v, euros, fechaLarga, nuevoDocContrato, parteMontada, type EmisorContrato } from './contratoPdfKit';

export const PLANTILLA_CASINO = 'casino-2026' as const;

export interface MesaCasino { mesa: string; cantidad: number; croupiers: number; material: string; espacio: string; /** Solo contratos antiguos: antes se ponía precio por mesa. */ precioBase?: number }

export interface ContratoCasino {
  firmante: string;
  cliente: string; nif: string; domicilio: string; representante: string; email: string; telefono: string;
  cuentaEntidad: string; iban: string;
  fechaEvento: string; tipoYAsistentes: string; recinto: string; cubierto: 'si' | 'no'; responsableRecinto: string;
  accesoMontaje: string; listoA: string; servicio: string; desmontaje: string;
  interlocutor: string; autorizado: string; menores: 'si' | 'no';
  presupuestoRef: string;
  mesas: MesaCasino[];
  duracionHoras: string;
  hayHoraExtra: boolean; horaExtraMesaBase: number; // sin IVA
  fichasPorAsistente: string; personalizacion: string; vestuario: string; premios: string;
  reposicionFicha: number; reposicionBaraja: number; reposicionOtros: string; // con IVA
  precioBase: number; // precio total sin IVA
  primerPago: number; // con IVA; 0 = 50%
  comida: string;
  particulares: string;
  lugarFirma: string; fechaFirma: string;
}

const hoy = () => new Date().toISOString().slice(0, 10);
const r2 = (n: number) => Math.round(n * 100) / 100;
const conIva = (n: number) => `${euros(n)} IVA incluido (${euros(r2(n / 1.21))} sin IVA)`;

export const MESAS_TIPICAS: MesaCasino[] = [
  { mesa: 'Ruleta', cantidad: 1, croupiers: 1, material: 'Mesa profesional, tapete, ruleta, bola, fichas, marcador y rastrillo', espacio: '' },
  { mesa: 'Blackjack', cantidad: 1, croupiers: 1, material: 'Mesa profesional, tapete, sabot, barajas, fichas y bandeja de fichas', espacio: '' },
];
export const mesaVacia = (): MesaCasino => ({ mesa: '', cantidad: 1, croupiers: 1, material: '', espacio: '' });

export const nuevoContratoCasino = (previo?: Partial<ContratoCasino>): ContratoCasino => ({
  firmante: previo?.firmante || 'D.ª Julia Centeno Hernández de Santamaría',
  cliente: '', nif: '', domicilio: '', representante: '', email: '', telefono: '',
  cuentaEntidad: previo?.cuentaEntidad ?? '', iban: previo?.iban ?? '',
  fechaEvento: '', tipoYAsistentes: '', recinto: '', cubierto: 'si', responsableRecinto: '',
  accesoMontaje: '', listoA: '', servicio: '', desmontaje: '',
  interlocutor: '', autorizado: '', menores: 'no',
  presupuestoRef: '',
  mesas: MESAS_TIPICAS.map((m) => ({ ...m })),
  duracionHoras: '3',
  hayHoraExtra: true, horaExtraMesaBase: previo?.horaExtraMesaBase ?? 0,
  fichasPorAsistente: '', personalizacion: 'No', vestuario: 'Estándar de La Montada', premios: 'No',
  reposicionFicha: previo?.reposicionFicha ?? 0, reposicionBaraja: previo?.reposicionBaraja ?? 0, reposicionOtros: previo?.reposicionOtros ?? '',
  precioBase: 0,
  primerPago: 0,
  comida: '',
  particulares: '',
  lugarFirma: previo?.lugarFirma || 'Pozuelo de Alarcón (Madrid)', fechaFirma: hoy(),
});

export const mesasConDatos = (c: Pick<ContratoCasino, 'mesas'>) => (c.mesas ?? []).filter((m) => m.mesa.trim());

/** Total = precio sin IVA + 21% de IVA. Primer pago: 50% salvo que se elija otra cantidad.
 *  (Contratos antiguos sin precio total: suma de los precios por mesa.) */
export const importesCasino = (c: Pick<ContratoCasino, 'mesas' | 'primerPago'> & { precioBase?: number }) => {
  const base = Number(c.precioBase) > 0 ? r2(Number(c.precioBase)) : r2(mesasConDatos(c).reduce((a, m) => a + (Number(m.precioBase) || 0), 0));
  const total = r2(base * 1.21);
  const mitad = r2(total / 2);
  const elegido = r2(Number(c.primerPago) || 0);
  const reserva = elegido > 0 && elegido <= total ? elegido : mitad;
  return { base, iva: r2(total - base), total, reserva, resto: r2(total - reserva), es50: reserva === mitad };
};
export const hayHoraExtraCasino = (c: Pick<ContratoCasino, 'hayHoraExtra' | 'horaExtraMesaBase'>) => c.hayHoraExtra !== false && Number(c.horaExtraMesaBase) > 0;

export function validarContratoCasino(c: ContratoCasino): string | null {
  if (!c.cliente.trim()) return 'Falta el nombre del cliente.';
  if (!c.nif.trim()) return 'Falta el DNI/NIF del cliente.';
  if (!c.fechaEvento) return 'Falta la fecha del evento.';
  if (!mesasConDatos(c).length) return 'Añade al menos una mesa.';
  if (!(importesCasino(c).total > 0)) return 'Pon el precio total sin IVA.';
  return null;
}

/** Cláusulas del contrato con los datos ya puestos. */
export function clausulasCasino(c: ContratoCasino): { titulo: string; parrafos: string[] }[] {
  const { total, base, iva, reserva, resto, es50 } = importesCasino(c);
  return [
    { titulo: '1. OBJETO DEL CONTRATO', parrafos: [
      'La Montada prestará un servicio de casino de entretenimiento para el evento, fecha y recinto identificados en el Anexo I, que incluye las mesas de juego profesionales, los croupiers profesionales, las fichas y el resto del material de casino descritos en el apartado “Casino” de dicho anexo, así como su transporte, montaje y desmontaje. El presupuesto aceptado, adjunto al Anexo I, forma parte del contrato.',
      'Todo el material se entregará montado y listo para jugar antes de la hora de inicio del servicio indicada en el Anexo I. No se incluyen premios, regalos, decoración adicional, bebida o comida para los asistentes, ni otros servicios de La Montada, salvo inclusión expresa. Cualquier adicional requerirá aceptación previa y escrita de su alcance y precio total.',
    ] },
    { titulo: '2. CARÁCTER RECREATIVO DEL CASINO', parrafos: [
      'El casino tiene una finalidad exclusivamente recreativa y de animación. En ningún caso se realizarán apuestas con dinero ni con bienes de valor económico. Las fichas, billetes o vales de juego que se entreguen a los asistentes no tienen valor económico, no pueden comprarse ni venderse y no son canjeables por dinero, bienes o servicios.',
      'La participación de los asistentes será gratuita. El Cliente no podrá cobrar a los asistentes por jugar, por obtener fichas ni por participar en ningún sorteo vinculado al casino, ni permitir que los asistentes realicen apuestas entre ellos con dinero durante el servicio.',
      'Si el Cliente decide entregar premios o regalos a los asistentes, lo hará por su cuenta, bajo su exclusiva responsabilidad y con carácter simbólico, y será el único responsable de que la entrega cumpla la normativa aplicable en materia de juego, publicidad y fiscalidad. La Montada no organiza, entrega ni responde de dichos premios.',
      'Si los croupiers detectan apuestas con dinero, cobros por jugar o cualquier uso del casino contrario a esta cláusula, La Montada podrá suspender inmediatamente las mesas afectadas, sin devolución del precio y sin perjuicio de reclamar los daños que se le causen.',
    ] },
    { titulo: '3. PRECIO Y FORMA DE PAGO', parrafos: [
      `El precio total del servicio es de ${euros(total)}, IVA (21%) incluido, que corresponde a ${euros(base)} sin IVA más ${euros(iva)} de IVA, conforme al desglose del apartado “Casino” del Anexo I.`,
      `A la firma se abonará ${es50 ? 'el 50% del precio total, esto es, ' : 'como primer pago '}${conIva(reserva)}, como pago a cuenta para la reserva de fecha, material y croupiers, a la cuenta bancaria abierta a nombre de La Montada Sound, en la entidad ${v(c.cuentaEntidad)}, con número IBAN ${v(c.iban)} (la “Cuenta Bancaria”). La Montada confirmará por escrito la recepción y la reserva. Hasta que se reciba este pago, la fecha no quedará reservada.`,
      `${es50 ? 'El 50% restante' : 'El resto del precio'}, esto es, ${conIva(resto)}, se abonará como máximo diez días naturales antes del evento mediante transferencia a la Cuenta Bancaria. Si el contrato se firma dentro de ese plazo, el precio total se abonará a la firma. La Montada emitirá los justificantes y facturas correspondientes.`,
      'Ante un impago vencido, La Montada requerirá por escrito su subsanación, concediendo al menos tres días naturales y advirtiendo de sus consecuencias. Si persiste el impago, podrá no prestar el servicio o resolver el contrato mediante comunicación expresa, con liquidación conforme a la cláusula 9. Cuando el Cliente actúe como empresario o profesional, las cantidades vencidas devengarán el interés de demora previsto en la Ley 3/2004, de 29 de diciembre.',
    ] },
    { titulo: '4. MONTAJE PREVIO, HORARIOS Y DESMONTAJE', parrafos: [
      'La Montada realizará el transporte, el montaje y la preparación de todas las mesas y del material de casino antes de la hora de inicio del servicio, de modo que esté todo listo para jugar a la llegada de los asistentes. Para ello, el Cliente garantizará el acceso al recinto con la antelación indicada en el Anexo I, que no será inferior a dos horas antes del inicio del servicio.',
      'El Cliente coordinará con el recinto el acceso, la carga y descarga, el estacionamiento necesario y los horarios de montaje y desmontaje. Si el acceso se retrasa o el espacio no está disponible por causas ajenas a La Montada, la hora de finalización no se ampliará automáticamente, y La Montada no responderá de que el casino no esté montado a la hora prevista.',
      'El tiempo de servicio de casino se contará desde la hora de inicio pactada en el Anexo I, aunque los asistentes empiecen a jugar más tarde. Al finalizar el servicio, La Montada recogerá las fichas y desmontará el material. El recinto facilitará acceso para retirarlo y el Cliente no podrá retenerlo como garantía de ninguna reclamación.',
    ] },
    { titulo: '5. CROUPIERS Y DIRECCIÓN DEL JUEGO', parrafos: [
      'Los croupiers serán profesionales seleccionados y coordinados por La Montada, que conserva la dirección del servicio, la organización de las mesas y las reglas de juego. Los croupiers explicarán las reglas a los asistentes, dirigirán las partidas, custodiarán las fichas y velarán por el buen uso del material.',
      'La Montada podrá sustituir a cualquier croupier por otro de experiencia equivalente, sin necesidad de aceptación del Cliente, salvo que se haya contratado nominalmente a una persona concreta. Podrá también sustituir mesas o material por otros de características equivalentes o superiores, sin incremento de precio.',
      'Los croupiers podrán limitar el número de jugadores por mesa, pausar una partida, retirar fichas o no admitir en la mesa a los asistentes que se comporten de forma inadecuada, estén visiblemente ebrios, dañen el material o incumplan las indicaciones. El Cliente colaborará con ellos y no podrá exigirles tareas distintas de las propias del servicio de casino.',
      'Cuando el servicio dure más de cinco horas, el Cliente proporcionará comida y bebida sin alcohol a los croupiers y al personal de La Montada. Los croupiers dispondrán de las pausas razonables necesarias, que La Montada organizará de forma que se mantenga el funcionamiento de las mesas en la medida de lo posible.',
    ] },
    { titulo: '6. RESPONSABILIDAD SOBRE EL MATERIAL DE CASINO', parrafos: [
      'Las mesas, ruletas, tapetes, fichas, cartas, sabots y demás material de casino permanecerán bajo el control de La Montada durante el servicio. Su instalación no supone su entrega en alquiler al Cliente.',
      'El Cliente responderá de los daños, pérdidas y sustracciones del material causados por los asistentes, el personal del recinto, otros proveedores o cualquier persona presente en el evento por invitación o autorización suya, así como de los causados por incumplir sus obligaciones de este contrato, sin perjuicio de su derecho a reclamar a los causantes. Se excluyen el desgaste normal y los daños imputables a La Montada.',
      'El Cliente abonará el coste acreditado de reparación del material dañado o, si no es reparable, su coste de reposición por material nuevo equivalente. Las fichas, cartas u otros elementos que falten al finalizar el servicio se abonarán al precio de reposición indicado en el Anexo I. La Montada documentará el incidente mediante un parte de incidencia, con fotografías y los datos disponibles, y facilitará copia al Cliente, que podrá formular observaciones.',
      'No se exigirá fianza previa. Una vez producido el daño, La Montada podrá solicitar al Cliente un anticipo para afrontar la reparación o reposición, que deberá abonarse en un plazo de tres días hábiles y se descontará de la liquidación definitiva.',
    ] },
    { titulo: '7. CONDICIONES DEL ESPACIO Y CONDUCTA DE LOS ASISTENTES', parrafos: [
      'El Cliente garantizará un espacio interior o cubierto, con suelo plano y estable, iluminación suficiente y las dimensiones mínimas indicadas en el Anexo I para cada mesa y sus jugadores, así como, en su caso, una toma de corriente cercana. En eventos al aire libre, sin una cubierta adecuada frente a lluvia, viento o sol intenso, La Montada podrá no montar o retirar las mesas para proteger el material, aplicándose la cláusula 9.',
      'Los asistentes no podrán apoyar bebidas, comida u otros objetos sobre los tapetes ni sobre el material, ni manipular las ruletas, las fichas o las cartas fuera de las indicaciones de los croupiers. El Cliente informará a sus invitados de estas normas y colaborará para hacerlas cumplir, solicitando la intervención del responsable del recinto o del personal de seguridad cuando sea necesario.',
      'La participación de menores de edad solo será posible si el Cliente lo autoriza expresamente en el Anexo I, bajo su responsabilidad y la de sus padres o tutores presentes en el evento. La Montada podrá limitarla cuando lo considere inadecuado.',
      'Ante derrames, manipulación, agresiones, amenazas o cualquier riesgo para las personas o el material, La Montada podrá cerrar la mesa afectada o suspender el servicio, avisando al Cliente o su interlocutor salvo urgencia. Si el riesgo persiste o se repite, podrá dar por finalizado el servicio y retirar el material, sin devolución del precio cuando la causa sea imputable al Cliente o a los asistentes.',
    ] },
    { titulo: '8. HORAS EXTRA', parrafos: hayHoraExtraCasino(c) ? [
      'Cada hora adicional de servicio de casino tendrá el precio por mesa indicado en el Anexo I, IVA incluido, si se contrata antes del día del evento, con un recargo del 40% si se solicita el mismo día. El precio incluye el croupier y el material de cada mesa. El pago se realizará al confirmar la ampliación, salvo acuerdo escrito distinto.',
      'Las horas extra estarán sujetas a la disponibilidad de los croupiers y a los horarios del recinto. Solo el Cliente o la persona autorizada en el Anexo I podrán contratarlas.',
    ] : [
      'Este contrato no incluye horas adicionales de servicio de casino. Cualquier ampliación del horario requerirá un nuevo acuerdo por escrito, con su precio.',
    ] },
    { titulo: '9. MODIFICACIONES Y CANCELACIONES', parrafos: [
      '(A) Modificaciones',
      'Los cambios de fecha, lugar, horario, número o tipo de mesas deberán solicitarse por escrito con al menos quince días naturales de antelación y solo serán efectivos cuando ambas partes acepten por escrito las nuevas condiciones y, en su caso, el precio revisado. Las solicitudes posteriores se atenderán según disponibilidad.',
      '(B) Cancelación por el Cliente',
      'El Cliente comunicará la cancelación por escrito. La Montada podrá reclamar el valor de los servicios efectivamente realizados y los costes y perjuicios razonables, acreditados y no recuperables causados por la cancelación, incluidos los compromisos con los croupiers y el beneficio neto perdido por la fecha reservada cuando se acredite. La Montada remitirá una liquidación desglosada dentro de los quince días naturales siguientes.',
      'Si la cancelación se comunica con menos de diez días naturales de antelación, la reclamación podrá alcanzar el importe total contratado cuando los servicios realizados y los perjuicios justificados alcancen dicha cantidad. El pago a cuenta se aplicará a la liquidación justificada, cuyo importe no excederá del precio total, y el exceso se devolverá en los catorce días naturales siguientes.',
      '(C) Cancelación por La Montada y fuerza mayor',
      'Si La Montada cancela por una causa que le sea atribuible, devolverá los importes correspondientes a los servicios no prestados, sin perjuicio de los demás derechos que legalmente correspondan al Cliente.',
      'Ante un supuesto de fuerza mayor, la parte afectada lo comunicará sin demora y las partes valorarán un aplazamiento sujeto a disponibilidad. Si no hay acuerdo, se liquidarán los servicios efectivamente prestados y los gastos que legalmente procedan, devolviendo el resto.',
    ] },
    { titulo: '10. USO DE CONTENIDO AUDIOVISUAL', parrafos: [
      'La Montada podrá realizar fotografías o vídeos de sus mesas y material para su portfolio, redes sociales y material promocional, siempre que no permitan identificar a personas ni revelen información privada del evento. La captación y utilización de imágenes de personas identificables requerirá su autorización expresa, recogida por separado.',
    ] },
    { titulo: '11. LEGISLACIÓN APLICABLE Y RESOLUCIÓN DE CONTROVERSIAS', parrafos: [
      'El contrato se regirá por la legislación española. Las partes comunicarán por escrito cualquier discrepancia e intentarán resolverla de buena fe, sin que ello limite el ejercicio de sus derechos.',
      'Las controversias se someterán a los juzgados y tribunales competentes conforme a la normativa aplicable. Cuando el Cliente tenga la condición de consumidor, se respetarán las reglas de competencia y los derechos que legalmente le correspondan.',
    ] },
    { titulo: '12. COMUNICACIONES Y RESPONSABILIDAD', parrafos: [
      'Las comunicaciones se dirigirán a los correos y teléfonos identificados en el contrato y el Anexo I por medios que permitan acreditar su contenido y recepción, incluido correo electrónico o mensajería. El interlocutor designado por el Cliente podrá coordinar el servicio y recibir avisos, pero solo podrá contratar extras dentro de la autorización expresa del Anexo I.',
      'La Montada responderá de los incumplimientos que le sean atribuibles, pero no asumirá la organización general del evento, la vigilancia del público, los premios que entregue el Cliente ni las prestaciones de otros proveedores. No habrá responsabilidad por el mero desagrado subjetivo del Cliente cuando el servicio se haya prestado conforme al Anexo I. Cuando el Cliente actúe como empresario o profesional, la responsabilidad total de La Montada no excederá del precio del servicio, salvo dolo o culpa grave. No se excluye ni limita la responsabilidad que no pueda excluirse o limitarse legalmente.',
    ] },
    { titulo: '13. PRIVACIDAD Y CONFIDENCIALIDAD', parrafos: [
      'La Montada tratará los datos identificativos, de contacto y facturación necesarios para gestionar el contrato sobre la base de su ejecución, cumplir obligaciones legales y gestionar incidencias o defender reclamaciones sobre la base del interés legítimo cuando proceda. Los datos se conservarán durante los plazos legales de conservación y prescripción y solo se comunicarán a colaboradores que deban acceder para prestar el servicio, asesores, entidades financieras, aseguradoras y autoridades cuando resulte necesario. Los interesados podrán ejercer sus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad mediante el contacto de La Montada indicado en el encabezamiento, y reclamar ante la Agencia Española de Protección de Datos.',
      'Las partes protegerán la información privada del evento y la información comercial no pública recibida para ejecutar el contrato.',
    ] },
    { titulo: '14. DOCUMENTACIÓN Y SUBSISTENCIA DE DERECHOS', parrafos: [
      'El contrato, el Anexo I y el presupuesto adjunto delimitan el encargo. Las condiciones particulares del Anexo I prevalecerán sobre las generales en lo que válidamente las modifiquen. Ninguna modificación se entenderá aceptada por mero silencio. Si alguna estipulación no pudiera aplicarse, el resto subsistirá cuando legalmente sea posible.',
    ] },
  ];
}

const siNo = (x: 'si' | 'no') => (x === 'si' ? 'SÍ' : 'NO');
const eurOBlanco = (n: number) => (n > 0 ? euros(n) : `${BLANCO} €`);

/** Anexo I: datos del evento (líneas) y datos del casino. La tabla de mesas va aparte (filasMesas). */
export function anexoCasino(c: ContratoCasino): { evento: string[]; casino: string[] } {
  const { total, reserva, resto, es50 } = importesCasino(c);
  const horaExtraMesa = r2((Number(c.horaExtraMesaBase) || 0) * 1.21);
  return {
    evento: [
      `Fecha del evento: ${c.fechaEvento ? fechaLarga(c.fechaEvento) : BLANCO}. Tipo de evento y número previsto de asistentes: ${v(c.tipoYAsistentes)}.`,
      `Recinto, dirección completa y espacio donde se instalará el casino: ${v(c.recinto)}. Interior / cubierto: ${siNo(c.cubierto)}.`,
      `Responsable del recinto, teléfono y correo: ${v(c.responsableRecinto)}.`,
      `Acceso para montaje: ${v(c.accesoMontaje)} (mínimo dos horas antes del inicio). Casino montado y listo para jugar a las: ${v(c.listoA)}. Inicio y fin del servicio de casino: ${v(c.servicio)}. Desmontaje: ${v(c.desmontaje)}.`,
      `${c.interlocutor.trim() ? `Interlocutor del Cliente durante el evento: ${c.interlocutor.trim()}. ` : ''}Persona autorizada para contratar horas extra: ${c.autorizado.trim() || 'no se designa; solo el Cliente'}.`,
      `Participación de menores autorizada por el Cliente: ${siNo(c.menores)}.`,
    ],
    casino: [
      `Presupuesto adjunto: ${v(c.presupuestoRef)}.`,
      `Duración del servicio de casino: ${v(c.duracionHoras)} horas. Precio por hora extra y mesa, IVA incluido: ${hayHoraExtraCasino(c) ? `${euros(horaExtraMesa)} (${euros(r2(c.horaExtraMesaBase))} sin IVA)` : 'no se contempla'}.`,
      `Fichas, billetes o vales de juego por asistente: ${v(c.fichasPorAsistente)}. Personalización (logo, nombres, fecha): ${v(c.personalizacion)}.`,
      `Vestuario de los croupiers: ${v(c.vestuario)}.`,
      `Premios o regalos que entregará el Cliente, bajo su responsabilidad: ${v(c.premios)}.`,
      `Precio de reposición de material extraviado: ficha ${eurOBlanco(c.reposicionFicha)}; baraja ${eurOBlanco(c.reposicionBaraja)}; otros ${v(c.reposicionOtros)}.`,
      `Precio total del servicio, IVA incluido: ${euros(total)} (${euros(r2(total / 1.21))} sin IVA). Pago a cuenta a la firma${es50 ? ' (50%)' : ''}: ${euros(reserva)}. Resto${es50 ? ' (50%)' : ''}: ${euros(resto)}, como máximo diez días antes del evento.`,
      `Comida y bebida para croupiers y personal (si el servicio supera cinco horas): ${v(c.comida)}.`,
      ...(c.particulares.trim() ? [`Condiciones particulares: ${c.particulares.trim()}.`] : []),
    ],
  };
}

export const filasMesas = (c: Pick<ContratoCasino, 'mesas'>) =>
  mesasConDatos(c).map((m) => [m.mesa.trim(), String(m.cantidad || 1), String(m.croupiers || 0), m.material.trim() || '—', m.espacio.trim() ? `${m.espacio.trim()} m` : '']);

export function contratoCasinoPdf(c: ContratoCasino, emisor: EmisorContrato) {
  const k = nuevoDocContrato();
  const { text, titulo } = k;
  text('CONTRATO DE SERVICIO DE CASINO PARA EVENTOS', { bold: true, size: 12.5, gap: 1.5 });
  text(`Casino · ${c.fechaEvento ? fechaLarga(c.fechaEvento) : 'fecha por confirmar'}`, { size: 8.5, color: BROWN, gap: 5 });
  text(parteMontada(emisor, c.firmante));
  text(`De otra parte, D./D.ª o entidad ${v(c.cliente)}, con DNI/NIE/NIF ${v(c.nif)}, domicilio en ${v(c.domicilio)}, ${c.representante.trim() ? `representada por ${c.representante.trim()}` : 'actuando en nombre propio'}${[c.email, c.telefono].some((s) => s.trim()) ? ` (contacto: ${[c.email, c.telefono].filter((s) => s.trim()).join(' · ')})` : ''}, en adelante, el “Cliente”.`);
  text('Ambas partes se reconocen capacidad suficiente para contratar.', { gap: 4 });

  for (const cl of clausulasCasino(c)) {
    titulo(cl.titulo);
    for (const p of cl.parrafos) text(p, /^\([A-E]\) /.test(p) ? { bold: true, size: 9.6, gap: 1.2 } : undefined);
  }

  if (k.y > k.BOTTOM - 60) k.next(); else k.y += 6;
  text(`En prueba de conformidad, ambas partes firman este contrato y su anexo, recibiendo un ejemplar completo en soporte duradero. Lugar: ${v(c.lugarFirma)}. Fecha de firma: ${c.fechaFirma ? fechaLarga(c.fechaFirma) : BLANCO}.`, { gap: 0 });
  k.firmas(['La Montada Sound, S.L.', v(c.firmante)], ['El Cliente', v(c.cliente)], 24);

  k.next();
  text('ANEXO I - DETALLES DEL EVENTO Y CASINO', { bold: true, size: 12, gap: 4 });
  const a = anexoCasino(c);
  titulo('DATOS DEL EVENTO'); a.evento.forEach((l) => text(l));
  titulo('CASINO');
  const filas = filasMesas(c);
  k.tabla(['Mesa / concepto', 'Cant.', 'Croupiers', 'Qué incluye', 'Espacio mínimo'],
    filas.length ? filas : [['', '', '', '', '']], [18, 7, 13, 47, 15]);
  a.casino.forEach((l) => text(l));
  k.pie();
  return k.d;
}
