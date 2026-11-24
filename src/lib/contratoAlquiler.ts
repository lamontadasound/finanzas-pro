// Contrato de alquiler de equipos audiovisuales (modelo del abogado, 2026).
// El texto legal es fijo; solo se rellenan los datos del Anexo I. Lo que se
// deja vacío sale en el PDF como una línea en blanco para completar a mano.
import { BLANCO, BROWN, v, euros, fechaLarga, nuevoDocContrato, parteMontada, type EmisorContrato } from './contratoPdfKit';
import { dias, horas, valorTermino, errorTerminos, type Termino, type Terminos } from './contratoTerminos';

export const PLANTILLA_ALQUILER = 'alquiler-2026' as const;

export interface EquipoAlquiler { equipo: string; serie: string; cantidad: number; accesorios: string; valor: number }

export const TERMINOS_ALQUILER: readonly Termino[] = [
  { key: 'fianza', label: 'Devolver la fianza en', unidad: 'días', def: 7, min: 2 },
  { key: 'defecto', label: 'El cliente avisa de un defecto en', unidad: 'horas', def: 12, min: 2 },
  { key: 'reparacion', label: 'Días de alquiler cobrables por reparación, máximo', unidad: 'días', def: 30 },
  { key: 'revision', label: 'Revisión técnica al devolver', unidad: 'días hábiles', def: 3 },
  { key: 'retraso', label: 'Retraso: veces el precio diario', unidad: 'veces', def: 2 },
  { key: 'cancelDias', label: 'Cancelación gratis con', unidad: 'días', def: 7, min: 2 },
  { key: 'cancelHoras', label: 'Cancelación: se cobra el 100 % con menos de', unidad: 'horas', def: 48, min: 2 },
  { key: 'retencion', label: 'Cancelación intermedia: se retiene', unidad: '%', def: 50, min: 0 },
];

export interface ContratoAlquiler {
  terminos?: Terminos;
  firmante: string;
  cliente: string; nif: string; domicilio: string; representante: string; email: string; telefono: string;
  presupuestoRef: string;
  modalidad: 'almacen' | 'entrega';
  entregaFecha: string; entregaHora: string; entregaLugar: string;
  devolucionFecha: string; devolucionHora: string; devolucionLugar: string;
  precioDiario: number; // IVA incluido
  precioAlquiler: number; // IVA incluido, todo el periodo
  transporte: number; // IVA incluido, solo con entrega por La Montada
  tarifaEspera: number;
  fianza: number; fianzaMedio: string; fianzaDevolucion: string;
  autorizados: string; telefonoMontada: string;
  cuentaEntidad: string; iban: string;
  equipos: EquipoAlquiler[];
  particulares: string;
  lugarFirma: string; fechaFirma: string;
}

const hoy = () => new Date().toISOString().slice(0, 10);
export const ALMACEN = 'Almacén de La Montada';
export const equipoVacio = (): EquipoAlquiler => ({ equipo: '', serie: '', cantidad: 1, accesorios: '', valor: 0 });

export const nuevoContratoAlquiler = (previo?: Partial<ContratoAlquiler>): ContratoAlquiler => ({
  firmante: previo?.firmante || 'D.ª Julia Centeno Hernández de Santamaría',
  cliente: '', nif: '', domicilio: '', representante: '', email: '', telefono: '',
  presupuestoRef: '',
  modalidad: 'almacen',
  entregaFecha: '', entregaHora: '', entregaLugar: ALMACEN,
  devolucionFecha: '', devolucionHora: '', devolucionLugar: ALMACEN,
  precioDiario: 0, precioAlquiler: 0, transporte: 0, tarifaEspera: previo?.tarifaEspera ?? 0,
  fianza: 0, fianzaMedio: 'Transferencia', fianzaDevolucion: '',
  autorizados: '', telefonoMontada: previo?.telefonoMontada ?? '',
  cuentaEntidad: previo?.cuentaEntidad ?? '', iban: previo?.iban ?? '',
  equipos: [equipoVacio()],
  particulares: '',
  lugarFirma: previo?.lugarFirma || 'Pozuelo de Alarcón (Madrid)', fechaFirma: hoy(),
});

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Jornadas de 24 h o fracción entre la entrega y la devolución (mínimo 1). */
export function jornadasAlquiler(c: Pick<ContratoAlquiler, 'entregaFecha' | 'entregaHora' | 'devolucionFecha' | 'devolucionHora'>): number {
  if (!c.entregaFecha || !c.devolucionFecha) return 0;
  const t = (f: string, h: string) => new Date(`${f}T${/^\d{1,2}:\d{2}$/.test(h) ? h.padStart(5, '0') : '10:00'}:00`).getTime();
  const horas = (t(c.devolucionFecha, c.devolucionHora) - t(c.entregaFecha, c.entregaHora)) / 3_600_000;
  if (!Number.isFinite(horas) || horas < 0) return 0;
  return Math.max(1, Math.ceil(horas / 24 - 1e-9));
}

