import { useAuthStore } from '../store/useAuthStore';
import { NO_PERMS } from '../types';
import { supabase } from './supabase';
import type {
  Evento, Ingreso, Gasto, Suplido, Factura, Equipo,
  GastoEvento, PagoEvento, Documento, Usuario, Socio, MovimientoSocio, Impuesto,
  PermisosLineas, PermisosModulos, Permisos, Cliente, ConfiguracionFiscal, PermisosFacturacion,
} from '../types';

// ── Raw DB types ──────────────────────────────────────────────────────────────

type RawEvento = {
  id: string; nombre: string; cliente: string; fecha: string; tipo: string;
  area: string; presupuesto: number; pagos_recibidos: number; estado: string;
  notas: string | null; created_at: string;
};

type RawIngreso = {
  id: string; area: string; concepto: string; cliente: string;
  empresa: boolean | null;
  tipo_evento: string; evento_id: string | null; fecha_evento: string;
  fecha_factura: string | null; fecha_cobro_prevista: string | null;
  fecha_pago: string | null;
  base_imponible: number; porcentaje_iva: number; importe_iva: number;
  total: number; metodo_pago: string; estado_pago: string;
  pagos_recibidos: number; factura_emitida: boolean;
  numero_factura: string | null; notas: string | null; created_at: string;
  reserva: number | null; sin_factura: boolean | null; linea_negocio: string | null;
  tiene_reserva: boolean | null; fecha_cobro_reserva: string | null;
  reserva_incluye_iva: boolean | null; restante_incluye_iva: boolean | null;
  metodo_pago_reserva: string | null; dj_relacionado: string | null;
};

type RawGasto = {
  id: string; area: string; fecha: string; concepto: string;
  categoria: string; tipo: string; proveedor: string | null;
  base_imponible: number; porcentaje_iva: number; importe_iva: number;
  total: number; metodo_pago: string; estado_pago: string | null;
  factura_recibida: boolean; deducible: boolean;
  evento_id: string | null; observaciones: string | null; created_at: string;
  linea_negocio: string | null;
  pagado_por: string | null; fecha_pago: string | null; numero_factura: string | null;
  es_recurrente: boolean | null; periodicidad: string | null;
  fecha_inicio_recurrencia: string | null; fecha_fin_recurrencia: string | null;
  proxima_fecha_pago: string | null; renovacion_automatica: boolean | null;
  recurrencia_id: string | null;
};

type RawSocio = {
  linea_negocio: 'montada_sound' | 'montada_installations';
  id: string; nombre: string; porcentaje: number; created_at: string;
  fecha_incorporacion: string | null; activo: boolean | null; observaciones: string | null;
};

type RawMovimientoSocio = {
  id: string; socio_id: string; fecha: string; tipo: string; cantidad: number;
  concepto: string; cuenta: string | null; documento_id: string | null;
  observaciones: string | null; created_at: string;
};

type RawImpuesto = {
  id: string; tipo: string; concepto: string; fecha: string; importe: number;
  estado: string; fecha_pago: string | null; observaciones: string | null;
  linea_negocio: string | null; created_at: string;
};

type RawSuplido = {
  id: string; area: string; fecha: string; cliente: string; concepto: string;
  importe: number; metodo_pago: string; justificante: boolean;
  evento_id: string | null; observaciones: string | null; created_at: string;
  ingreso_id: string | null; estado: string | null;
  cantidad_recuperada: number | null; fecha_cobro: string | null;
};

type RawFactura = {
  linea_negocio: string | null; emisor_id: string | null; documento_id: string | null; gasto_id: string | null;
  id: string; area: string; tipo: string; numero: string; serie: string | null;
  cliente: string; concepto: string; base_imponible: number;
  porcentaje_iva: number; importe_iva: number; total: number; fecha: string;
  fecha_vencimiento: string | null; fecha_pago: string | null;
  pagada: boolean; pagos_recibidos: number | null;
  iva_deducible: boolean; evento_id: string | null; ingreso_id: string | null;
  enviada: boolean | null; notas: string | null;
  // ── Fase H: columnas nuevas (opcionales — pendientes de migración) ──────
  retencion: number | null; estado: string | null;
  porcentaje_facturado: number | null; numero_secuencial: number | null;
  fecha_emision: string | null; emitida_por: string | null;
  anulada_por: string | null; fecha_anulacion: string | null;
  motivo_anulacion: string | null; historial: unknown | null;
  numero_proveedor: string | null; proveedor: string | null;
  posible_duplicado: boolean | null;
  drive_file_id: string | null; drive_folder_id: string | null;
  drive_link: string | null; drive_nombre_archivo: string | null;
  drive_fecha_subida: string | null; drive_subido_por: string | null;
  sync_estado: string | null; sync_ultimo_error: string | null;
  emisor_snapshot: unknown | null; cliente_snapshot: unknown | null;
  datos_cliente_borrador?: Partial<Cliente> | null;
  oculta_en?: string | null;
  fecha_evento?: string | null;
  numero_solicitado?: number | null;
  factura_rectifica_id: string | null;
};

type RawCliente = {
  id: string; nombre: string; nif_cif: string | null; direccion: string | null;
  email: string | null; telefono: string | null; es_empresa: boolean;
  observaciones: string | null; created_at: string;
};

type RawConfiguracionFiscal = {
  id: string; nombre_interno: string | null; razon_social: string | null; nombre_comercial: string | null;
  nif_cif: string | null; direccion_fiscal: string | null; email: string | null;
  telefono: string | null; iban: string | null; web?: string | null; logo_url: string | null;
  condiciones_pago: string | null; texto_legal: string | null;
  serie_formato: string | null; numero_inicial: number | null;
  numeracion_confirmada: boolean | null; activo: boolean | null;
  actualizado_por: string | null; actualizado_en: string | null;
};

