// Contrato de instalación de equipos audiovisuales (modelo del abogado, 2026).
// El texto legal es fijo; solo se rellenan los datos del Anexo I. Lo que se
// deja vacío sale en el PDF como una línea en blanco para completar a mano.
// El Anexo II (acta de recepción) sí va dentro: la cláusula 9 obliga a firmarla.
import { BLANCO, BROWN, v, euros, fechaLarga, nuevoDocContrato, parteMontada, type EmisorContrato } from './contratoPdfKit';
import { dias, horas, numeroEnLetra, valorTermino, errorTerminos, type Termino, type Terminos } from './contratoTerminos';

export const PLANTILLA_INSTALACION = 'instalacion-2026' as const;

export const TERMINOS_INSTALACION: readonly Termino[] = [
  { key: 'matMin', label: 'El material llega en, mínimo', unidad: 'días', def: 3 },
  { key: 'matMax', label: 'El material llega en, máximo', unidad: 'días', def: 14, min: 2 },
  { key: 'suministro', label: 'Se puede resolver si el suministro se retrasa más de', unidad: 'días', def: 60, min: 2 },
  { key: 'acta', label: 'Plazo para indicar defectos si no firma el acta', unidad: 'horas', def: 48, min: 2 },
  { key: 'respuesta', label: 'Garantía: respuesta en', unidad: 'horas hábiles', def: 72 },
  { key: 'visita', label: 'Garantía: visita en', unidad: 'días hábiles', def: 5, min: 2 },
];

export interface MaterialInstalacion { equipo: string; cantidad: number; ubicacion: string; garantia: string }

export const TRABAJOS = ['Montaje y anclaje', 'Tendido de cableado', 'Conexión a tomas existentes', 'Configuración', 'Formación básica', 'Retirada de embalajes'] as const;

export interface ContratoInstalacion {
  firmante: string;
  cliente: string; nif: string; domicilio: string; representante: string; email: string; telefono: string;
  cuentaEntidad: string; iban: string;
  presupuestoRef: string; lugar: string; tipoEstablecimiento: string; descripcion: string;
  fechaVisita: string; tecnico: string; interlocutor: string; autorizado: string;
  material: MaterialInstalacion[];
  trabajos: string[]; trabajosOtros: string;
  excluidos: string; recorridos: string; esteticos: string;
  electricos: 'no' | 'si'; electricosDetalle: string;
  duracion: string; horario: string; terminos?: Terminos;
  precioBase: number; primerPago: number; // primerPago con IVA; 0 = 50%
  garantiaMeses: number;
  tarifaDesplazamientoBase: number; horaTecnicoBase: number; // sin IVA
  oposicionImagenes: 'si' | 'no';
  seguro: string;
  particulares: string;
  lugarFirma: string; fechaFirma: string;
}

const hoy = () => new Date().toISOString().slice(0, 10);
const r2 = (n: number) => Math.round(n * 100) / 100;
const conIva = (n: number) => `${euros(n)} IVA incluido (${euros(r2(n / 1.21))} sin IVA)`;
const tarifa = (base: number) => (base > 0 ? `${euros(r2(base * 1.21))} (${euros(r2(base))} sin IVA)` : `${BLANCO} €`);

export const materialVacio = (): MaterialInstalacion => ({ equipo: '', cantidad: 1, ubicacion: '', garantia: '' });

export const nuevoContratoInstalacion = (previo?: Partial<ContratoInstalacion>): ContratoInstalacion => ({
  firmante: previo?.firmante || 'D.ª Julia Centeno Hernández de Santamaría',
  cliente: '', nif: '', domicilio: '', representante: '', email: '', telefono: '',
  cuentaEntidad: previo?.cuentaEntidad ?? '', iban: previo?.iban ?? '',
  presupuestoRef: '', lugar: '', tipoEstablecimiento: '', descripcion: '',
  fechaVisita: '', tecnico: '', interlocutor: '', autorizado: '',
  material: [materialVacio()],
  trabajos: ['Montaje y anclaje', 'Tendido de cableado', 'Conexión a tomas existentes', 'Configuración', 'Formación básica', 'Retirada de embalajes'], trabajosOtros: '',
  excluidos: '', recorridos: '', esteticos: '',
  electricos: 'no', electricosDetalle: '',
  duracion: 'Una a dos jornadas de trabajo', horario: '', terminos: {},
  precioBase: 0, primerPago: 0,
  garantiaMeses: previo?.garantiaMeses || 12,
  tarifaDesplazamientoBase: previo?.tarifaDesplazamientoBase ?? 0, horaTecnicoBase: previo?.horaTecnicoBase ?? 0,
  oposicionImagenes: 'no',
  seguro: previo?.seguro ?? '',
  particulares: '',
  lugarFirma: previo?.lugarFirma || 'Pozuelo de Alarcón (Madrid)', fechaFirma: hoy(),
});