export const importesAlquiler = (c: Pick<ContratoAlquiler, 'precioAlquiler' | 'transporte' | 'modalidad' | 'fianza'>) => {
  const alquiler = r2(Number(c.precioAlquiler) || 0);
  const transporte = c.modalidad === 'entrega' ? r2(Number(c.transporte) || 0) : 0;
  const total = r2(alquiler + transporte);
  return { alquiler, transporte, total, base: r2(total / 1.21), fianza: r2(Number(c.fianza) || 0) };
};

export const equiposConDatos = (c: Pick<ContratoAlquiler, 'equipos'>) => (c.equipos ?? []).filter((e) => e.equipo.trim());

/** Lo mínimo para que el contrato tenga sentido. Devuelve el error o null. */
export function validarContratoAlquiler(c: ContratoAlquiler): string | null {
  if (!c.cliente.trim()) return 'Falta el nombre del cliente.';
  if (!c.nif.trim()) return 'Falta el DNI/NIF del cliente.';
  if (!c.entregaFecha) return 'Falta la fecha de entrega.';
  if (!c.devolucionFecha) return 'Falta la fecha de devolución.';
  if (c.devolucionFecha < c.entregaFecha) return 'La devolución no puede ser anterior a la entrega.';
  if (!equiposConDatos(c).length) return 'Añade al menos un equipo.';
  if (!(c.precioAlquiler > 0)) return 'Indica el precio del alquiler sin IVA.';
  const et = errorTerminos(TERMINOS_ALQUILER, c.terminos);
  if (et) return et;
  if (valorTermino(TERMINOS_ALQUILER, c.terminos, 'cancelDias') * 24 <= valorTermino(TERMINOS_ALQUILER, c.terminos, 'cancelHoras')) return 'Plazos: los días de cancelación gratis tienen que ser más que las horas de cobro del 100 %.';
  return null;
}

const MODALIDAD = { almacen: 'RECOGIDA Y DEVOLUCIÓN EN ALMACÉN', entrega: 'ENTREGA Y RECOGIDA POR LA MONTADA' } as const;
const fechaHora = (f: string, h: string) => `fecha ${f ? fechaLarga(f) : BLANCO}, hora ${v(h)}`;