type RawProyectoEmisor = {
  linea_id: string; emisor_id: string; actualizado_por: string | null; actualizado_en: string | null;
};

type RawEquipo = {
  id: string; area: string; nombre: string; categoria: string;
  base_imponible: number; porcentaje_iva: number; importe_iva: number;
  total: number; fecha_compra: string; proveedor: string | null;
  factura_recibida: boolean; forma_pago: string | null;
  financiado: boolean | null; vida_util: number | null;
  garantia: number | null; fecha_fin_garantia: string | null;
  numero_serie: string | null; observaciones: string | null; created_at: string;
  descripcion: string | null; marca: string | null; modelo: string | null;
  comprador: string | null; propietario: string | null;
  evento_relacionado_id: string | null; valor_residual: number | null;
  documento_id: string | null;
  cantidad: number | null;
};

type RawGastoEvento = {
  id: string; ingreso_id: string; area: string; fecha: string;
  concepto: string; categoria: string; importe: number;
  observaciones: string | null; created_at: string;
  base_imponible: number | null; porcentaje_iva: number | null;
  importe_iva: number | null; total_con_iva: number | null;
  factura_recibida: boolean | null; numero_factura: string | null;
  estado_pago: string | null; proveedor: string | null; tipo: string | null;
  pagado_por: string | null; metodo_pago: string | null;
};

type RawPagoEvento = {
  id: string; ingreso_id: string; area: string; fecha: string;
  importe: number; metodo_pago: string; concepto: string;
  observaciones: string | null; created_at: string;
};

type RawDocumento = {
  id: string; entity_type: string; entity_id: string; area: string;
  nombre: string; tipo: string; storage_key: string; url: string;
  fecha_subida: string; subido_por: string; subido_por_nombre: string;
  tamano: number; created_at: string;
};

// Fase G: sin `password_hash` — el frontend nunca lo selecciona (ver
// `selectCols` en `db.usuarios` más abajo) ni lo envía de vuelta.
type RawUsuario = {
  id: string; email: string; nombre: string;
  rol: string; permisos: unknown; activo: boolean; created_at: string;
};

// Forma real persistida en la columna JSONB `usuarios.permisos` — envuelve
// las claves legadas (AreaKey) junto con las nuevas `lineas`/`modulos` de
// la Fase F, sin necesitar una columna ni una migración nueva.
interface StoredPermisos extends Record<string, unknown> {
  lineas?: PermisosLineas;
  modulos?: PermisosModulos;
}

// ── Mappers DB → TS ───────────────────────────────────────────────────────────

const mapEvento  = (r: RawEvento): Evento => ({
  id: r.id, nombre: r.nombre, cliente: r.cliente, fecha: r.fecha,
  tipo: r.tipo as Evento['tipo'], area: r.area as Evento['area'],
  presupuesto: Number(r.presupuesto), pagosRecibidos: Number(r.pagos_recibidos),
  estado: r.estado as Evento['estado'], notas: r.notas ?? undefined, createdAt: r.created_at,
});

const mapIngreso = (r: RawIngreso): Ingreso => ({
  id: r.id, area: r.area as Ingreso['area'], concepto: r.concepto,
  cliente: r.cliente, empresa: r.empresa ?? false,
  tipoEvento: r.tipo_evento as Ingreso['tipoEvento'],
  eventoId: r.evento_id ?? undefined, fechaEvento: r.fecha_evento,
  fechaFactura: r.fecha_factura ?? undefined,
  fechaCobroPrevista: r.fecha_cobro_prevista ?? undefined,
  fechaPago: r.fecha_pago ?? undefined,
  baseImponible: Number(r.base_imponible), porcentajeIVA: Number(r.porcentaje_iva),
  importeIVA: Number(r.importe_iva), total: Number(r.total),
  metodoPago: r.metodo_pago as Ingreso['metodoPago'],
  estadoPago: r.estado_pago as Ingreso['estadoPago'],
  pagosRecibidos: Number(r.pagos_recibidos), facturaEmitida: r.factura_emitida,
  numeroFactura: r.numero_factura ?? undefined, notas: r.notas ?? undefined,
  createdAt: r.created_at,
  reserva: r.reserva == null ? undefined : Number(r.reserva),
  sinFactura: r.sin_factura ?? undefined,
  lineaNegocio: (r.linea_negocio ?? undefined) as Ingreso['lineaNegocio'],
  tieneReserva: r.tiene_reserva ?? undefined,
  reservaIncluyeIva: r.reserva_incluye_iva ?? undefined,
  restanteIncluyeIva: r.restante_incluye_iva ?? undefined,
  fechaCobroReserva: r.fecha_cobro_reserva ?? undefined,
  metodoPagoReserva: (r.metodo_pago_reserva ?? undefined) as Ingreso['metodoPagoReserva'],
  djRelacionado: r.dj_relacionado ?? undefined,
});

