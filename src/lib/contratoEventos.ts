// Contrato de servicios audiovisuales para eventos y bodas (modelo v2 del abogado).
// El texto legal es fijo (transcrito del modelo de La Montada); solo se
// rellenan los puntos clave. Los campos vacíos salen en el PDF como una
// línea en blanco para completar a mano.
import { BLANCO, v, euros, fechaLarga, nuevoDocContrato, parteMontada, type EmisorContrato } from './contratoPdfKit';
export { euros, type EmisorContrato };

export const PLANTILLA_EVENTOS = 'eventos-2026' as const;

export interface ContratoEventos {
  tipoEvento: 'boda' | 'evento';
  // Partes
  firmante: string; cargoFirmante: string;
  cliente: string; nif: string; domicilio: string; representante: string; email: string; telefono: string;
  // Precio y pago
  precioTotal: number; // IVA incluido
  cuentaTitular: string; cuentaEntidad: string; iban: string;
  // Firma
  lugarFirma: string; fechaFirma: string;
  // Anexo I · evento
  fechaEvento: string; fechaFin: string; tipoYAsistentes: string;
  recinto: string; responsableRecinto: string;
  montaje: string; pruebas: string; servicio: string; desmontaje: string;
  duracion: string; hayHoraExtra?: boolean; horaExtra: number; tecnicosDjs: string;
  contrayentes: string; interlocutor: string; autorizado: string; limiteAutorizado: string; contactoMontada: string;
  // Anexo I · servicios
  presupuestoRef: string; servicios: string; personal: string; extras: string;
  // Anexo I · condiciones técnicas
  electrico: string; accesos: string; zonaTecnica: string; liquidos: string;
  exterior: 'si' | 'no'; exteriorPlan: string; planMeteo: string; acustica: string;
  proveedores: string; comida: string; licencias: string;
  particulares: string;
}

const hoy = () => new Date().toISOString().slice(0, 10);

export const nuevoContratoEventos = (previo?: Partial<ContratoEventos>): ContratoEventos => ({
  tipoEvento: 'boda',
  firmante: previo?.firmante || 'D.ª Julia Centeno Hernández de Santamaría', cargoFirmante: previo?.cargoFirmante ?? '',
  cliente: '', nif: '', domicilio: '', representante: '', email: '', telefono: '',
  precioTotal: 0,
  cuentaTitular: previo?.cuentaTitular || 'La Montada Sound, S.L.', cuentaEntidad: previo?.cuentaEntidad ?? '', iban: previo?.iban ?? '',
  lugarFirma: previo?.lugarFirma || 'Pozuelo de Alarcón (Madrid)', fechaFirma: hoy(),
  fechaEvento: '', fechaFin: '', tipoYAsistentes: '', recinto: '', responsableRecinto: '',
  montaje: '', pruebas: '', servicio: '', desmontaje: '',
  duracion: '3 horas', hayHoraExtra: true, horaExtra: 250, tecnicosDjs: '',
  contrayentes: '', interlocutor: '', autorizado: '', limiteAutorizado: '', contactoMontada: previo?.contactoMontada ?? '',
  presupuestoRef: '', servicios: '', personal: '', extras: 'Ninguno',
  electrico: '', accesos: '', zonaTecnica: '', liquidos: '',
  exterior: 'no', exteriorPlan: '', planMeteo: '', acustica: '', proveedores: '', comida: '', licencias: '',
  particulares: '',
});

const r2 = (n: number) => Math.round(n * 100) / 100;
export const importesContrato = (c: Pick<ContratoEventos, 'precioTotal'>) => {
  const total = r2(Number(c.precioTotal) || 0);
  const reserva = r2(total / 2);
  return { total, reserva, resto: r2(total - reserva), base: r2(total / 1.21) };
};

/** Hay hora extra si no se ha marcado que no y el precio es mayor que 0. */
export const hayHoraExtra = (c: Pick<ContratoEventos, 'hayHoraExtra' | 'horaExtra'>) => c.hayHoraExtra !== false && Number(c.horaExtra) > 0;
/** «X € IVA incluido (Y € sin IVA)». */
const conIva = (n: number) => `${euros(n)} IVA incluido (${euros(Math.round(n / 1.21 * 100) / 100)} sin IVA)`;
export const fechasEvento = (c: Pick<ContratoEventos, 'fechaEvento' | 'fechaFin'>) =>
  c.fechaFin && c.fechaFin !== c.fechaEvento ? `del ${fechaLarga(c.fechaEvento)} al ${fechaLarga(c.fechaFin)}` : fechaLarga(c.fechaEvento);