export const materialConDatos = (c: Pick<ContratoInstalacion, 'material'>) => (c.material ?? []).filter((m) => m.equipo.trim());

export const importesInstalacion = (c: Pick<ContratoInstalacion, 'precioBase' | 'primerPago'>) => {
  const base = r2(Number(c.precioBase) || 0);
  const total = r2(base * 1.21);
  const mitad = r2(total / 2);
  const elegido = r2(Number(c.primerPago) || 0);
  const reserva = elegido > 0 && elegido <= total ? elegido : mitad;
  return { base, iva: r2(total - base), total, reserva, resto: r2(total - reserva), es50: reserva === mitad };
};

export function validarContratoInstalacion(c: ContratoInstalacion): string | null {
  if (!c.cliente.trim()) return 'Falta el nombre del cliente.';
  if (!c.nif.trim()) return 'Falta el DNI/NIF del cliente.';
  if (!c.lugar.trim()) return 'Falta el lugar de instalación.';
  if (!materialConDatos(c).length) return 'Añade al menos un equipo a instalar.';
  if (!(importesInstalacion(c).total > 0)) return 'Pon el precio total sin IVA.';
  if (Number(c.primerPago) > importesInstalacion(c).total) return 'El primer pago no puede ser mayor que el total con IVA.';
  const et = errorTerminos(TERMINOS_INSTALACION, c.terminos);
  if (et) return et;
  if (valorTermino(TERMINOS_INSTALACION, c.terminos, 'matMin') > valorTermino(TERMINOS_INSTALACION, c.terminos, 'matMax')) return 'Plazos: el mínimo de llegada del material no puede ser mayor que el máximo.';
  return null;
}

const meses = (n: number) => (n === 1 ? 'un mes' : `${n || 12} meses`);

const plazoMaterial = (c: Pick<ContratoInstalacion, 'terminos'>) => {
  const a = valorTermino(TERMINOS_INSTALACION, c.terminos, 'matMin'), b = valorTermino(TERMINOS_INSTALACION, c.terminos, 'matMax');
  return a === b ? dias(a) : `entre ${numeroEnLetra(a)} y ${dias(b)}`;
};