/** Cláusulas del contrato con los datos ya puestos. */
const vecesDiario = (n: number) => (n === 1 ? 'el precio diario' : n === 2 ? 'el doble del precio diario' : n === 3 ? 'el triple del precio diario' : `${n.toLocaleString('es-ES')} veces el precio diario`);
export function clausulasAlquiler(c: ContratoAlquiler): { titulo: string; parrafos: string[] }[] {
  const t = (k: string) => valorTermino(TERMINOS_ALQUILER, c.terminos, k);
  const { total, base } = importesAlquiler(c);
  return [
    { titulo: '1. OBJETO DEL CONTRATO', parrafos: [
      'La Montada alquila al Cliente los equipos de sonido, iluminación, vídeo y accesorios expresamente identificados en el Anexo I (los “Equipos”), durante el periodo allí indicado y a cambio del precio pactado. El presupuesto aceptado, adjunto al Anexo I, forma parte del contrato.',
      'El alquiler comprende únicamente la cesión temporal del uso de los Equipos. No incluye montaje, manejo técnico, programación, personal, suministro eléctrico ni seguro. El transporte solo estará incluido cuando se elija la modalidad de entrega y recogida por La Montada prevista en la cláusula 2.',
      'La propiedad de los Equipos corresponde en todo momento a La Montada. El Cliente no adquiere sobre ellos más derecho que el de usarlos conforme a este contrato y deberá devolverlos al finalizar el alquiler.',
    ] },
    { titulo: '2. MODALIDAD DE ENTREGA Y RECOGIDA', parrafos: [
      'La entrega y la devolución de los Equipos se realizarán en una de las dos modalidades siguientes, que se indicará en el Anexo I:',
      '(a) Recogida y devolución en almacén: el Cliente recogerá los Equipos en el almacén de La Montada y los devolverá en el mismo lugar, en las fechas y horas pactadas, por su cuenta y riesgo. El Cliente utilizará un vehículo adecuado y transportará los Equipos en sus fundas o flight cases, debidamente sujetos.',
      '(b) Entrega y recogida por La Montada: La Montada entregará los Equipos en la dirección indicada en el Anexo I y los recogerá en ella al finalizar el alquiler, por el precio de transporte allí indicado. El Cliente garantizará, tanto en la entrega como en la recogida, la presencia de una persona autorizada, el acceso del vehículo y unas condiciones razonables de carga y descarga. Si en la hora pactada no hay nadie para recibir o devolver los Equipos, o estos no están preparados para su recogida, el Cliente abonará el desplazamiento adicional y el tiempo de espera según la tarifa del Anexo I, y el periodo de alquiler seguirá corriendo hasta la recogida efectiva.',
      'Solo las personas autorizadas en el Anexo I podrán recoger, recibir y devolver los Equipos, acreditando su identidad. La Montada no entregará los Equipos a personas no autorizadas.',
    ] },
    { titulo: '3. PERIODO DE ALQUILER', parrafos: [
      'El periodo de alquiler comienza en el momento en que el Cliente o la persona autorizada recibe los Equipos y termina en el momento en que La Montada los recibe de vuelta en sus manos, en el almacén o en la recogida, según la modalidad elegida. El precio se calcula por jornadas de veinticuatro horas o fracción.',
    ] },
    { titulo: '4. PRECIO Y FORMA DE PAGO', parrafos: [
      `El precio total del alquiler es de ${euros(total)}, IVA (21%) incluido (${euros(base)} sin IVA más ${euros(r2(total - base))} de IVA), conforme al desglose del Anexo I, e incluye, en su caso, el transporte.`,
      `El Cliente abonará el 100% del precio a la firma del contrato y, en todo caso, antes de la entrega de los Equipos, mediante transferencia a la cuenta bancaria abierta a nombre de La Montada Sound, en la entidad ${v(c.cuentaEntidad)}, con número IBAN ${v(c.iban)} (la “Cuenta Bancaria”), u otro medio aceptado por La Montada. La reserva de los Equipos solo quedará confirmada una vez recibido el pago. La Montada no entregará los Equipos mientras no haya recibido el precio total y la fianza.`,
      'La Montada emitirá los justificantes y facturas correspondientes. Cuando el Cliente actúe como empresario o profesional, las cantidades vencidas devengarán el interés de demora previsto en la Ley 3/2004, de 29 de diciembre.',
    ] },
    { titulo: '5. FIANZA', parrafos: [
      `Como garantía de la devolución de los Equipos en el mismo estado en que se entregaron y del cumplimiento de sus demás obligaciones, el Cliente constituirá una fianza de ${c.fianza > 0 ? euros(c.fianza) : `${BLANCO} €`}, fijada en el Anexo I. La fianza no forma parte del precio y deberá abonarse antes de la entrega de los Equipos, mediante transferencia a la Cuenta Bancaria, retención o preautorización en tarjeta, u otro medio aceptado por escrito por La Montada. Sin fianza no se entregarán los Equipos.`,
      `Si los Equipos se devuelven completos, a tiempo y en el mismo estado en que se entregaron, La Montada devolverá la fianza íntegra, por el mismo medio empleado, en un plazo máximo de ${dias(t('fianza'), 'natural')} desde su devolución.`,
      `Si al recibir o revisar los Equipos se detectan daños, faltas, suciedad extraordinaria o retrasos, La Montada lo comunicará por escrito al Cliente dentro de ese plazo, con fotografías y el detalle de cada concepto, y descontará de la fianza el coste de reparación o reposición conforme a las cláusulas 8 y 9, los días de retraso conforme a la cláusula 12 y cualquier otra cantidad debida por el Cliente. El resto de la fianza se devolverá en el mismo plazo o, si el coste aún no puede cuantificarse, en los ${dias(t('fianza'), 'natural')} siguientes a disponer del presupuesto o la factura de reparación, que se facilitará al Cliente.`,
      'La fianza no limita la responsabilidad del Cliente. Si las cantidades debidas superan su importe, el Cliente abonará la diferencia en un plazo de diez días naturales desde que se le comunique la liquidación, junto con su soporte.',
    ] },
    { titulo: '6. ENTREGA Y ESTADO DE LOS EQUIPOS', parrafos: [
      'La Montada entregará los Equipos limpios, revisados, en perfecto estado de funcionamiento y con los accesorios, cables, fundas o flight cases indicados en el Anexo I.',
      'En la entrega, las partes firmarán el acta del Anexo II, en la que constarán los Equipos, sus números de serie y los accesorios entregados. La Montada podrá tomar fotografías y vídeos del estado y funcionamiento de los Equipos, que formarán parte del acta. El Cliente podrá comprobar los Equipos antes de recibirlos.',
      `Si el Cliente no hace constar ninguna observación en el acta, se entenderá que recibe los Equipos completos y en perfecto estado. Cualquier defecto de funcionamiento que el Cliente detecte al usarlos por primera vez deberá comunicarlo de inmediato y, como máximo, en las ${horas(t('defecto'))} siguientes a la entrega; en otro caso, se presumirá que los Equipos funcionaban correctamente.`,
    ] },
    { titulo: '7. USO Y CUSTODIA DE LOS EQUIPOS', parrafos: [
      'Desde que recibe los Equipos hasta que La Montada los recibe de vuelta, el Cliente es el único responsable de su custodia y conservación, y deberá cuidarlos con la máxima diligencia, usarlos conforme a su destino y a las instrucciones del fabricante, y guardarlos en un lugar cerrado, seco y protegido. No los dejará desatendidos en vehículos, espacios abiertos o lugares de acceso público.',
      'Sin autorización previa y escrita de La Montada, el Cliente no podrá: subarrendar, prestar o ceder los Equipos a terceros; abrirlos, repararlos, modificarlos o alterar su configuración interna, firmware o números de serie; exponerlos a lluvia, humedad, polvo, calor excesivo, líquidos o efectos especiales; conectarlos a un suministro eléctrico inadecuado o sin protecciones; ni utilizarlos con potencias o accesorios distintos de los recomendados.',
      'El Cliente es responsable del uso que haga de los Equipos y de las actividades en que los utilice, incluidos los permisos y licencias necesarios y los daños que se causen a personas o bienes durante su uso.',
    ] },
    { titulo: '8. RESPONSABILIDAD DEL CLIENTE POR DAÑOS', parrafos: [
      'El Cliente deberá devolver los Equipos en el mismo estado en que los recibió. Mientras los tenga bajo su custodia, responderá de todos los daños y desperfectos que sufran, cualquiera que sea la persona que los cause, incluidos sus trabajadores, invitados, asistentes, proveedores, el personal del lugar donde se usen o cualquier tercero, sin perjuicio de su derecho a reclamar a estos lo que haya pagado. Solo quedan excluidos los defectos internos que ya existieran en el momento de la entrega y el desgaste mínimo propio de un uso correcto.',
      `El Cliente abonará el coste íntegro de diagnóstico y reparación de los Equipos dañados, según el presupuesto o la factura del servicio técnico, que La Montada le facilitará. Si la reparación no es posible o su coste supera el valor de reposición del Equipo, el Cliente abonará el valor de reposición indicado en el Anexo I, que corresponde al precio de un equipo nuevo igual o de prestaciones equivalentes. Además, el Cliente abonará el precio del alquiler diario por cada día en que el Equipo no pueda alquilarse por estar en reparación o pendiente de reposición, con un máximo de ${dias(t('reparacion'))}, y los gastos de transporte y gestión de la reparación.`,
      'Estas cantidades se descontarán de la fianza y, si no son suficientes, el Cliente abonará la diferencia conforme a la cláusula 5. El seguro o el pago de un tercero no liberarán al Cliente mientras La Montada no haya cobrado efectivamente lo debido, y no habrá doble cobro.',
    ] },
    { titulo: '9. PÉRDIDA, ROBO Y NO DEVOLUCIÓN', parrafos: [
      'En caso de pérdida o robo de cualquiera de los Equipos o de sus accesorios mientras estén bajo la custodia del Cliente, este abonará el 100% de su valor de reposición indicado en el Anexo I, más el precio del alquiler diario hasta la fecha de pago, con el límite previsto en la cláusula 8. Esta cantidad se descontará de la fianza y el Cliente abonará la diferencia.',
      'En caso de robo, el Cliente deberá presentar denuncia ante la Policía o la Guardia Civil en un plazo máximo de veinticuatro horas desde que tenga conocimiento de él y entregar copia a La Montada. La denuncia no exime al Cliente del pago. Si los Equipos se recuperan después del pago en buen estado, La Montada devolverá el valor abonado, descontando los días de alquiler y los gastos de recuperación y reparación.',
      'Si el Cliente no devuelve los Equipos en la fecha pactada ni justifica el retraso, La Montada le requerirá por escrito su devolución inmediata. Transcurridas cuarenta y ocho horas desde el requerimiento sin que se hayan devuelto, La Montada podrá considerarlos no devueltos y exigir su valor de reposición conforme a esta cláusula, y presentar la correspondiente denuncia por apropiación indebida, sin perjuicio de las demás acciones legales que le correspondan para recuperarlos y reclamar los daños y perjuicios.',
    ] },
    { titulo: '10. AVERÍAS DURANTE EL ALQUILER', parrafos: [
      'Si durante el alquiler un Equipo deja de funcionar correctamente, el Cliente dejará de utilizarlo, lo comunicará de inmediato a La Montada por teléfono y por escrito y seguirá sus indicaciones. No podrá repararlo ni encargar su reparación a terceros.',
      'La Montada revisará el Equipo y, si la avería se debe a un defecto interno no causado por el uso, devolverá la parte proporcional del precio correspondiente a ese Equipo y al tiempo en que no se haya podido utilizar, o lo sustituirá por otro equivalente si dispone de él. Si la avería se debe a un uso inadecuado, a golpes, líquidos, al suministro eléctrico o a cualquier otra causa externa, se aplicará la cláusula 8.',
    ] },
    { titulo: '11. DEVOLUCIÓN Y REVISIÓN', parrafos: [
      'El Cliente devolverá los Equipos en la fecha, hora y lugar pactados en el Anexo I, completos, con todos sus accesorios, cables y embalajes, limpios y en el mismo estado en que los recibió.',
      `En el momento de la devolución, La Montada comprobará los Equipos y cumplimentará la parte correspondiente del acta del Anexo II. Como algunos daños solo pueden detectarse al probar los Equipos, La Montada dispondrá de un plazo de ${dias(t('revision'), 'hábil')} para completar su revisión técnica y comunicar por escrito al Cliente cualquier daño o anomalía, con fotografías o vídeos. La firma del acta de devolución no impedirá reclamar los daños detectados en esa revisión.`,
      'Si el Cliente no está presente en la revisión o no firma el acta, el estado de los Equipos se acreditará mediante las fotografías y vídeos tomados por La Montada en la entrega y en la devolución, que el Cliente acepta como medio de prueba.',
    ] },
    { titulo: '12. RETRASOS EN LA DEVOLUCIÓN', parrafos: [
      `Si el Cliente devuelve los Equipos después de la fecha y hora pactadas sin autorización escrita de La Montada, abonará por cada jornada o fracción de retraso ${vecesDiario(t('retraso'))} del alquiler indicado en el Anexo I, además de los daños y perjuicios que se acrediten, como la pérdida de otro alquiler ya comprometido. Estas cantidades podrán descontarse de la fianza.`,
      'Si el Cliente necesita ampliar el alquiler, lo solicitará antes de que termine. La ampliación solo será válida si La Montada la acepta por escrito y el Cliente abona el precio correspondiente.',
    ] },
    { titulo: '13. CANCELACIÓN Y MODIFICACIONES', parrafos: [
      'Los cambios de fechas o Equipos solo serán válidos si La Montada los acepta por escrito y están sujetos a disponibilidad.',
      `El Cliente podrá cancelar el alquiler comunicándolo por escrito. Si cancela con al menos ${dias(t('cancelDias'), 'natural')} de antelación a la entrega, La Montada le devolverá el precio abonado. Si cancela con menos de ${dias(t('cancelDias'))} y al menos ${horas(t('cancelHoras'))} de antelación, La Montada retendrá el ${t('retencion')}% del precio. Si cancela con menos de ${horas(t('cancelHoras'))}, o no recoge o no recibe los Equipos en la fecha pactada, La Montada retendrá el 100% del precio, al haber quedado los Equipos reservados y sin posibilidad de alquilarlos a otro cliente. La fianza se devolverá en todo caso en los ${dias(t('fianza'), 'natural')} siguientes.`,
      'Si La Montada no puede entregar los Equipos por una causa que le sea imputable, devolverá al Cliente la totalidad de lo abonado. Podrá ofrecer equipos de prestaciones iguales o superiores, que el Cliente podrá aceptar o no.',
    ] },
    { titulo: '14. RESOLUCIÓN POR INCUMPLIMIENTO', parrafos: [
      'Si el Cliente incumple sus obligaciones de uso y custodia, en particular si subarrienda o cede los Equipos, los manipula o los utiliza de forma que pongan en riesgo su integridad, La Montada podrá resolver el contrato y exigir la devolución inmediata de los Equipos, sin devolución del precio correspondiente al periodo restante, y sin perjuicio de reclamar los daños conforme a las cláusulas 8 y 9.',
    ] },
    { titulo: '15. RESPONSABILIDAD DE LA MONTADA', parrafos: [
      'La Montada responderá de que los Equipos se entregan en buen estado de funcionamiento. No responderá del uso que el Cliente o terceros hagan de los Equipos, de su montaje o instalación por el Cliente, ni de los daños a personas o bienes producidos durante el alquiler, salvo que se deban a un defecto de los Equipos existente en la entrega.',
      'Cuando el Cliente actúe como empresario o profesional, la responsabilidad total de La Montada derivada del contrato no excederá del precio del alquiler y no comprenderá el lucro cesante ni los daños indirectos, salvo dolo o culpa grave. No se excluye ni limita la responsabilidad que no pueda excluirse o limitarse legalmente.',
    ] },
    { titulo: '16. LEGISLACIÓN APLICABLE Y RESOLUCIÓN DE CONTROVERSIAS', parrafos: [
      'El contrato se regirá por la legislación española y, en particular, por las normas del Código Civil sobre arrendamiento de cosas. Las partes intentarán resolver de buena fe cualquier discrepancia, sin que ello limite el ejercicio de sus derechos.',
      'Las controversias se someterán a los juzgados y tribunales competentes conforme a la normativa aplicable. Cuando el Cliente tenga la condición de consumidor, se respetarán las reglas de competencia y los derechos que legalmente le correspondan.',
    ] },
    { titulo: '17. COMUNICACIONES, PRIVACIDAD Y CONFIDENCIALIDAD', parrafos: [
      'Las comunicaciones se dirigirán a los correos y teléfonos identificados en el contrato y el Anexo I por medios que permitan acreditar su contenido y recepción, incluido correo electrónico o mensajería. Cada parte notificará sus cambios de contacto.',
      'La Montada tratará los datos identificativos, de contacto y de pago del Cliente y de las personas autorizadas, así como las fotografías y vídeos de los Equipos, para gestionar el contrato, cumplir obligaciones legales y, cuando proceda, gestionar incidencias o reclamar daños sobre la base del interés legítimo. Los datos se conservarán durante los plazos legales de conservación y prescripción y solo se comunicarán a transportistas, servicios técnicos, asesores, entidades financieras, aseguradoras y autoridades cuando sea necesario. Los interesados podrán ejercer sus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad mediante el contacto de La Montada indicado en el encabezamiento, y reclamar ante la Agencia Española de Protección de Datos.',
    ] },
    { titulo: '18. DOCUMENTACIÓN Y SUBSISTENCIA DE DERECHOS', parrafos: [
      'El contrato, el Anexo I, el Anexo II y el presupuesto adjunto delimitan el alquiler. Las condiciones particulares del Anexo I prevalecerán sobre las generales en lo que las modifiquen. Ninguna modificación se entenderá aceptada por mero silencio. Si alguna estipulación no pudiera aplicarse, el resto subsistirá.',
    ] },
  ];
}