const mapGasto = (r: RawGasto): Gasto => ({
  id: r.id, area: r.area as Gasto['area'], fecha: r.fecha, concepto: r.concepto,
  categoria: r.categoria as Gasto['categoria'], tipo: r.tipo as Gasto['tipo'],
  proveedor: r.proveedor ?? undefined,
  baseImponible: Number(r.base_imponible), porcentajeIVA: Number(r.porcentaje_iva),
  importeIVA: Number(r.importe_iva), total: Number(r.total),
  metodoPago: r.metodo_pago as Gasto['metodoPago'],
  estadoPago: (r.estado_pago ?? 'pendiente') as Gasto['estadoPago'],
  facturaRecibida: r.factura_recibida, deducible: r.deducible,
  eventoId: r.evento_id ?? undefined, observaciones: r.observaciones ?? undefined,
  createdAt: r.created_at,
  lineaNegocio: (r.linea_negocio ?? undefined) as Gasto['lineaNegocio'],
  pagadoPor: (r.pagado_por ?? undefined) as Gasto['pagadoPor'],
  fechaPago: r.fecha_pago ?? undefined, numeroFactura: r.numero_factura ?? undefined,
  esRecurrente: r.es_recurrente ?? undefined,
  periodicidad: (r.periodicidad ?? undefined) as Gasto['periodicidad'],
  fechaInicioRecurrencia: r.fecha_inicio_recurrencia ?? undefined,
  fechaFinRecurrencia: r.fecha_fin_recurrencia ?? undefined,
  proximaFechaPago: r.proxima_fecha_pago ?? undefined,
  renovacionAutomatica: r.renovacion_automatica ?? undefined,
  recurrenciaId: r.recurrencia_id ?? undefined,
});

const mapSocio = (r: RawSocio): Socio => ({
  lineaNegocio: r.linea_negocio,
  id: r.id, nombre: r.nombre, porcentaje: Number(r.porcentaje), createdAt: r.created_at,
  fechaIncorporacion: r.fecha_incorporacion ?? undefined,
  activo: r.activo ?? true,
  observaciones: r.observaciones ?? undefined,
});

const mapMovimientoSocio = (r: RawMovimientoSocio): MovimientoSocio => ({
  id: r.id, socioId: r.socio_id, fecha: r.fecha, tipo: r.tipo as MovimientoSocio['tipo'],
  cantidad: Number(r.cantidad), concepto: r.concepto, cuenta: r.cuenta ?? undefined,
  documentoId: r.documento_id ?? undefined, observaciones: r.observaciones ?? undefined,
  createdAt: r.created_at,
});

const mapImpuesto = (r: RawImpuesto): Impuesto => ({
  id: r.id, tipo: r.tipo as Impuesto['tipo'], concepto: r.concepto, fecha: r.fecha,
  importe: Number(r.importe), estado: r.estado as Impuesto['estado'],
  fechaPago: r.fecha_pago ?? undefined, observaciones: r.observaciones ?? undefined,
  lineaNegocio: (r.linea_negocio ?? undefined) as Impuesto['lineaNegocio'],
  createdAt: r.created_at,
});

const mapSuplido = (r: RawSuplido): Suplido => ({
  id: r.id, area: r.area as Suplido['area'], fecha: r.fecha,
  cliente: r.cliente, concepto: r.concepto, importe: Number(r.importe),
  metodoPago: r.metodo_pago as Suplido['metodoPago'], justificante: r.justificante,
  eventoId: r.evento_id ?? undefined, observaciones: r.observaciones ?? undefined,
  createdAt: r.created_at,
  ingresoId: r.ingreso_id ?? undefined,
  estado: (r.estado ?? undefined) as Suplido['estado'],
  cantidadRecuperada: r.cantidad_recuperada == null ? undefined : Number(r.cantidad_recuperada),
  fechaCobro: r.fecha_cobro ?? undefined,
});

export const mapFactura = (r: RawFactura): Factura => ({
  lineaNegocio: (r.linea_negocio ?? undefined) as Factura["lineaNegocio"],
  emisorId: r.emisor_id ?? undefined, documentoId: r.documento_id ?? undefined, gastoId: r.gasto_id ?? undefined,
  id: r.id, area: r.area as Factura['area'], tipo: r.tipo as Factura['tipo'],
  numero: r.numero, serie: r.serie ?? undefined, cliente: r.cliente,
  concepto: r.concepto, baseImponible: Number(r.base_imponible),
  porcentajeIVA: Number(r.porcentaje_iva), importeIVA: Number(r.importe_iva),
  total: Number(r.total), fecha: r.fecha,
  fechaVencimiento: r.fecha_vencimiento ?? undefined,
  fechaPago: r.fecha_pago ?? undefined, pagada: r.pagada,
  pagosRecibidos: Number(r.pagos_recibidos ?? 0),
  ivaDeducible: r.iva_deducible, eventoId: r.evento_id ?? undefined,
  ingresoId: r.ingreso_id ?? undefined, enviada: r.enviada ?? false,
  notas: r.notas ?? undefined,
  retencion: r.retencion ?? undefined,
  estado: (r.estado ?? undefined) as Factura['estado'],
  porcentajeFacturado: r.porcentaje_facturado ?? undefined,
  numeroSecuencial: r.numero_secuencial ?? undefined,
  fechaEmision: r.fecha_emision ?? undefined,
  emitidaPor: r.emitida_por ?? undefined,
  anuladaPor: r.anulada_por ?? undefined,
  fechaAnulacion: r.fecha_anulacion ?? undefined,
  motivoAnulacion: r.motivo_anulacion ?? undefined,
  historial: (r.historial as Factura['historial']) ?? undefined,
  numeroProveedor: r.numero_proveedor ?? undefined,
  proveedor: r.proveedor ?? undefined,
  posibleDuplicado: r.posible_duplicado ?? undefined,
  driveFileId: r.drive_file_id ?? undefined,
  driveFolderId: r.drive_folder_id ?? undefined,
  driveLink: r.drive_link ?? undefined,
  driveNombreArchivo: r.drive_nombre_archivo ?? undefined,
  driveFechaSubida: r.drive_fecha_subida ?? undefined,
  driveSubidoPor: r.drive_subido_por ?? undefined,
  syncEstado: (r.sync_estado ?? undefined) as Factura['syncEstado'],
  syncUltimoError: r.sync_ultimo_error ?? undefined,
  emisorSnapshot: r.emisor_snapshot ? ('razonSocial' in (r.emisor_snapshot as object) ? r.emisor_snapshot as ConfiguracionFiscal : mapConfiguracionFiscal(r.emisor_snapshot as RawConfiguracionFiscal)) : undefined,
  clienteSnapshot: r.cliente_snapshot ? ('nifCif' in (r.cliente_snapshot as object) ? r.cliente_snapshot as Cliente : mapCliente(r.cliente_snapshot as RawCliente)) : undefined,
  clienteBorrador: r.datos_cliente_borrador ?? undefined,
  ocultaEn: r.oculta_en ?? undefined,
  fechaEvento: r.fecha_evento ?? undefined,
  numeroSolicitado: r.numero_solicitado ?? undefined,
  facturaRectificaId: r.factura_rectifica_id ?? undefined,
});