/** Lo mínimo para que el contrato tenga sentido. Devuelve el error o null. */
export function validarContratoEventos(c: ContratoEventos): string | null {
  if (!c.cliente.trim()) return 'Falta el nombre del cliente.';
  if (!c.nif.trim()) return 'Falta el DNI/NIF del cliente.';
  if (!c.fechaEvento) return 'Falta la fecha del evento.';
  if (c.fechaFin && c.fechaFin < c.fechaEvento) return 'La fecha de fin no puede ser anterior a la del evento.';
  if (!(c.precioTotal > 0)) return 'Indica el precio total (IVA incluido).';
  if (!c.servicios.trim()) return 'Describe los servicios y equipos contratados.';
  return null;
}


/** Cláusulas del contrato con los datos ya puestos (modelo v2). */
export function clausulasContrato(c: ContratoEventos): { titulo: string; parrafos: string[] }[] {
  const { total, reserva, resto } = importesContrato(c);
  const hora = Number(c.horaExtra) || 0;
  const { base } = importesContrato(c);
  return [
    { titulo: '1. OBJETO DEL CONTRATO', parrafos: [
      'La Montada prestará los servicios de sonido, iluminación y montaje audiovisual expresamente descritos en el Anexo I, incluido el montaje y desmontaje allí especificado, para el evento, fecha y recinto identificados en dicho anexo. El presupuesto aceptado, adjunto al Anexo I forma parte del contrato. No se incluyen servicios de fotografía, grabación, edición, retransmisión, conexión a Internet ni entrega de archivos, salvo inclusión expresa. Cualquier adicional requerirá aceptación previa y escrita de su alcance y precio total.',
    ] },
    { titulo: '2. PRECIO Y FORMA DE PAGO', parrafos: [
      `El precio total del servicio es de ${euros(total)}, IVA (21%) incluido, que corresponde a ${euros(base)} sin IVA más ${euros(Math.round((total - base) * 100) / 100)} de IVA.`,
      `A la firma se abonará el 50% del precio total, esto es, ${conIva(reserva)}, como pago a cuenta para la reserva de fecha y la preparación del servicio, a la cuenta bancaria abierta a nombre de ${v(c.cuentaTitular)}, en la entidad ${v(c.cuentaEntidad)}, con número IBAN ${v(c.iban)} (la “Cuenta Bancaria”). La Montada confirmará por escrito la recepción y la reserva. La falta de pago no dejará sin efecto automáticamente el contrato: se aplicará el requerimiento y, en su caso, la resolución previstos a continuación.`,
      `El 50% restante, esto es, ${conIva(resto)}, se abonará como máximo diez días naturales antes del evento mediante transferencia a la Cuenta Bancaria. Si el contrato se firma dentro de ese plazo, el precio total se abonará a la firma, salvo calendario distinto aceptado por escrito. La Montada emitirá los justificantes y facturas correspondientes.`,
      'Ante un impago vencido, La Montada requerirá por escrito su subsanación, concediendo al menos tres días naturales y advirtiendo de sus consecuencias. Si persiste el impago después del referido plazo de tres días naturales, podrá suspender las prestaciones pendientes o resolver el contrato mediante comunicación expresa, con liquidación conforme a la cláusula 7. Si la contratación próxima al evento exige otro plazo, este deberá acordarse expresamente antes de contratar, quedando dispuesto expresamente en el Anexo I.',
    ] },
    { titulo: '3. RESPONSABILIDAD SOBRE LOS EQUIPOS', parrafos: [
      'La Montada instalará y manejará los equipos con diligencia profesional, con medidas razonables de estabilidad, protección del cableado y delimitación de la zona técnica. Los equipos seguirán bajo su control técnico: su instalación no supone su entrega en alquiler ni el traslado indiscriminado de su custodia al Cliente. Este respetará las indicaciones razonables de seguridad comunicadas y facilitará su cumplimiento por el recinto, sus proveedores y asistentes. No manipulará ni permitirá manipular, conectar, mover o utilizar equipos sin autorización del técnico responsable. Mantendrá la zona técnica libre de bebidas, comida, líquidos, confeti, efectos especiales y objetos que puedan dañar el material; no permitirá apoyar recipientes sobre los equipos ni acceder a cabinas, soportes o cableado.',
      'El Cliente responderá de los daños, sustracciones o pérdidas causadas por su actuación o por incumplir las obligaciones de prevención y colaboración de este contrato, cuando exista relación causal con el perjuicio. En particular, deberá avisar sin demora de conductas peligrosas que conozca, colaborar para detenerlas y solicitar la intervención del responsable del recinto o del personal de seguridad cuando sea necesario y razonablemente posible. Los daños causados por asistentes, personal del recinto u otros proveedores se reclamarán a sus responsables, sin perjuicio de la responsabilidad propia del Cliente y de los supuestos legalmente procedentes. Se excluyen el desgaste normal, las averías internas ajenas al uso indebido y los daños imputables a La Montada; si concurren causas, se atenderá a la contribución de cada responsable.',
      'La indemnización comprenderá el coste necesario y acreditado de diagnóstico y reparación. Si esta es técnicamente inviable o supera razonablemente el valor del equipo anterior al siniestro, se atenderá al coste de reposición por otro de prestaciones, antigüedad y estado equivalentes, descontando el valor recuperable del material dañado. Podrán incluirse el alquiler y transporte razonables de sustitución durante el tiempo estrictamente necesario y el beneficio neto efectivamente perdido en contrataciones concretas, directamente causado y debidamente acreditado. La Montada adoptará medidas razonables para reducir los daños y aportará presupuestos, facturas o informes que sustenten su reclamación.',
      'La Montada documentará el incidente tan pronto como sea razonablemente posible mediante un parte con fecha, hora, equipo y número de serie si existe, descripción, personas presentes y pruebas disponibles. Podrá obtener fotografías del daño y recabar datos de testigos limitados a lo necesario para gestionar la reclamación. Facilitará copia al Cliente y le permitirá formular observaciones y aportar pruebas.',
      'No se exigirá fianza previa. Una vez producido el daño, La Montada podrá solicitar al responsable un anticipo para afrontar los gastos urgentes de reparación o sustitución temporal, que deberá abonarse en un plazo de tres días hábiles, salvo acuerdo distinto, sin condicionarlo al cobro de una aseguradora. Se descontará de la liquidación definitiva y cualquier exceso se devolverá en los siete días naturales siguientes a dicha liquidación.',
      'El Cliente colaborará razonablemente aportando la información de que disponga para identificar al causante y preservar las pruebas, dentro de los límites legales, y comunicará el siniestro a su aseguradora cuando exista una póliza potencialmente aplicable. No se exige contratar un seguro adicional salvo pacto específico previo en el Anexo I. El seguro o el pago ofrecido por un tercero no libera al responsable de una deuda exigible salvo aceptación expresa de La Montada. Las cantidades efectivamente percibidas de responsables o aseguradoras se descontarán, sin doble cobro. La Montada facilitará la documentación razonablemente necesaria para tramitar el siniestro.',
      'Ante derrames, manipulación, agresiones, amenazas o cualquier riesgo objetivo para personas o material, La Montada podrá desconectar y proteger los equipos y suspender la parte afectada, avisando previamente al Cliente o su interlocutor asignado y dando oportunidad razonable de corregir la situación, salvo urgencia. Reanudará el servicio cuando sea seguro y razonablemente viable. Si el riesgo grave persiste o se repite pese al aviso, podrá dar por finalizada la prestación afectada y retirar el material, documentando la causa. La liquidación dependerá de la causa y de los servicios y perjuicios acreditados conforme a la cláusula 7, sin derecho automático al precio íntegro. Procurará continuar con los medios operativos y de sustitución razonablemente disponibles. La continuación no supone renuncia a reclamar por parte de La Montada.',
    ] },
    { titulo: '4. CONDICIONES TÉCNICAS Y NECESIDADES DEL SERVICIO', parrafos: [
      '(A) Montaje, desmontaje y otros proveedores',
      'La Montada realizará el montaje y desmontaje contratados. El Cliente coordinará con el recinto la disponibilidad de acceso, carga y descarga, estacionamiento necesario, espacio estable y seguro, horarios suficientes y autorizaciones correspondientes a la organización del evento. La Montada comunicará por escrito las necesidades específicas antes de contratar o, si dependen de una visita técnica posterior, con antelación suficiente para acordar las adaptaciones sin imponer costes no aceptados. Escaleras, distancias de acarreo, restricciones de acceso o necesidades especiales conocidas deberán reflejarse en el Anexo I. El recinto facilitará acceso para retirar los equipos al finalizar; el Cliente no podrá retenerlos como garantía de una reclamación.',
      'El Cliente comunicará con antelación cualquier intervención de otros proveedores o modificación del espacio que pueda afectar a la instalación o al servicio. Si estas circunstancias impiden un montaje correcto y seguro, La Montada comunicará las medidas necesarias para resolverlas. Cuando no sea posible solucionarlas a tiempo, podrá suspender o cancelar el servicio afectado. Las consecuencias económicas se determinarán conforme a la cláusula 7, atendiendo a la causa, los servicios realizados y los perjuicios acreditados.',
      '(B) Suministro eléctrico',
      'La Montada comunicará con antelación suficiente la potencia, las conexiones y las demás necesidades eléctricas de sus equipos. El Cliente garantizará, directamente o mediante el recinto o proveedor correspondiente, un suministro adecuado y seguro durante el montaje, las pruebas y la prestación del servicio, y asumirá los costes de disponibilidad y consumo.',
      'Los generadores o instalaciones eléctricas adicionales solo estarán incluidos cuando figuren expresamente en el presupuesto. Ante cortes de luz o deficiencias del suministro ajenos a sus equipos o actuación, La Montada colaborará dentro de sus posibilidades para intentar restablecer el servicio y podrá desconectar el material mientras no existan condiciones seguras. No responderá de las interrupciones que no le sean atribuibles.',
      '(C) Eventos al aire libre',
      'En eventos al aire libre, el Cliente deberá facilitar una ubicación o protección adecuada conforme a las necesidades comunicadas y acordadas con La Montada. Si existe previsión de lluvia, viento u otras condiciones adversas, La Montada avisará de las medidas necesarias, que podrán incluir cubrir los equipos o trasladar la instalación a un espacio protegido.',
      'La decisión del Cliente de continuar con el evento no obligará a La Montada a exponer al personal o al material a condiciones inseguras. La Montada podrá retrasar el montaje, suspender el servicio o proteger y retirar los equipos cuando resulte necesario.',
      'Si el incumplimiento de las indicaciones comunicadas al Cliente ocasiona daños, se aplicará lo previsto en la cláusula 3. Las consecuencias económicas de una suspensión o cancelación se determinarán conforme a la cláusula 7 y a la causa que la haya provocado.',
      '(D) Restricciones acústicas y de horario',
      'El Cliente deberá consultar con el recinto y comunicar a La Montada, con suficiente antelación, las restricciones de volumen y horario, la existencia de limitadores acústicos y las autorizaciones necesarias.',
      'Esta información permitirá organizar las pruebas de sonido y el uso de un medidor de decibelios cuando corresponda.',
      'La Montada respetará los límites aplicables y podrá reducir el volumen o interrumpir la actuación cuando sea necesario para cumplirlos. No responderá de las limitaciones del servicio derivadas de restricciones no comunicadas previamente que no le sean atribuibles.',
      '(E) Comida y bebida',
      'En eventos de más de cinco horas de duración, el Cliente proporcionará comida y bebida sin alcohol al equipo técnico y DJ asignado. La Montada comunicará el número de personas.',
    ] },
    { titulo: '5. FUNCIONAMIENTO E INCIDENCIAS TÉCNICAS', parrafos: [
      'La Montada realizará la instalación, el manejo y las comprobaciones de los equipos con la diligencia profesional exigible. Acudirá al recinto con antelación suficiente para efectuar el montaje y las pruebas antes del inicio del evento. Los equipos de sonido, iluminación, vídeo y pantallas son dispositivos electrónicos que, pese a su correcta instalación y mantenimiento, pueden sufrir averías o incidencias técnicas imprevisibles.',
      'Si las pruebas se superan satisfactoriamente, se entenderá que el montaje se ha realizado correctamente. Si después se produce una incidencia, antes o durante el evento, La Montada informará al Cliente e intentará restablecer el servicio con las medidas razonables a su alcance, incluida la reparación, reconfiguración o sustitución del material cuando sea posible. No se garantiza una solución inmediata ni la disponibilidad de un equipo completo de reserva en el recinto, salvo contratación expresa.',
      'En ningún caso serán imputables a La Montada las siguientes incidencias:',
      '•  Suministro eléctrico: cortes, caídas o deficiencias del suministro facilitado por el Cliente o el recinto, al que se conectará el distribuidor eléctrico de La Montada.',
      '•  Equipos inalámbricos: interferencias en micrófonos y otros equipos inalámbricos causadas por señales o dispositivos ajenos.',
      '•  Proyección y contenidos: errores de reproducción o proyección debidos a archivos con formato, resolución o calidad inadecuados, o entregados fuera del plazo previsto en la cláusula 9. La Montada solicitará los contenidos con al menos catorce días naturales de antelación e intentará adaptar los que no sean compatibles, sin garantía de resultado.',
      '•  Terceros y entorno: incidencias causadas por el recinto, otros proveedores, asistentes, condiciones meteorológicas o la manipulación no autorizada de los equipos.',
      'Las incidencias técnicas descritas en esta cláusula, atendidas por La Montada con la diligencia exigible, no constituirán incumplimiento del contrato ni darán derecho a indemnización, descuento o devolución alguna.',
    ] },
    { titulo: '6. USO DE CONTENIDO AUDIOVISUAL', parrafos: [
      'La Montada podrá realizar fotografías o vídeos de sus instalaciones y equipos para su portfolio, redes sociales y material promocional, siempre que no permitan identificar a personas ni revelen información privada o confidencial del evento.',
      'La captación y utilización promocional de imágenes o voces identificables requerirá la autorización expresa correspondiente, recogida separadamente e indicando su finalidad y canales de difusión. La autorización del Cliente no sustituirá la de los invitados, trabajadores u otros asistentes. En el caso de menores, se recabará la autorización legalmente necesaria.',
      'La autorización será opcional y su negativa no afectará a la prestación del servicio. Podrá retirarse mediante el contacto indicado en el contrato, y La Montada cesará los nuevos usos y gestionará la retirada del contenido de sus canales conforme a la normativa aplicable.',
    ] },
    { titulo: '7. HORARIOS, HORAS EXTRA, MODIFICACIONES Y CANCELACIONES', parrafos: [
      '(A) Horarios del servicio',
      'El presupuesto indicará la fecha, el lugar, los servicios incluidos y los horarios, diferenciando el montaje y desmontaje del tiempo de actuación o servicio. Dichos términos se reproducen de forma íntegra en el Anexo I, formando parte del contrato.',
      'Los retrasos atribuibles al Cliente, al recinto o a otros proveedores no ampliarán automáticamente la hora de finalización acordada. Cualquier ampliación deberá aceptarse expresamente. Los retrasos atribuibles a La Montada no se facturarán como horas extra.',
      '(B) Horas extra',
      ...(hayHoraExtra(c) ? [
        `Cada hora adicional de servicio tendrá un precio de ${euros(hora)}, IVA incluido, si se contrata antes del día del evento. Si se solicita el mismo día del evento, el precio será de ${euros(Math.max(350, hora + 100))} por hora adicional, IVA incluido. Este precio incluye el conjunto del servicio contratado: DJ, personal técnico y equipos. El pago se realizará al confirmar la ampliación, salvo acuerdo escrito distinto.`,
        'Las horas extra estarán sujetas a la disponibilidad del personal y los equipos, a las condiciones del recinto y a las restricciones de horario y ruido. Las solicitudes de asistentes no autorizados no supondrán una contratación válida.',
      ] : ['Este contrato no incluye horas adicionales de servicio. Cualquier ampliación del horario requerirá un nuevo acuerdo por escrito, con su precio.']),
      '(C) Modificaciones',
      'Los cambios de fecha, lugar, horario, equipos o servicios deberán solicitarse por escrito con al menos quince días naturales de antelación. Las solicitudes posteriores podrán valorarse, sin garantía de disponibilidad.',
      'Las modificaciones solo serán efectivas cuando ambas partes acepten por escrito las nuevas condiciones y, en su caso, el precio revisado.',
      '(D) Cancelación por el Cliente',
      'El Cliente comunicará la cancelación por escrito. La Montada podrá reclamar el valor de los servicios efectivamente realizados y los costes y perjuicios razonables, acreditados y no recuperables causados por la cancelación. Podrán comprender trabajos de preparación realmente ejecutados, compromisos no cancelables con terceros y el beneficio neto perdido por la fecha reservada cuando se acredite. La Montada procurará reducir el perjuicio y remitirá una liquidación desglosada con su soporte dentro de los quince días naturales siguientes a disponer de los datos necesarios, informando si quedan costes pendientes de cuantificar.',
      'Si la cancelación se comunica con menos de diez días naturales de antelación, la reclamación podrá alcanzar el importe total contratado únicamente cuando los servicios realizados y los perjuicios justificados alcancen dicha cantidad. Se descontarán los gastos ahorrados, las cantidades recuperadas y los ingresos de una contratación sustitutiva que reduzcan el perjuicio.',
      'La reserva es un pago a cuenta y no una penalización ni unas arras que el Cliente pierda automáticamente. Se aplicará a la liquidación justificada, cuyo importe agregado no excederá del precio total contratado. El exceso se devolverá en los catorce días naturales siguientes a la liquidación, sin perjuicio de plazos legales más breves.',
      '(E) Cancelación por La Montada y fuerza mayor',
      'Si La Montada cancela por una causa que le sea atribuible, devolverá los importes correspondientes a los servicios no prestados, sin perjuicio de los demás derechos que legalmente correspondan al Cliente. La sustitución por otro proveedor requerirá su aceptación.',
      'Ante un supuesto de fuerza mayor, la parte afectada comunicará sin demora su causa, efectos previsibles y medidas de mitigación. Las partes valorarán alternativas seguras o un aplazamiento, sujeto a disponibilidad y a aceptación escrita de fecha, servicios y eventuales diferencias de precio. Si no hay acuerdo o la alternativa ya no satisface la finalidad del evento, se liquidarán los servicios efectivamente prestados que sean legalmente exigibles y solo los gastos que legalmente procedan, devolviendo el resto sin penalización.',
      'A efectos aclaratorios, la lluvia no se considerará automáticamente fuerza mayor, ni justificará por sí sola la retención de todos los importes. Se atenderá a las circunstancias, las medidas preventivas acordadas, las alternativas disponibles y el cumplimiento de las obligaciones de cada parte.',
    ] },
    { titulo: '8. LEGISLACIÓN APLICABLE Y RESOLUCIÓN DE CONTROVERSIAS', parrafos: [
      'El contrato se regirá por la legislación española. Las partes comunicarán por escrito cualquier discrepancia e intentarán resolverla de buena fe, sin que ello limite el ejercicio de sus derechos.',
      'Las controversias se someterán a los juzgados y tribunales competentes conforme a la normativa aplicable. Cuando el Cliente tenga la condición de consumidor, se respetarán las reglas de competencia y los derechos que legalmente le correspondan.',
    ] },
    { titulo: '9. ORGANIZACIÓN TÉCNICA, CONTENIDOS Y COLABORADORES', parrafos: [
      'La Montada conserva la dirección técnica y la selección de medios y personal adecuados. Podrá recurrir a profesionales bajo su coordinación, manteniendo frente al Cliente la responsabilidad por su actuación y por el cumplimiento del contrato. La sustitución de un artista o DJ contratado nominalmente, o una alteración esencial de las prestaciones, requerirá aceptación del Cliente. Podrá sustituir equipos por otros de prestaciones equivalentes o superiores, sin incremento de precio ni reducción de las prestaciones pactadas.',
      'El Cliente remitirá con al menos siete días naturales de antelación los archivos, guiones, listas musicales y necesidades especiales que deba aportar, en formatos previamente acordados, para permitir su prueba. Las entregas tardías o cambios durante el evento se atenderán si son viables, sin garantía de reproducción de materiales no probados por causas ajenas a La Montada. No se garantiza acceso a cuentas o plataformas de terceros ni reproducción de contenidos ilícitos.',
      'Cada parte será responsable de disponer de los derechos y autorizaciones necesarios sobre los materiales que aporte y de los usos que realice. El Anexo I identificará, cuando sean necesarias, las licencias del evento o recinto y la persona responsable de gestionarlas y abonarlas, en su caso. La mera prestación técnica no incluye una cesión de derechos sobre repertorios musicales, programas, diseños o materiales preexistentes de La Montada. Cualquier producción o entrega audiovisual adicional y sus derechos de uso se pactarán separadamente por escrito.',
    ] },
    { titulo: '10. COMUNICACIONES, INCIDENCIAS Y RESPONSABILIDAD', parrafos: [
      'Las comunicaciones se dirigirán a los correos y teléfonos identificados en el contrato y el Anexo I por medios que permitan acreditar su contenido y recepción, incluido correo electrónico o mensajería. Cada parte notificará sus cambios de contacto. El interlocutor operativo designado por el Cliente podrá coordinar el evento y recibir avisos, pero solo podrá contratar extras o modificar condiciones dentro de la autorización expresa del Anexo I.',
      'El Cliente comunicará las incidencias durante el evento tan pronto como razonablemente pueda para permitir su corrección. La Montada responderá de los incumplimientos y daños que le sean atribuibles, pero no asumirá la organización general, la vigilancia del público ni las prestaciones de proveedores ajenos a su contratación. No habrá responsabilidad por el mero desagrado subjetivo del Cliente cuando La Montada haya cumplido las especificaciones y obligaciones acordadas en el Anexo I. No se excluye ni limita la responsabilidad que no pueda excluirse o limitarse legalmente.',
    ] },
    { titulo: '11. PRIVACIDAD Y CONFIDENCIALIDAD', parrafos: [
      'La Montada tratará los datos identificativos, de contacto y facturación necesarios para gestionar el contrato sobre la base de su ejecución, cumplir obligaciones legales y gestionar incidencias o defender reclamaciones sobre la base del interés legítimo cuando proceda. Los datos se conservarán durante la relación y, posteriormente, bloqueados cuando corresponda, durante los plazos legales de conservación y prescripción. Solo se comunicarán a proveedores que deban acceder para prestar el servicio, asesores, entidades financieras, aseguradoras y autoridades cuando resulte necesario y exista base legítima, con las garantías aplicables. No se utilizarán para publicidad sin una base jurídica específica.',
      'Los interesados podrán solicitar acceso, rectificación, supresión, oposición, limitación y portabilidad, cuando procedan, mediante el contacto de La Montada indicado en el encabezamiento, y reclamar ante la Agencia Española de Protección de Datos. No se facilitarán listados de invitados ni datos sensibles que no sean necesarios. Si se contratan servicios que impliquen tratar datos por cuenta del Cliente, se documentarán previamente los roles y, cuando corresponda, el acuerdo de encargo.',
      'Las partes protegerán la información privada del evento y la información técnica o comercial no pública recibida para ejecutar el contrato. Podrán compartirla, en lo necesario y bajo deber de confidencialidad, con colaboradores, asesores y aseguradoras, o para cumplir la ley o defender sus derechos. La confidencialidad no impedirá reclamar, acudir a autoridades, obtener asesoramiento ni formular opiniones legítimas sobre el servicio.',
    ] },
    { titulo: '12. DOCUMENTACIÓN Y SUBSISTENCIA DE DERECHOS', parrafos: [
      'El contrato, el Anexo I y el presupuesto adjunto delimitan el encargo. Las condiciones particulares expresamente acordadas del Anexo I prevalecerán sobre las generales en lo que válidamente las modifiquen, respetando la información precontractual vinculante y las normas imperativas. Ninguna modificación se entenderá aceptada por mero silencio. Si alguna estipulación no pudiera aplicarse, el resto subsistirá cuando legalmente sea posible, sin sustituir automáticamente una condición inválida por otra más gravosa.',
    ] },
  ];
}