/** Cláusulas del contrato con los datos ya puestos. */
export function clausulasInstalacion(c: ContratoInstalacion): { titulo: string; parrafos: string[] }[] {
  const t = (k: string) => valorTermino(TERMINOS_INSTALACION, c.terminos, k);
  const dur = c.duracion.trim().replace(/\.+$/, '');
  const duracion = dur ? dur.charAt(0).toLowerCase() + dur.slice(1) : 'una a dos jornadas de trabajo';
  const { total, base, iva, reserva, resto, es50 } = importesInstalacion(c);
  return [
    { titulo: '1. OBJETO DEL CONTRATO', parrafos: [
      'La Montada suministrará e instalará de forma fija los equipos de sonido, iluminación, vídeo o proyección expresamente descritos en el Anexo I (el “Material”), en el inmueble y espacio allí identificados (el “Lugar de Instalación”), y realizará los trabajos de montaje, cableado, conexión, configuración y puesta en marcha que el Anexo I detalle (la “Instalación”). El presupuesto aceptado, adjunto al Anexo I, forma parte del contrato.',
      'Solo se incluyen los trabajos y materiales expresamente descritos en el Anexo I. Salvo inclusión expresa, quedan excluidos: obra civil, albañilería, rozas, falsos techos, carpintería, pintura y remates decorativos; nuevas líneas, circuitos o cuadros eléctricos; red de datos e Internet; licencias de software o contenidos; mantenimiento periódico; y la retirada de equipos o instalaciones preexistentes. Cualquier trabajo adicional requerirá aceptación previa y escrita de su alcance y precio conforme a la cláusula 13.',
    ] },
    { titulo: '2. VISITA TÉCNICA PREVIA Y ALCANCE DE LOS TRABAJOS', parrafos: [
      'Antes de la Instalación, el personal técnico de La Montada realizará una visita al Lugar de Instalación para comprobar los recorridos de cableado, los puntos de anclaje, el suministro eléctrico disponible, los accesos y las demás condiciones necesarias. Si la visita ya se realizó antes de la firma, el presupuesto se basará en lo observado en ella.',
      'El presupuesto y el Anexo I se elaboran con la información facilitada por el Cliente y la observable en la visita técnica sin realizar catas ni desmontajes. La Montada no responderá de las circunstancias ocultas o no comunicadas que se descubran durante la Instalación, como estructuras o paramentos no aptos para anclajes, conducciones, tuberías o cableado empotrados, falsos techos sin registro, materiales con amianto o elementos protegidos. Si se descubren, La Montada informará al Cliente y propondrá por escrito las soluciones técnicas posibles y, en su caso, su coste y plazo adicionales, conforme a la cláusula 13.',
    ] },
    { titulo: '3. PRECIO Y FORMA DE PAGO', parrafos: [
      `El precio total de la Instalación es de ${euros(total)}, IVA (21%) incluido, que corresponde a ${euros(base)} sin IVA más ${euros(iva)} de IVA, conforme al desglose del Anexo I.`,
      `A la firma se abonará ${es50 ? 'el 50% del precio total, esto es, ' : 'como primer pago '}${conIva(reserva)}, a la cuenta bancaria abierta a nombre de La Montada Sound, en la entidad ${v(c.cuentaEntidad)}, con número IBAN ${v(c.iban)} (la “Cuenta Bancaria”). Este importe se destina a realizar el pedido del Material a los proveedores y a la preparación de los trabajos. La Montada no realizará el pedido hasta haberlo recibido y confirmará por escrito su recepción.`,
      `${es50 ? 'El 50% restante' : 'El resto del precio'}, esto es, ${conIva(resto)}, se abonará al finalizar la Instalación, el mismo día de su conclusión y una vez realizadas las pruebas de funcionamiento previstas en la cláusula 9, mediante transferencia a la Cuenta Bancaria u otro medio aceptado por La Montada. Las observaciones menores o los ajustes pendientes que no impidan el uso normal de la Instalación no suspenderán ni aplazarán este pago, sin perjuicio de que La Montada los atienda conforme a la cláusula 9. La Montada emitirá los justificantes y facturas correspondientes.`,
      'Ante un impago vencido, La Montada requerirá por escrito su subsanación, concediendo al menos tres días naturales y advirtiendo de sus consecuencias. Si persiste el impago, podrá suspender los trabajos pendientes, incluidas la configuración definitiva, la formación y la atención en garantía, o resolver el contrato mediante comunicación expresa, con liquidación conforme a la cláusula 13. Cuando el Cliente actúe como empresario o profesional, las cantidades vencidas devengarán el interés de demora previsto en la Ley 3/2004, de 29 de diciembre, y la compensación por costes de cobro que esta establece.',
    ] },
    { titulo: '4. PEDIDO, PLAZOS DE SUMINISTRO Y EJECUCIÓN', parrafos: [
      `Una vez recibido el pago a cuenta, La Montada realizará el pedido del Material. El plazo estimado de recepción del Material es de ${plazoMaterial(c)} desde la realización del pedido. Este plazo es orientativo, depende de los fabricantes, distribuidores y transportistas, y puede variar por falta de existencias o retrasos ajenos a La Montada, que informará al Cliente de cualquier variación relevante en cuanto la conozca. Los retrasos en el suministro no imputables a La Montada no constituirán incumplimiento ni darán derecho a indemnización, descuento o resolución, salvo que superen los ${dias(t('suministro'), 'natural')}, en cuyo caso cualquiera de las partes podrá resolver el contrato con liquidación conforme a la cláusula 13.`,
      'Recibido el Material, La Montada avisará al Cliente y ambas partes concretarán por escrito la fecha de la Instalación, según la disponibilidad de los equipos técnicos de La Montada y del Lugar de Instalación.',
      `La duración estimada de la Instalación es de ${duracion}, conforme al Anexo I. Esta duración es orientativa y podrá ampliarse según la complejidad de los trabajos, las condiciones del Lugar de Instalación, las circunstancias ocultas descubiertas, la coordinación con otros gremios o los cambios solicitados por el Cliente, sin que ello constituya incumplimiento. La Montada informará al Cliente de la previsión de ampliación y procurará reducir las molestias.`,
      'Si la Instalación no puede iniciarse o continuar en la fecha acordada por causas imputables al Cliente o al Lugar de Instalación, como falta de acceso, de permisos, de suministro eléctrico o de las condiciones comprometidas, La Montada podrá facturar los desplazamientos y las horas de técnico perdidos según la tarifa del Anexo I, y la nueva fecha se fijará según su disponibilidad.',
    ] },
    { titulo: '5. MATERIAL Y RESERVA DE DOMINIO', parrafos: [
      'El Material será nuevo, salvo indicación expresa en el Anexo I, y corresponderá a las marcas, modelos y cantidades allí descritos. Si alguno no estuviera disponible o hubiera sido descatalogado, La Montada podrá sustituirlo por otro de prestaciones equivalentes o superiores, sin incremento de precio, informando previamente al Cliente. Cualquier sustitución que reduzca las prestaciones o modifique el precio requerirá su aceptación.',
      'El Material seguirá siendo propiedad de La Montada hasta el pago íntegro del precio. Mientras tanto, el Cliente no podrá venderlo, gravarlo ni retirarlo del Lugar de Instalación, y, en caso de impago, La Montada podrá reclamar su restitución, sin perjuicio de su derecho a exigir el precio pendiente.',
      'El riesgo de pérdida o daño del Material corresponde a La Montada hasta su entrega en el Lugar de Instalación. Desde ese momento, el Cliente responderá de la custodia del Material depositado en sus instalaciones y de los daños causados por terceros ajenos a La Montada, y el riesgo se transmitirá íntegramente al Cliente con la finalización de la Instalación.',
    ] },
    { titulo: '6. OBLIGACIONES DEL CLIENTE Y CONDICIONES DEL LUGAR', parrafos: [
      '(A) Acceso, horarios y coordinación',
      'El Cliente facilitará a La Montada el acceso al Lugar de Instalación en las fechas y horarios acordados, con zona de carga y descarga, espacio para el Material y las herramientas, y un lugar cerrado para guardarlos cuando la Instalación dure más de una jornada. Designará un interlocutor con capacidad para tomar decisiones durante los trabajos.',
      'El Cliente coordinará la presencia de otros gremios o proveedores en el Lugar de Instalación y comunicará con antelación cualquier actividad que pueda afectar a los trabajos. La Montada no responderá de los retrasos ni de los daños en su trabajo causados por terceros ajenos a ella.',
      '(B) Permisos y autorizaciones',
      'El Cliente garantiza que dispone, o que obtendrá antes de la Instalación, de las autorizaciones necesarias del propietario del inmueble, de la comunidad o del arrendador, así como de las licencias administrativas que requieran los trabajos. Las consecuencias de su falta serán de su exclusiva responsabilidad.',
      '(C) Soportes, estructuras e instalaciones ocultas',
      'El Cliente informará a La Montada, antes de la Instalación, de la ubicación de las conducciones, tuberías, cableado y demás instalaciones ocultas que conozca, así como de las limitaciones de los paramentos y techos. La Montada utilizará fijaciones adecuadas a los soportes observables y a las recomendaciones del fabricante, pero no responderá de los daños en instalaciones ocultas no señaladas ni de la falta de resistencia de soportes cuyas características no pudieran conocerse razonablemente.',
      '(D) Suministro eléctrico y red',
      'El Cliente garantizará en el Lugar de Instalación un suministro eléctrico adecuado y seguro, con la potencia, tomas y protecciones comunicadas por La Montada, así como la conexión de red o Internet cuando la Instalación la requiera. Su adecuación y mantenimiento, y los costes de disponibilidad y consumo, corresponden al Cliente.',
    ] },
    { titulo: '7. INSTALACIÓN ELÉCTRICA Y NORMATIVA TÉCNICA', parrafos: [
      'La Instalación se ejecutará conforme a la normativa técnica aplicable y, en lo que afecte a instalaciones de baja tensión, al Reglamento Electrotécnico para Baja Tensión aprobado por el Real Decreto 842/2002, de 2 de agosto. Salvo inclusión expresa en el Anexo I, La Montada se limitará a conectar el Material a las tomas y puntos de suministro existentes.',
      'Cuando sea necesario ejecutar nuevas líneas, circuitos, cuadros o protecciones, o modificar la instalación eléctrica existente, estos trabajos serán realizados por una empresa instaladora habilitada, que podrá ser La Montada si dispone de dicha habilitación o un profesional habilitado subcontratado por ella o designado por el Cliente, y que emitirá, cuando proceda, el certificado de instalación correspondiente. Su coste se presupuestará por separado, salvo que figure en el Anexo I.',
      'La Montada no responderá de los defectos de la instalación eléctrica existente ni de los realizados por profesionales designados por el Cliente, y podrá negarse a conectar el Material cuando la instalación existente no ofrezca condiciones de seguridad suficientes, informando de ello al Cliente.',
    ] },
    { titulo: '8. CABLEADO, ACABADOS Y RESULTADO ESTÉTICO', parrafos: [
      'La Montada procurará en todo momento que la Instalación quede ordenada y con el menor impacto visual posible, ocultando el cableado cuando el Lugar de Instalación lo permita mediante falsos techos registrables, canalizaciones existentes, mobiliario u otros recursos disponibles, y empleando para ello al personal que considere adecuado.',
      'No obstante, el Cliente reconoce y acepta que el resultado estético depende de la estructura, los materiales, los accesos y las instalaciones existentes del Lugar de Instalación, de las restricciones del propietario o del recinto, de las circunstancias ocultas y de las propias decisiones del Cliente. Por ello, puede resultar técnicamente necesario o recomendable que queden a la vista tramos de cable, canaletas, tubos, regletas, cajas de registro, soportes o fijaciones, o que se realicen remates o pasos de cable visibles. La Montada informará al Cliente de estas soluciones cuando sea razonablemente posible antes de ejecutarlas.',
      'Siempre que la Instalación funcione correctamente y se haya ejecutado con la diligencia profesional exigible, estas soluciones no constituirán defecto ni incumplimiento, ni darán derecho a reducción del precio, retención del pago, indemnización o repetición de los trabajos. Solo serán vinculantes los requisitos estéticos que consten expresamente en el Anexo I; las imágenes, simulaciones o referencias compartidas durante la contratación tienen carácter orientativo.',
      'Las fijaciones, perforaciones y pasos de cable necesarios forman parte de la Instalación. La Montada realizará una limpieza básica de la zona de trabajo, pero no están incluidos los trabajos de albañilería, yeso, pintura o decoración para tapar o rematar perforaciones, rozas o marcas, ni la reposición de acabados al retirar equipos anteriores, salvo inclusión expresa en el Anexo I. Si el Cliente desea un mayor grado de ocultación del cableado que requiera obra o trabajos adicionales, se presupuestará por separado conforme a la cláusula 13.',
    ] },
    { titulo: '9. PRUEBAS, PUESTA EN MARCHA Y RECEPCIÓN', parrafos: [
      'Finalizados los trabajos, La Montada realizará en presencia del Cliente o su interlocutor las pruebas de funcionamiento del Material y su configuración básica, y le explicará su uso ordinario. A continuación, las partes firmarán el acta de recepción del Anexo II, en la que el Cliente podrá hacer constar, de forma concreta, las observaciones que estime oportunas.',
      'Si las pruebas se superan satisfactoriamente, se entenderá que la Instalación se ha realizado correctamente y queda recibida. Las observaciones que no impidan el uso normal de la Instalación no impedirán la recepción ni el pago final, y La Montada las atenderá en un plazo razonable si son fundadas.',
      `Si el Cliente o su interlocutor no asisten a las pruebas, se niegan a firmar el acta sin indicar por escrito defectos concretos en las ${horas(t('acta'))} siguientes, o comienzan a utilizar la Instalación, esta se entenderá recibida en la fecha de su finalización. La recepción no excluye la garantía de la cláusula 10 ni los derechos que legalmente correspondan al Cliente por defectos ocultos.`,
      'La Montada entregará al Cliente la documentación técnica básica, las instrucciones de uso del fabricante disponibles y, en su caso, las claves de acceso a la configuración. Las modificaciones de configuración que realice el Cliente o terceros tras la recepción serán de su exclusiva responsabilidad.',
    ] },
    { titulo: '10. GARANTÍA', parrafos: [
      '(A) Garantía de la Instalación',
      `La Montada garantiza los trabajos de instalación, montaje, cableado y configuración que haya ejecutado durante un plazo de ${meses(c.garantiaMeses)} desde la recepción. Durante ese plazo, corregirá sin coste los defectos debidos a su ejecución, incluidos el desplazamiento y la mano de obra necesarios.`,
      '(B) Garantía del Material',
      'El Material está cubierto por la garantía de su fabricante en los términos y plazos de este, y, cuando el Cliente tenga la condición de consumidor, por la garantía legal de conformidad aplicable. La Montada gestionará ante el fabricante o distribuidor las reclamaciones de garantía del Material que haya suministrado. Los plazos de reparación o sustitución del Material en garantía dependen del fabricante; La Montada informará al Cliente y, si dispone de ello, podrá ofrecer un equipo provisional, sin obligación de hacerlo.',
      '(C) Exclusiones',
      'La garantía no cubre: el desgaste normal y los consumibles, como lámparas, filtros, pilas o baterías, ni las horas de uso de lámparas o fuentes de luz; los daños por golpes, caídas, líquidos, humedad, polvo, calor excesivo, sobretensiones, rayos o fallos del suministro eléctrico; el uso contrario a las instrucciones o la falta del mantenimiento recomendado; la manipulación, traslado, reparación o reconfiguración por el Cliente o por terceros; los defectos de la instalación eléctrica, la red o los equipos ajenos al Material; las actualizaciones, licencias o fallos de software y servicios de terceros; los actos vandálicos, sustracciones o causas de fuerza mayor; ni las soluciones de cableado y acabado previstas en la cláusula 8. La manipulación de la Instalación por terceros no autorizados por La Montada extinguirá la garantía de la Instalación sobre los elementos afectados.',
      '(D) Procedimiento',
      `El Cliente comunicará por escrito la incidencia, describiendo el problema y aportando fotografías o vídeos si es posible. La Montada responderá en un plazo de ${horas(t('respuesta'), true)} y, si es necesario, acordará una visita técnica dentro de los ${dias(t('visita'), 'hábil')} siguientes, según su disponibilidad. Si se comprueba que la incidencia no está cubierta por la garantía, el Cliente abonará el desplazamiento, el diagnóstico y, en su caso, la reparación, según las tarifas del Anexo I, que se le informarán antes de reparar.`,
    ] },
    { titulo: '11. MANTENIMIENTO Y ASISTENCIA POSTERIOR', parrafos: [
      'Salvo inclusión expresa en el Anexo I, el precio no incluye mantenimiento periódico, actualizaciones ni asistencia fuera de garantía. La Montada podrá ofrecer al Cliente un servicio de mantenimiento o asistencia técnica, que se documentará por separado. Las asistencias fuera de garantía se facturarán según las tarifas vigentes, informadas previamente al Cliente.',
    ] },
    { titulo: '12. RESPONSABILIDAD Y SEGUROS', parrafos: [
      `La Montada ejecutará la Instalación con la diligencia profesional exigible y responderá de los daños que cause en el Lugar de Instalación por su actuación negligente, con las salvedades previstas en este contrato. La Montada declara disponer de un seguro de responsabilidad civil${c.seguro.trim() ? ` (${c.seguro.trim()})` : ` (aseguradora y póliza: ${BLANCO})`}.`,
      'La Montada no responderá de: los daños derivados de circunstancias ocultas o no comunicadas conforme a la cláusula 6; las interrupciones de la actividad del Cliente durante los trabajos previstos; los defectos de soportes, instalaciones o equipos preexistentes; ni las consecuencias del uso de la Instalación contrario a las instrucciones.',
      'Cuando el Cliente actúe como empresario o profesional, la responsabilidad total de La Montada derivada del contrato no excederá del precio total de la Instalación, y no comprenderá el lucro cesante, la pérdida de negocio ni los daños indirectos, salvo dolo o culpa grave. No se excluye ni limita la responsabilidad que no pueda excluirse o limitarse legalmente.',
    ] },
    { titulo: '13. MODIFICACIONES, TRABAJOS ADICIONALES Y CANCELACIÓN', parrafos: [
      '(A) Modificaciones y trabajos adicionales',
      'Los cambios en el Material, la ubicación, los recorridos de cableado o el alcance de la Instalación, así como los trabajos adicionales necesarios por circunstancias ocultas o no comunicadas, solo serán efectivos cuando ambas partes acepten por escrito, incluido por correo electrónico o mensajería, su alcance, precio y efecto en el plazo. Las instrucciones verbales del Cliente o su interlocutor durante los trabajos que impliquen un coste adicional se confirmarán por escrito antes de ejecutarlas, salvo urgencia.',
      '(B) Cancelación por el Cliente',
      'El Cliente comunicará la cancelación por escrito. Si la comunica antes de que La Montada haya realizado el pedido del Material, se le devolverá el pago a cuenta en los catorce días naturales siguientes, descontando los gastos acreditados de la visita técnica y la preparación, si los hubiera.',
      'Una vez realizado el pedido, el Cliente abonará el coste del Material pedido que no pueda cancelarse o devolverse al proveedor, o, si puede devolverse, los gastos de devolución y reposición aplicados por este, así como los trabajos ya realizados y los costes acreditados no recuperables. Si el Material no puede devolverse, una vez abonado se pondrá a disposición del Cliente. El pago a cuenta se aplicará a esta liquidación y el exceso, si lo hubiera, se devolverá en los catorce días naturales siguientes. Si la cancelación se produce una vez iniciada la Instalación, se liquidarán además los trabajos ejecutados y el beneficio neto perdido que se acredite.',
      '(C) Cancelación por La Montada y fuerza mayor',
      'Si La Montada no puede ejecutar la Instalación por una causa que le sea atribuible, devolverá las cantidades abonadas por los trabajos no realizados y el Material no entregado, sin perjuicio de los demás derechos que legalmente correspondan al Cliente.',
      'Ante un supuesto de fuerza mayor, la parte afectada lo comunicará sin demora y las partes acordarán una nueva fecha. Si ello no es posible, se liquidarán el Material suministrado y los trabajos realizados, devolviendo el resto.',
    ] },
    { titulo: '14. USO DE IMÁGENES Y REFERENCIAS', parrafos: [
      'La Montada podrá realizar fotografías o vídeos de la Instalación terminada y mencionar al Cliente como referencia en su portfolio, redes sociales y material promocional, salvo que el Cliente se oponga por escrito en el Anexo I o en cualquier momento posterior. No se captarán imágenes que permitan identificar a personas ni que revelen información confidencial del Cliente sin su autorización expresa.',
    ] },
    { titulo: '15. LEGISLACIÓN APLICABLE Y RESOLUCIÓN DE CONTROVERSIAS', parrafos: [
      'El contrato se regirá por la legislación española. Las partes comunicarán por escrito cualquier discrepancia e intentarán resolverla de buena fe, sin que ello limite el ejercicio de sus derechos.',
      'Las controversias se someterán a los juzgados y tribunales competentes conforme a la normativa aplicable. Cuando el Cliente tenga la condición de consumidor, se respetarán las reglas de competencia y los derechos que legalmente le correspondan.',
    ] },
    { titulo: '16. COMUNICACIONES', parrafos: [
      'Las comunicaciones se dirigirán a los correos y teléfonos identificados en el contrato y el Anexo I por medios que permitan acreditar su contenido y recepción, incluido correo electrónico o mensajería. Cada parte notificará sus cambios de contacto. El interlocutor designado por el Cliente podrá coordinar los trabajos, recibir avisos y firmar el acta de recepción, pero solo podrá aceptar trabajos adicionales o modificar condiciones dentro de la autorización expresa del Anexo I.',
    ] },
    { titulo: '17. PRIVACIDAD Y CONFIDENCIALIDAD', parrafos: [
      'La Montada tratará los datos identificativos, de contacto y facturación necesarios para gestionar el contrato sobre la base de su ejecución, cumplir obligaciones legales y gestionar incidencias o defender reclamaciones sobre la base del interés legítimo cuando proceda. Los datos se conservarán durante la relación y, posteriormente, bloqueados cuando corresponda, durante los plazos legales de conservación y prescripción. Solo se comunicarán a proveedores, fabricantes y subcontratistas que deban acceder para prestar el servicio o gestionar la garantía, asesores, entidades financieras, aseguradoras y autoridades cuando resulte necesario y exista base legítima. No se utilizarán para publicidad sin una base jurídica específica.',
      'Los interesados podrán solicitar acceso, rectificación, supresión, oposición, limitación y portabilidad, cuando procedan, mediante el contacto de La Montada indicado en el encabezamiento, y reclamar ante la Agencia Española de Protección de Datos.',
      'Las partes protegerán la información técnica o comercial no pública recibida para ejecutar el contrato, incluidas las claves de acceso a los equipos y redes del Cliente. Podrán compartirla, en lo necesario y bajo deber de confidencialidad, con colaboradores, fabricantes, asesores y aseguradoras, o para cumplir la ley o defender sus derechos.',
    ] },
    { titulo: '18. DOCUMENTACIÓN Y SUBSISTENCIA DE DERECHOS', parrafos: [
      'El contrato, el Anexo I, el Anexo II y el presupuesto adjunto delimitan el encargo. Las condiciones particulares expresamente acordadas en el Anexo I prevalecerán sobre las generales en lo que válidamente las modifiquen, respetando la información precontractual vinculante y las normas imperativas. Ninguna modificación se entenderá aceptada por mero silencio, salvo lo previsto para la recepción en la cláusula 9. Si alguna estipulación no pudiera aplicarse, el resto subsistirá cuando legalmente sea posible.',
    ] },
  ];
}