const mapCliente = (r: RawCliente): Cliente => ({
  id: r.id, nombre: r.nombre, nifCif: r.nif_cif ?? undefined,
  direccion: r.direccion ?? undefined, email: r.email ?? undefined,
  telefono: r.telefono ?? undefined, esEmpresa: r.es_empresa,
  observaciones: r.observaciones ?? undefined, createdAt: r.created_at,
});

const mapConfiguracionFiscal = (r: RawConfiguracionFiscal): ConfiguracionFiscal => ({
  id: r.id, nombreInterno: r.nombre_interno ?? undefined, activo: r.activo ?? true,
  razonSocial: r.razon_social ?? undefined,
  nombreComercial: r.nombre_comercial ?? undefined, nifCif: r.nif_cif ?? undefined,
  direccionFiscal: r.direccion_fiscal ?? undefined, email: r.email ?? undefined,
  telefono: r.telefono ?? undefined, iban: r.iban ?? undefined, web:r.web??undefined,
  logoUrl: r.logo_url ?? undefined, condicionesPago: r.condiciones_pago ?? undefined,
  textoLegal: r.texto_legal ?? undefined, serieFormato: r.serie_formato ?? undefined,
  numeroInicial: r.numero_inicial ?? undefined,
  numeracionConfirmada: r.numeracion_confirmada ?? false,
  actualizadoPor: r.actualizado_por ?? undefined, actualizadoEn: r.actualizado_en ?? undefined,
});

const mapProyectoEmisor = (r: RawProyectoEmisor): { lineaId: string; emisorId: string } => ({
  lineaId: r.linea_id, emisorId: r.emisor_id,
});

const mapEquipo = (r: RawEquipo): Equipo => ({
  id: r.id, area: r.area as Equipo['area'], nombre: r.nombre,
  categoria: r.categoria, baseImponible: Number(r.base_imponible),
  porcentajeIVA: Number(r.porcentaje_iva), importeIVA: Number(r.importe_iva),
  total: Number(r.total), fechaCompra: r.fecha_compra,
  proveedor: r.proveedor ?? undefined, facturaRecibida: r.factura_recibida,
  formaPago: (r.forma_pago ?? undefined) as Equipo['formaPago'],
  financiado: r.financiado ?? false, vidaUtil: r.vida_util ?? undefined,
  garantia: r.garantia ?? undefined, fechaFinGarantia: r.fecha_fin_garantia ?? undefined,
  numeroSerie: r.numero_serie ?? undefined,
  observaciones: r.observaciones ?? undefined, createdAt: r.created_at,
  descripcion: r.descripcion ?? undefined, marca: r.marca ?? undefined,
  modelo: r.modelo ?? undefined, comprador: r.comprador ?? undefined,
  propietario: r.propietario ?? undefined,
  eventoRelacionadoId: r.evento_relacionado_id ?? undefined,
  valorResidual: r.valor_residual ?? undefined,
  documentoId: r.documento_id ?? undefined,
  cantidad: r.cantidad ?? undefined,
});

const mapGastoEvento = (r: RawGastoEvento): GastoEvento => ({
  id: r.id, ingresoId: r.ingreso_id, area: r.area as GastoEvento['area'],
  fecha: r.fecha, concepto: r.concepto,
  categoria: r.categoria as GastoEvento['categoria'],
  importe: Number(r.importe), observaciones: r.observaciones ?? undefined,
  createdAt: r.created_at,
  baseImponible: r.base_imponible ?? undefined, porcentajeIVA: r.porcentaje_iva ?? undefined,
  importeIVA: r.importe_iva ?? undefined, totalConIva: r.total_con_iva ?? undefined,
  facturaRecibida: r.factura_recibida ?? undefined, numeroFactura: r.numero_factura ?? undefined,
  estadoPago: (r.estado_pago ?? undefined) as GastoEvento['estadoPago'],
  proveedor: r.proveedor ?? undefined, tipo: (r.tipo ?? undefined) as GastoEvento['tipo'],
  pagadoPor: (r.pagado_por ?? undefined) as GastoEvento['pagadoPor'],
  metodoPago: (r.metodo_pago ?? undefined) as GastoEvento['metodoPago'],
});

const mapPagoEvento = (r: RawPagoEvento): PagoEvento => ({
  id: r.id, ingresoId: r.ingreso_id, area: r.area as PagoEvento['area'],
  fecha: r.fecha, importe: Number(r.importe),
  metodoPago: r.metodo_pago as PagoEvento['metodoPago'],
  concepto: r.concepto, observaciones: r.observaciones ?? undefined,
  createdAt: r.created_at,
});

const mapDocumento = (r: RawDocumento): Documento => ({
  id: r.id, entityType: r.entity_type as Documento['entityType'],
  entityId: r.entity_id, area: r.area as Documento['area'],
  nombre: r.nombre, tipo: r.tipo as Documento['tipo'],
  storageKey: r.storage_key, url: r.url, fechaSubida: r.fecha_subida,
  subidoPor: r.subido_por, subidoPorNombre: r.subido_por_nombre,
  tamano: r.tamano, createdAt: r.created_at,
});