/** Anexo I con los datos del evento (modelo v2). */
export function anexoContrato(c: ContratoEventos): { titulo?: string; lineas: string[] }[] {
  const hora = Number(c.horaExtra) || 0;
  const tecnicas = ([
    ['Potencia, tomas, protecciones eléctricas y responsable del suministro', c.electrico],
    ['Accesos, descarga, escaleras, distancias y espacio mínimo', c.accesos],
    ['Zona técnica y medidas de delimitación/protección del cableado', c.zonaTecnica],
    ['Protección frente a líquidos y ubicación de bebidas', c.liquidos],
    ['Instalación exterior; cubierta y ubicación alternativa segura', c.exterior === 'si' ? c.exteriorPlan : ''],
    ['Responsable y plazo de activación del plan meteorológico', c.exterior === 'si' ? c.planMeteo : ''],
    ['Límites acústicos, limitador y hora máxima autorizada', c.acustica],
    ['Coordinación con otros proveedores y efectos especiales previstos', c.proveedores],
    ['Comida y bebida: número de personas y horario', c.comida],
    ['Licencias y autorizaciones necesarias y responsable de su gestión', c.licencias],
  ] as const).filter(([, val]) => (val ?? '').trim()).map(([k, val]) => `${k}: ${val.trim()}.`);
  return [
    { lineas: [
      `Fecha del evento: ${c.fechaEvento ? fechasEvento(c) : BLANCO}. Tipo de evento y número previsto de asistentes: ${v(c.tipoYAsistentes || (c.tipoEvento === 'boda' ? 'Boda' : ''))}.`,
      `Recinto, dirección completa y espacio de instalación: ${v(c.recinto)}.`,
      `Responsable del recinto, teléfono y correo: ${v(c.responsableRecinto)}.`,
      `Acceso y montaje: ${v(c.montaje)}. Pruebas: ${v(c.pruebas)}. Inicio y fin del servicio al público: ${v(c.servicio)}. Desmontaje y retirada: ${v(c.desmontaje)}.`,
      `Duración contratada del servicio al público: ${v(c.duracion)}. Hora adicional, IVA incluido: ${hayHoraExtra(c) ? euros(hora) : 'no se contempla'}. Número de técnicos y DJs incluidos: ${v(c.tecnicosDjs)}.`,
      `${c.interlocutor.trim() ? `Interlocutor del Cliente durante el evento: ${c.interlocutor.trim()}. ` : ''}Persona autorizada para aceptar modificaciones y extras: ${c.autorizado.trim() || 'no se designa; solo el Cliente'}.`,
    ] },
    { titulo: 'SERVICIOS Y EQUIPO CONTRATADO', lineas: [
      `Presupuesto adjunto: ${v(c.presupuestoRef)}.`,
      `Descripción de los servicios y equipos, cantidades y prestaciones:\n${v(c.servicios)}`,
      `Personal incluido: ${v(c.personal)}.`,
    ] },
    ...(tecnicas.length ? [{ titulo: 'CONDICIONES TÉCNICAS Y PREVENCIÓN ACORDADAS', lineas: [tecnicas.join(' ')] }] : []),
    ...(c.particulares.trim() ? [{ titulo: 'CONDICIONES PARTICULARES', lineas: [c.particulares.trim()] }] : []),
  ];
}