export function anexoInstalacion(c: ContratoInstalacion) {
  const { total, reserva, resto, es50 } = importesInstalacion(c);
  const trabajos = [...(c.trabajos ?? []), ...(c.trabajosOtros.trim() ? [c.trabajosOtros.trim()] : [])];
  return {
    datos: [
      `Presupuesto adjunto: ${v(c.presupuestoRef)}.`,
      `Lugar de Instalación (dirección completa y espacio concreto): ${v(c.lugar)}. Tipo de establecimiento: ${v(c.tipoEstablecimiento)}.`,
      `Descripción general de la Instalación: ${v(c.descripcion)}.`,
      `Fecha de la visita técnica: ${c.fechaVisita ? fechaLarga(c.fechaVisita) : BLANCO}. Técnico responsable: ${v(c.tecnico)}.`,
      `Interlocutor del Cliente (nombre, teléfono y correo): ${v(c.interlocutor)}. Persona autorizada para aceptar trabajos adicionales: ${c.autorizado.trim() || 'no se designa; solo el Cliente'}.`,
    ],
    trabajos: [
      `Trabajos incluidos: ${trabajos.length ? trabajos.join(' / ').toLowerCase().replace(/^./, (x) => x.toUpperCase()) : BLANCO}.`,
      `Trabajos excluidos además de los de la cláusula 1: ${c.excluidos.trim() || 'ninguno'}.`,
      `Recorridos de cableado previstos y tramos que quedarán vistos o con canaleta: ${v(c.recorridos)}. Requisitos estéticos vinculantes, si los hay: ${c.esteticos.trim() || 'ninguno'}.`,
      `Trabajos eléctricos por empresa instaladora habilitada: ${c.electricos === 'si' ? `SÍ, ${v(c.electricosDetalle)}` : 'NO'}.`,
    ],
    plazos: [
      `Plazo estimado de recepción del Material desde el pedido: ${plazoMaterial(c)}. Duración estimada de la Instalación: ${v(c.duracion)}. Horario de trabajo permitido en el Lugar de Instalación: ${v(c.horario)}.`,
      `Precio total, IVA incluido: ${euros(total)} (${euros(r2(total / 1.21))} sin IVA). Pago a cuenta a la firma${es50 ? ' (50%)' : ''}: ${euros(reserva)}. Pago final al concluir la Instalación${es50 ? ' (50%)' : ''}: ${euros(resto)}.`,
      `Garantía de la Instalación: ${meses(c.garantiaMeses)} desde la recepción. Tarifa de desplazamiento y diagnóstico fuera de garantía, IVA incluido: ${tarifa(c.tarifaDesplazamientoBase)}. Hora de técnico adicional, IVA incluido: ${tarifa(c.horaTecnicoBase)}.`,
      `Oposición del Cliente al uso de imágenes de la Instalación como referencia: ${c.oposicionImagenes === 'si' ? 'SÍ' : 'NO'}.`,
      ...(c.particulares.trim() ? [`Condiciones particulares: ${c.particulares.trim()}.`] : []),
    ],
  };
}