const mapUsuario = (r: RawUsuario): Usuario => {
  const stored = (r.permisos ?? {}) as StoredPermisos;
  // Las claves legadas (AreaKey) viajan sueltas en el objeto — `lineas` y
  // `modulos` son las únicas claves nuevas de la Fase F, se separan aparte.
  const { lineas, modulos, ...legacy } = stored;
  return {
    id: r.id, email: r.email, nombre: r.nombre,
    rol: r.rol as Usuario['rol'],
    permisos: legacy as Permisos,
    permisosLineas: lineas,
    permisosModulos: modulos,
    activo: r.activo, createdAt: r.created_at,
  };
};

// ── Mappers TS → DB ───────────────────────────────────────────────────────────

const toDbEvento  = (e: Evento): RawEvento => ({
  id: e.id, nombre: e.nombre, cliente: e.cliente, fecha: e.fecha,
  tipo: e.tipo, area: e.area, presupuesto: e.presupuesto,
  pagos_recibidos: e.pagosRecibidos, estado: e.estado,
  notas: e.notas ?? null, created_at: e.createdAt,
});

const toDbIngreso = (i: Ingreso): RawIngreso => ({
  id: i.id, area: i.area, concepto: i.concepto, cliente: i.cliente,
  empresa: i.empresa ?? false,
  tipo_evento: i.tipoEvento, evento_id: i.eventoId ?? null,
  fecha_evento: i.fechaEvento, fecha_factura: i.fechaFactura ?? null,
  fecha_cobro_prevista: i.fechaCobroPrevista ?? null,
  fecha_pago: i.fechaPago ?? null,
  base_imponible: i.baseImponible, porcentaje_iva: i.porcentajeIVA,
  importe_iva: i.importeIVA, total: i.total, metodo_pago: i.metodoPago,
  estado_pago: i.estadoPago, pagos_recibidos: i.pagosRecibidos,
  factura_emitida: i.facturaEmitida, numero_factura: i.numeroFactura ?? null,
  notas: i.notas ?? null, created_at: i.createdAt,
  reserva: i.reserva ?? null, sin_factura: i.sinFactura ?? null,
  linea_negocio: i.lineaNegocio ?? null,
  tiene_reserva: i.tieneReserva ?? null,
  reserva_incluye_iva: i.reservaIncluyeIva ?? null,
  restante_incluye_iva: i.restanteIncluyeIva ?? null,
  fecha_cobro_reserva: i.fechaCobroReserva ?? null,
  metodo_pago_reserva: i.metodoPagoReserva ?? null,
  dj_relacionado: i.djRelacionado ?? null,
});

const toDbGasto   = (g: Gasto): RawGasto => ({
  id: g.id, area: g.area, fecha: g.fecha, concepto: g.concepto,
  categoria: g.categoria, tipo: g.tipo, proveedor: g.proveedor ?? null,
  base_imponible: g.baseImponible, porcentaje_iva: g.porcentajeIVA,
  importe_iva: g.importeIVA, total: g.total, metodo_pago: g.metodoPago,
  estado_pago: g.estadoPago ?? null,
  factura_recibida: g.facturaRecibida, deducible: g.deducible,
  evento_id: g.eventoId ?? null, observaciones: g.observaciones ?? null,
  created_at: g.createdAt, linea_negocio: g.lineaNegocio ?? null,
  pagado_por: g.pagadoPor ?? null, fecha_pago: g.fechaPago ?? null,
  numero_factura: g.numeroFactura ?? null, es_recurrente: g.esRecurrente ?? false,
  periodicidad: g.periodicidad ?? null,
  fecha_inicio_recurrencia: g.fechaInicioRecurrencia ?? null,
  fecha_fin_recurrencia: g.fechaFinRecurrencia ?? null,
  proxima_fecha_pago: g.proximaFechaPago ?? null,
  renovacion_automatica: g.renovacionAutomatica ?? false,
  recurrencia_id: g.recurrenciaId ?? null,
});

const toDbSocio = (s: Socio): RawSocio => ({
  linea_negocio: s.lineaNegocio ?? 'montada_sound',
  id: s.id, nombre: s.nombre, porcentaje: s.porcentaje, created_at: s.createdAt,
  fecha_incorporacion: s.fechaIncorporacion ?? null,
  activo: s.activo ?? true,
  observaciones: s.observaciones ?? null,
});

const toDbMovimientoSocio = (m: MovimientoSocio): RawMovimientoSocio => ({
  id: m.id, socio_id: m.socioId, fecha: m.fecha, tipo: m.tipo, cantidad: m.cantidad,
  concepto: m.concepto, cuenta: m.cuenta ?? null, documento_id: m.documentoId ?? null,
  observaciones: m.observaciones ?? null, created_at: m.createdAt,
});

const toDbImpuesto = (i: Impuesto): RawImpuesto => ({
  id: i.id, tipo: i.tipo, concepto: i.concepto, fecha: i.fecha, importe: i.importe,
  estado: i.estado, fecha_pago: i.fechaPago ?? null, observaciones: i.observaciones ?? null,
  linea_negocio: i.lineaNegocio ?? null, created_at: i.createdAt,
});

const toDbSuplido = (s: Suplido): RawSuplido => ({
  id: s.id, area: s.area, fecha: s.fecha, cliente: s.cliente,
  concepto: s.concepto, importe: s.importe, metodo_pago: s.metodoPago,
  justificante: s.justificante, evento_id: s.eventoId ?? null,
  observaciones: s.observaciones ?? null, created_at: s.createdAt,
  ingreso_id: s.ingresoId ?? null, estado: s.estado ?? null,
  cantidad_recuperada: s.cantidadRecuperada ?? null, fecha_cobro: s.fechaCobro ?? null,
});