/** Anexo I con los datos del alquiler. */
export function anexoAlquiler(c: ContratoAlquiler): { titulo?: string; lineas: string[] }[] {
  const { alquiler, transporte, total } = importesAlquiler(c);
  const jornadas = jornadasAlquiler(c);
  const entrega = c.modalidad === 'entrega';
  const contacto = [c.telefono, c.email].filter((s) => s.trim()).join(' · ');
  return [
    { titulo: 'DATOS DEL ALQUILER', lineas: [
      `Presupuesto adjunto: ${v(c.presupuestoRef)}.`,
      `Modalidad: ${MODALIDAD[c.modalidad]}.`,
      `Entrega: ${fechaHora(c.entregaFecha, c.entregaHora)}, lugar ${v(c.entregaLugar)}. Devolución o recogida: ${fechaHora(c.devolucionFecha, c.devolucionHora)}, lugar ${v(c.devolucionLugar)}.`,
      `Número de jornadas: ${jornadas || BLANCO}. Precio diario del alquiler, IVA incluido: ${c.precioDiario > 0 ? euros(c.precioDiario) : `${BLANCO} €`}.`,
      `Personas autorizadas para recoger, recibir y devolver los Equipos (nombre, DNI y teléfono): ${v(c.autorizados)}.`,
      `Contacto del Cliente (teléfono y correo): ${v(contacto)}. Teléfono de La Montada: ${v(c.telefonoMontada)}.`,
    ] },
    { titulo: 'PRECIO Y FIANZA', lineas: [
      `Precio del alquiler, IVA incluido: ${euros(alquiler)}. Transporte (entrega y recogida), IVA incluido: ${entrega ? euros(transporte) : 'no aplica (recogida en almacén)'}. Total a pagar antes de la entrega (100%): ${euros(total)} IVA incluido (${euros(r2(total / 1.21))} sin IVA).`,
      `Importe de la fianza: ${c.fianza > 0 ? euros(c.fianza) : `${BLANCO} €`}. Medio: ${v(c.fianzaMedio)}. Cuenta o medio para su devolución: ${v(c.fianzaDevolucion)}.`,
      `Tarifa por desplazamiento adicional o espera, IVA incluido: ${entrega ? (c.tarifaEspera > 0 ? euros(c.tarifaEspera) : `${BLANCO} €`) : 'no aplica (recogida en almacén)'}.`,
      `Condiciones particulares: ${c.particulares.trim() || 'ninguna'}.`,
    ] },
  ];
}