export function contratoEventosPdf(c: ContratoEventos, emisor: EmisorContrato, referencia: string) {
  const k = nuevoDocContrato();
  const { text, titulo } = k;
  text('CONTRATO DE SERVICIOS AUDIOVISUALES PARA EVENTOS', { bold: true, size: 12.5, gap: 1.5 });
  text(`${c.tipoEvento === 'boda' ? 'Boda' : 'Evento'} · ${c.fechaEvento ? fechasEvento(c) : 'fecha por confirmar'}`, { size: 8.5, color: [75, 56, 54], gap: 5 });

  const cliente = `${v(c.cliente)}, con DNI/NIE/NIF ${v(c.nif)}, domicilio en ${v(c.domicilio)}, ${c.representante.trim() ? `representada por ${c.representante.trim()}` : 'actuando en nombre propio'}${[c.email, c.telefono].some((s) => s.trim()) ? ` (contacto: ${[c.email, c.telefono].filter((s) => s.trim()).join(' · ')})` : ''}`;
  text(parteMontada(emisor, c.firmante));
  text(`De otra parte, D./D.ª o entidad ${cliente}, en adelante, el “Cliente”.`);
  text('Ambas partes se reconocen capacidad suficiente para contratar.', { gap: 4 });

  for (const cl of clausulasContrato(c)) {
    titulo(cl.titulo);
    for (const p of cl.parrafos) {
      const sub = /^\([A-E]\) /.test(p);
      text(p, sub ? { bold: true, size: 9.6, gap: 1.2 } : undefined);
    }
  }

  if (k.y > k.BOTTOM - 60) k.next(); else k.y += 6;
  text(`En prueba de conformidad, ambas partes firman este contrato y su Anexo I, recibiendo un ejemplar completo en soporte duradero. Lugar: ${v(c.lugarFirma)}. Fecha de firma: ${c.fechaFirma ? fechaLarga(c.fechaFirma) : BLANCO}.`, { gap: 0 });
  k.firmas(['La Montada Sound, S.L.', v(c.firmante)], ['El Cliente', v(c.cliente)]);

  k.next();
  text('ANEXO I - DETALLES DEL EVENTO', { bold: true, size: 12, gap: 4 });
  for (const bloque of anexoContrato(c)) {
    if (bloque.titulo) titulo(bloque.titulo);
    for (const l of bloque.lineas) text(l);
  }
  k.pie();
  return k.d;
}