export const toDbFactura = (f: Factura): RawFactura => ({
  linea_negocio: f.lineaNegocio ?? null, emisor_id: f.emisorId ?? null, documento_id: f.documentoId ?? null, gasto_id: f.gastoId ?? null,
  id: f.id, area: f.area, tipo: f.tipo, numero: f.numero, serie: f.serie ?? null,
  cliente: f.cliente, concepto: f.concepto, base_imponible: f.baseImponible,
  porcentaje_iva: f.porcentajeIVA, importe_iva: f.importeIVA, total: f.total,
  fecha: f.fecha, fecha_vencimiento: f.fechaVencimiento ?? null,
  fecha_pago: f.fechaPago ?? null, pagada: f.pagada,
  pagos_recibidos: f.pagosRecibidos ?? 0,
  iva_deducible: f.ivaDeducible, evento_id: f.eventoId ?? null,
  ingreso_id: f.ingresoId ?? null, enviada: f.enviada ?? false,
  notas: f.notas ?? null,
  retencion: f.retencion ?? null, estado: f.estado ?? null,
  porcentaje_facturado: f.porcentajeFacturado ?? null,
  numero_secuencial: f.numeroSecuencial ?? null,
  fecha_emision: f.fechaEmision ?? null, emitida_por: f.emitidaPor ?? null,
  anulada_por: f.anuladaPor ?? null, fecha_anulacion: f.fechaAnulacion ?? null,
  motivo_anulacion: f.motivoAnulacion ?? null, historial: f.historial ?? null,
  numero_proveedor: f.numeroProveedor ?? null, proveedor: f.proveedor ?? null,
  posible_duplicado: f.posibleDuplicado ?? null,
  drive_file_id: f.driveFileId ?? null, drive_folder_id: f.driveFolderId ?? null,
  drive_link: f.driveLink ?? null, drive_nombre_archivo: f.driveNombreArchivo ?? null,
  drive_fecha_subida: f.driveFechaSubida ?? null, drive_subido_por: f.driveSubidoPor ?? null,
  sync_estado: f.syncEstado ?? null, sync_ultimo_error: f.syncUltimoError ?? null,
  emisor_snapshot: f.emisorSnapshot ?? null, cliente_snapshot: f.clienteSnapshot ?? null,
  datos_cliente_borrador: f.clienteBorrador ?? null,
  fecha_evento: f.fechaEvento || null, numero_solicitado: f.numeroSolicitado ?? null,
  factura_rectifica_id: f.facturaRectificaId ?? null,
});

const toDbCliente = (c: Cliente): RawCliente => ({
  id: c.id, nombre: c.nombre, nif_cif: c.nifCif ?? null,
  direccion: c.direccion ?? null, email: c.email ?? null,
  telefono: c.telefono ?? null, es_empresa: c.esEmpresa,
  observaciones: c.observaciones ?? null, created_at: c.createdAt,
});

const toDbConfiguracionFiscal = (c: ConfiguracionFiscal): RawConfiguracionFiscal => ({
  id: c.id, nombre_interno: c.nombreInterno ?? null, activo: c.activo ?? true,
  razon_social: c.razonSocial ?? null,
  nombre_comercial: c.nombreComercial ?? null, nif_cif: c.nifCif ?? null,
  direccion_fiscal: c.direccionFiscal ?? null, email: c.email ?? null,
  telefono: c.telefono ?? null, iban: c.iban ?? null, web:c.web??null,
  logo_url: c.logoUrl ?? null, condiciones_pago: c.condicionesPago ?? null,
  texto_legal: c.textoLegal ?? null, serie_formato: c.serieFormato ?? null,
  numero_inicial: c.numeroInicial ?? null,
  numeracion_confirmada: c.numeracionConfirmada ?? false,
  actualizado_por: c.actualizadoPor ?? null, actualizado_en: c.actualizadoEn ?? null,
});

const toDbProyectoEmisor = (p: { lineaId: string; emisorId: string }): RawProyectoEmisor => ({
  linea_id: p.lineaId, emisor_id: p.emisorId, actualizado_por: null, actualizado_en: null,
});

const toDbEquipo  = (e: Equipo): RawEquipo => ({
  id: e.id, area: e.area, nombre: e.nombre, categoria: e.categoria,
  base_imponible: e.baseImponible, porcentaje_iva: e.porcentajeIVA,
  importe_iva: e.importeIVA, total: e.total, fecha_compra: e.fechaCompra,
  proveedor: e.proveedor ?? null, factura_recibida: e.facturaRecibida,
  forma_pago: e.formaPago ?? null, financiado: e.financiado ?? false,
  vida_util: e.vidaUtil ?? null, garantia: e.garantia ?? null,
  fecha_fin_garantia: e.fechaFinGarantia ?? null,
  numero_serie: e.numeroSerie ?? null,
  observaciones: e.observaciones ?? null, created_at: e.createdAt,
  descripcion: e.descripcion ?? null, marca: e.marca ?? null, modelo: e.modelo ?? null,
  comprador: e.comprador ?? null, propietario: e.propietario ?? null,
  evento_relacionado_id: e.eventoRelacionadoId ?? null,
  valor_residual: e.valorResidual ?? null, documento_id: e.documentoId ?? null,
  cantidad: e.cantidad ?? 1,
});

const toDbGastoEvento = (g: GastoEvento): RawGastoEvento => ({
  id: g.id, ingreso_id: g.ingresoId, area: g.area, fecha: g.fecha,
  concepto: g.concepto, categoria: g.categoria, importe: g.importe,
  observaciones: g.observaciones ?? null, created_at: g.createdAt,
  base_imponible: g.baseImponible ?? null, porcentaje_iva: g.porcentajeIVA ?? null,
  importe_iva: g.importeIVA ?? null, total_con_iva: g.totalConIva ?? null,
  factura_recibida: g.facturaRecibida ?? false, numero_factura: g.numeroFactura ?? null,
  estado_pago: g.estadoPago ?? null, proveedor: g.proveedor ?? null,
  tipo: g.tipo ?? null, pagado_por: g.pagadoPor ?? null, metodo_pago: g.metodoPago ?? null,
});