export const filasMaterial = (c: Pick<ContratoInstalacion, 'material'>) =>
  materialConDatos(c).map((m) => [m.equipo.trim(), String(m.cantidad || 1), m.ubicacion.trim() || '—', m.garantia.trim() || '—']);

export function contratoInstalacionPdf(c: ContratoInstalacion, emisor: EmisorContrato) {
  const k = nuevoDocContrato();
  const { text, titulo } = k;
  text('CONTRATO DE INSTALACIÓN DE EQUIPOS AUDIOVISUALES', { bold: true, size: 12.5, gap: 1.5 });
  text(`Instalación · ${c.lugar.trim() || 'lugar por confirmar'}`, { size: 8.5, color: BROWN, gap: 5 });
  text(parteMontada(emisor, c.firmante));
  text(`De otra parte, D./D.ª o entidad ${v(c.cliente)}, con DNI/NIE/NIF ${v(c.nif)}, domicilio en ${v(c.domicilio)}, ${c.representante.trim() ? `representada por ${c.representante.trim()}` : 'actuando en nombre propio'}${[c.email, c.telefono].some((s) => s.trim()) ? ` (contacto: ${[c.email, c.telefono].filter((s) => s.trim()).join(' · ')})` : ''}, en adelante, el “Cliente”.`);
  text('Ambas partes se reconocen capacidad suficiente para contratar.', { gap: 4 });

  for (const cl of clausulasInstalacion(c)) {
    titulo(cl.titulo);
    for (const p of cl.parrafos) text(p, /^\([A-E]\) /.test(p) ? { bold: true, size: 9.6, gap: 1.2 } : undefined);
  }

  if (k.y > k.BOTTOM - 60) k.next(); else k.y += 6;
  text(`En prueba de conformidad, ambas partes firman este contrato y sus anexos, recibiendo un ejemplar completo en soporte duradero. Lugar: ${v(c.lugarFirma)}. Fecha de firma: ${c.fechaFirma ? fechaLarga(c.fechaFirma) : BLANCO}.`, { gap: 0 });
  k.firmas(['La Montada Sound, S.L.', v(c.firmante)], ['El Cliente', v(c.cliente)], 24);

  k.next();
  text('ANEXO I - DESCRIPCIÓN DE LA INSTALACIÓN', { bold: true, size: 12, gap: 4 });
  const a = anexoInstalacion(c);
  titulo('DATOS DE LA INSTALACIÓN'); a.datos.forEach((l) => text(l));
  titulo('MATERIAL SUMINISTRADO');
  const filas = filasMaterial(c);
  k.tabla(['Equipo y marca/modelo', 'Cantidad', 'Ubicación', 'Garantía del fabricante'], filas.length ? filas : [['', '', '', '']], [42, 10, 28, 20]);
  titulo('TRABAJOS INCLUIDOS Y EXCLUIDOS'); a.trabajos.forEach((l) => text(l));
  titulo('PLAZOS, PRECIO Y GARANTÍA'); a.plazos.forEach((l) => text(l));

  k.next();
  text('ANEXO II - ACTA DE RECEPCIÓN DE LA INSTALACIÓN', { bold: true, size: 12, gap: 4 });
  [
    `Lugar de Instalación: ${v(c.lugar)}. Fecha de inicio de los trabajos: ${BLANCO}. Fecha de finalización: ${BLANCO}.`,
    `Material instalado conforme al Anexo I: CONFORME / DIFERENCIAS Y NÚMEROS DE SERIE: ${BLANCO}.`,
    `Pruebas de funcionamiento realizadas: ${BLANCO}. Resultado: CORRECTO / OBSERVACIONES: ${BLANCO}.`,
    `Soluciones de cableado o acabado visibles adoptadas conforme a la cláusula 8: ${BLANCO}.`,
    `Explicación de uso realizada a: ${BLANCO}. Documentación y claves entregadas: ${BLANCO}.`,
    `Observaciones del Cliente (defectos concretos, si los hay): ${BLANCO}. Ajustes pendientes y plazo previsto: ${BLANCO}.`,
    `Pago final recibido: SÍ / NO, importe ${BLANCO} €, medio ${BLANCO}.`,
  ].forEach((l) => text(l, { gap: 4 }));
  k.firmas(['Firma de La Montada', ''], ['Firma del Cliente o interlocutor', ''], 20);
  text('Con la firma de esta acta, el Cliente declara recibida la Instalación con las observaciones indicadas, y comienza el plazo de garantía de la cláusula 10. La firma no supone renuncia a los derechos que legalmente correspondan al Cliente por defectos ocultos.', { size: 8.6 });
  k.pie();
  return k.d;
}