export const filasEquipos = (c: Pick<ContratoAlquiler, 'equipos'>) =>
  equiposConDatos(c).map((e) => [e.equipo.trim(), e.serie.trim() || '—', String(e.cantidad || 1), e.accesorios.trim() || '—', e.valor > 0 ? euros(e.valor) : '']);

export function contratoAlquilerPdf(c: ContratoAlquiler, emisor: EmisorContrato, referencia: string) {
  const k = nuevoDocContrato();
  const { text, titulo } = k;
  const periodo = c.entregaFecha ? (c.devolucionFecha && c.devolucionFecha !== c.entregaFecha ? `del ${fechaLarga(c.entregaFecha)} al ${fechaLarga(c.devolucionFecha)}` : fechaLarga(c.entregaFecha)) : 'fechas por confirmar';
  text('CONTRATO DE ALQUILER DE EQUIPOS AUDIOVISUALES', { bold: true, size: 12.5, gap: 1.5 });
  text(`Alquiler · ${periodo}`, { size: 8.5, color: BROWN, gap: 5 });

  text(parteMontada(emisor, c.firmante));
  text(`De otra parte, D./D.ª o entidad ${v(c.cliente)}, con DNI/NIE/NIF ${v(c.nif)}, domicilio en ${v(c.domicilio)}, ${c.representante.trim() ? `representada por ${c.representante.trim()}` : 'actuando en nombre propio'}, en adelante, el “Cliente”.`);
  text('Ambas partes se reconocen capacidad suficiente para contratar.', { gap: 4 });

  for (const cl of clausulasAlquiler(c)) {
    titulo(cl.titulo);
    for (const p of cl.parrafos) text(p);
  }

  if (k.y > k.BOTTOM - 60) k.next(); else k.y += 6;
  text(`En prueba de conformidad, ambas partes firman este contrato y sus anexos, recibiendo un ejemplar completo. Lugar: ${v(c.lugarFirma)}. Fecha de firma: ${c.fechaFirma ? fechaLarga(c.fechaFirma) : BLANCO}.`, { gap: 0 });
  k.firmas(['La Montada Sound, S.L.', v(c.firmante)], ['El Cliente', v(c.cliente)]);

  // Anexo I
  k.next();
  text('ANEXO I - DETALLES DEL ALQUILER', { bold: true, size: 12, gap: 4 });
  const [datos, precio] = anexoAlquiler(c);
  titulo(datos.titulo!); datos.lineas.forEach((l) => text(l));
  titulo('EQUIPOS ALQUILADOS');
  const filas = filasEquipos(c);
  k.tabla(['Equipo y marca/modelo', 'N.º de serie', 'Cant.', 'Accesorios y embalaje', 'Valor de reposición'],
    filas.length ? filas : [['', '', '', '', '']], [34, 18, 8, 26, 16]);
  titulo(precio.titulo!); precio.lineas.forEach((l) => text(l));

  // Anexo II · acta de entrega y devolución
  k.next();
  text('ANEXO II - ACTA DE ENTREGA Y DEVOLUCIÓN', { bold: true, size: 12, gap: 4 });
  text('Las partes comprueban los Equipos, números de serie y accesorios en la entrega y en la devolución. Las fotografías y vídeos tomados por La Montada forman parte de esta acta.');
  const filasActa = (filas.length ? filas : [['', '', '', '']]).map((f) => [`${f[0]}${f[1] !== '—' && f[1] ? ` · ${f[1]}` : ''}`, f[2], '', '']);
  while (filasActa.length < 4) filasActa.push(['', '', '', '']);
  titulo('ENTREGA');
  text(`Fecha y hora: ${BLANCO}. Lugar: ${BLANCO}. Recibe (nombre y DNI): ${BLANCO}.`);
  k.tabla(['Equipo y n.º de serie', 'Cant.', 'Accesorios entregados', 'Estado / observaciones'], filasActa, [36, 8, 26, 30], { altoMin: 8 });
  k.firmas(['Entrega La Montada', ''], ['Recibe el Cliente', ''], 12);
  titulo('DEVOLUCIÓN');
  text(`Fecha y hora: ${BLANCO}. Lugar: ${BLANCO}. Devuelve (nombre y DNI): ${BLANCO}.`);
  k.tabla(['Equipo y n.º de serie', 'Cant.', 'Accesorios devueltos', 'Estado / incidencias'], filasActa, [36, 8, 26, 30], { altoMin: 8 });
  text(`La firma de la devolución no impide reclamar los daños detectados en la revisión técnica de ${dias(valorTermino(TERMINOS_ALQUILER, c.terminos, 'revision'), 'hábil')} prevista en la cláusula 11.`, { size: 8.5 });
  k.firmas(['Recibe La Montada', ''], ['Devuelve el Cliente', ''], 12);

  k.pie();
  return k.d;
}