const toDbPagoEvento  = (p: PagoEvento): RawPagoEvento => ({
  id: p.id, ingreso_id: p.ingresoId, area: p.area, fecha: p.fecha,
  importe: p.importe, metodo_pago: p.metodoPago, concepto: p.concepto,
  observaciones: p.observaciones ?? null, created_at: p.createdAt,
});

export const toDbDocumento   = (d: Documento): RawDocumento => ({
  id: d.id, entity_type: d.entityType, entity_id: d.entityId, area: d.area,
  nombre: d.nombre, tipo: d.tipo, storage_key: d.storageKey, url: d.url,
  fecha_subida: d.fechaSubida, subido_por: d.subidoPor,
  subido_por_nombre: d.subidoPorNombre, tamano: d.tamano, created_at: d.createdAt,
});

const toDbUsuario     = (u: Usuario): RawUsuario => ({
  id: u.id, email: u.email, nombre: u.nombre,
  rol: u.rol,
  // `lineas`/`modulos` (Fase F) viajan dentro del mismo JSONB — aditivo,
  // sin migración de esquema.
  permisos: { ...u.permisos, lineas: u.permisosLineas, modulos: u.permisosModulos } satisfies StoredPermisos,
  activo: u.activo, created_at: u.createdAt,
});

// ── Helper ─────────────────────────────────────────────────────────────────────

function check(error: { message: string } | null, ctx: string) {
  if (error) throw new Error(`[db.${ctx}] ${error.message}`);
}

// ── CRUD genérico ─────────────────────────────────────────────────────────────

function makeCrud<T, R>(
  table: string,
  mapFrom: (r: R) => T,
  mapTo: (t: T) => R,
  orderCol: string,
  /** Columnas explícitas para `select()` — por defecto `'*'`. Se usa para
   *  `usuarios`, donde el frontend NUNCA debe descargar `password_hash`
   *  (Fase G: ni conocerlo ni compararlo — Supabase Auth es la única fuente
   *  de verificación de credenciales). */
  selectCols: string = '*',
) {
  return {
    async getById(id: string): Promise<T> {
      const { data, error } = await supabase.from(table).select(selectCols).eq('id', id).single();
      check(error, `${table}.getById`);
      return mapFrom(data as R);
    },
    async getAll(): Promise<T[]> {
      const auth=useAuthStore.getState();
      if (!auth.profile?.activo) return [];
      const lineTables=['ingresos','gastos','facturas','equipo','impuestos','documentos','gastos_evento','pagos_evento','suplidos'];
      const rows: T[]=[];
      for(let offset=0;;offset+=500) {
        let query=supabase.from(table).select(selectCols).order(orderCol,{ascending:false}).order('id').range(offset,offset+499);
        if (!auth.isAdmin() && lineTables.includes(table)) {
          const lines=auth.lineasVisibles(); if(!lines.length) return [];
          query=query.in('linea_negocio',lines);
        }
        if(!auth.isAdmin() && ['eventos','socios','movimientos_socios'].includes(table) && !auth.canViewLinea('montada_sound')) return [];
        const {data,error}=await query;
        check(error,`${table}.getAll`);
        rows.push(...((data??[]) as R[]).map(mapFrom));
        if(!data || data.length<500) break;
      }
      return rows;
    },
    async insert(item: T): Promise<void> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from(table).insert(mapTo(item) as any);
      check(error, `${table}.insert`);
    },
    async upsert(item: T): Promise<void> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from(table).upsert(mapTo(item) as any, { onConflict: 'id' });
      check(error, `${table}.upsert`);
    },
    // ── Insertar SOLO si no existe — nunca sobrescribe una fila existente ──
    // Distinto de `upsert`: `upsert` SIEMPRE pisa la fila con los campos que
    // le pases, aunque el servidor ya tenga datos más recientes/reales (el
    // caso exacto que rompía la emisión de facturas en un reintento: el
    // borrador local, sin número, pisaba una factura YA emitida). Con
    // `ignoreDuplicates: true`, si la fila ya existe, Postgres simplemente
    // no hace nada — cero riesgo de borrar `numero_secuencial`, `estado` o
    // los snapshots fiscales de una factura que el servidor ya emitió.
    async insertIfMissing(item: T): Promise<void> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from(table).upsert(mapTo(item) as any, { onConflict: 'id', ignoreDuplicates: true });
      check(error, `${table}.insertIfMissing`);
    },
    async delete(id: string): Promise<void> {
      const { error } = await supabase.from(table).delete().eq('id', id).select('id').single();
      check(error, `${table}.delete`);
    },
  };
}

// ── API pública ───────────────────────────────────────────────────────────────

export const db = {
  profiles: {
    async getAll(): Promise<Usuario[]> {
      const results=await Promise.all([
        supabase.from('profiles').select('id,email,nombre,rol,activo,created_at'),
        supabase.from('user_line_permissions').select('*'),
        supabase.from('user_module_permissions').select('*'),
      ]);
      for(const result of results) check(result.error,'profiles.getAll');
      const [profiles,lines,modules]=results.map(x=>x.data??[]);
      const perm=(r: Record<string,unknown>)=>({ver:!!r.can_view,crear:!!r.can_create,editar:!!r.can_edit,eliminar:!!r.can_delete});
      return profiles.map(p=>({id:p.id,email:p.email,nombre:p.nombre,rol:p.rol,activo:p.activo,createdAt:p.created_at,permisos:NO_PERMS,
        permisosLineas:Object.fromEntries(lines.filter(x=>x.user_id===p.id).map(x=>[x.linea_negocio,perm(x)])),
        permisosModulos:Object.fromEntries(modules.filter(x=>x.user_id===p.id).map(x=>[x.modulo,perm(x)])),
      } as Usuario));
    },
  },
  eventos:      makeCrud<Evento,      RawEvento>      ('eventos',      mapEvento,      toDbEvento,      'fecha'),
  ingresos:     makeCrud<Ingreso,     RawIngreso>     ('ingresos',     mapIngreso,     toDbIngreso,     'fecha_evento'),
  gastos:       makeCrud<Gasto,       RawGasto>       ('gastos',       mapGasto,       toDbGasto,       'fecha'),
  suplidos:     makeCrud<Suplido,     RawSuplido>     ('suplidos',     mapSuplido,     toDbSuplido,     'fecha'),
  facturas: {
    ...makeCrud<Factura, RawFactura>('facturas', mapFactura, toDbFactura, 'fecha'),
    async updatePayment(id: string, patch: Partial<Factura>) {
      const update: Record<string, unknown> = {};
      for (const [client, column] of Object.entries({ pagada: 'pagada', pagosRecibidos: 'pagos_recibidos', fechaPago: 'fecha_pago', enviada: 'enviada' })) {
        if (client in patch) update[column] = patch[client as keyof Factura];
      }
      const { data, error } = await supabase.from('facturas').update(update).eq('id', id).select().single();
      if (error) throw error;
      return mapFactura(data as RawFactura);
    },
  },
  equipo:       makeCrud<Equipo,      RawEquipo>      ('equipo',       mapEquipo,      toDbEquipo,      'fecha_compra'),
  gastosEvento: makeCrud<GastoEvento, RawGastoEvento> ('gastos_evento', mapGastoEvento, toDbGastoEvento, 'fecha'),
  pagosEvento:  makeCrud<PagoEvento,  RawPagoEvento>  ('pagos_evento',  mapPagoEvento,  toDbPagoEvento,  'fecha'),
  documentos:   makeCrud<Documento,   RawDocumento>   ('documentos',   mapDocumento,   toDbDocumento,   'fecha_subida'),
  // Fase G: `password_hash` explícitamente excluido del select — el
  // frontend no debe descargarlo bajo ningún concepto.
  usuarios:     makeCrud<Usuario,     RawUsuario>     ('usuarios',     mapUsuario,     toDbUsuario,     'created_at', 'id, email, nombre, rol, activo, permisos, created_at'),
  socios:            makeCrud<Socio,            RawSocio>            ('socios',             mapSocio,            toDbSocio,            'created_at'),
  movimientosSocios: makeCrud<MovimientoSocio,  RawMovimientoSocio>  ('movimientos_socios', mapMovimientoSocio,  toDbMovimientoSocio, 'fecha'),
  impuestos:         makeCrud<Impuesto,         RawImpuesto>         ('impuestos',          mapImpuesto,         toDbImpuesto,        'fecha'),
  clientes:          makeCrud<Cliente,          RawCliente>          ('clientes',           mapCliente,          toDbCliente,         'created_at'),

  // ── Emisores fiscales (Fase H) — lista, ya no una fila única ────────────
  // Sustituye por completo el antiguo `configuracionFiscal.get/upsert` de
  // fila fija — ver `AppState.emisores`/`proyectoEmisorMap`.
  emisores: makeCrud<ConfiguracionFiscal, RawConfiguracionFiscal>('configuracion_fiscal', mapConfiguracionFiscal, toDbConfiguracionFiscal, 'id'),

  // `proyecto_emisor` — clave primaria `linea_id`, no encaja en el CRUD
  // genérico por id-uuid; se expone como getAll/set dedicados.
  proyectoEmisor: {
    async getAll(): Promise<{ lineaId: string; emisorId: string }[]> {
      const { data, error } = await supabase.from('proyecto_emisor').select('*');
      check(error, 'proyectoEmisor.getAll');
      return ((data ?? []) as RawProyectoEmisor[]).map(mapProyectoEmisor);
    },
    async set(lineaId: string, emisorId: string): Promise<void> {
      const { error } = await supabase.from('proyecto_emisor')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .upsert(toDbProyectoEmisor({ lineaId, emisorId }) as any, { onConflict: 'linea_id' });
      check(error, 'proyectoEmisor.set');
    },
  },

  // ── Permisos finos de facturación (Fase H) — gestionados desde Usuarios ──
  permisosFacturacion: {
    async getAll(): Promise<Record<string, PermisosFacturacion>> {
      const { data, error } = await supabase.from('user_facturacion_permissions').select('user_id, puede_emitir, puede_rectificar, puede_gestionar_numeracion');
      check(error, 'permisosFacturacion.getAll');
      const out: Record<string, PermisosFacturacion> = {};
      for (const r of (data ?? []) as { user_id: string; puede_emitir: boolean; puede_rectificar: boolean; puede_gestionar_numeracion: boolean }[]) {
        out[r.user_id] = { emitir: r.puede_emitir, rectificar: r.puede_rectificar, gestionarNumeracion: r.puede_gestionar_numeracion };
      }
      return out;
    },
    async set(userId: string, p: PermisosFacturacion): Promise<void> {
      const { error } = await supabase.from('user_facturacion_permissions').upsert(
        { user_id: userId, puede_emitir: p.emitir, puede_rectificar: p.rectificar, puede_gestionar_numeracion: p.gestionarNumeracion },
        { onConflict: 'user_id' },
      );
      check(error, 'permisosFacturacion.set');
    },
  },
};
