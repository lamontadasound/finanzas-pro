import { supabase } from './supabase';
import type {
  Evento, Ingreso, Gasto, Suplido, Factura, Equipo,
  GastoEvento, PagoEvento, Documento, Usuario, Socio, MovimientoSocio, Impuesto,
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
  id: string; area: string; tipo: string; numero: string; serie: string | null;
  cliente: string; concepto: string; base_imponible: number;
  porcentaje_iva: number; importe_iva: number; total: number; fecha: string;
  fecha_vencimiento: string | null; fecha_pago: string | null;
  pagada: boolean; pagos_recibidos: number | null;
  iva_deducible: boolean; evento_id: string | null; ingreso_id: string | null;
  enviada: boolean | null; notas: string | null;
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
  pagado_por: string | null;
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

type RawUsuario = {
  id: string; email: string; nombre: string; password_hash: string;
  rol: string; permisos: unknown; activo: boolean; created_at: string;
};

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

const mapFactura = (r: RawFactura): Factura => ({
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

const mapUsuario = (r: RawUsuario): Usuario => ({
  id: r.id, email: r.email, nombre: r.nombre, passwordHash: r.password_hash,
  rol: r.rol as Usuario['rol'],
  permisos: r.permisos as Usuario['permisos'],
  activo: r.activo, createdAt: r.created_at,
});

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
  fecha_cobro_reserva: i.fechaCobroReserva ?? null,
  metodo_pago_reserva: i.metodoPagoReserva ?? null,
  dj_relacionado: i.djRelacionado ?? null,
});

const toDbGasto   = (g: Gasto): RawGasto => ({
  id: g.id, area: g.area, fecha: g.fecha, concepto: g.concepto,
  categoria: g.categoria, tipo: g.tipo, proveedor: g.proveedor ?? null,
  base_imponible: g.baseImponible, porcentaje_iva: g.porcentajeIVA,
  importe_iva: g.importeIVA, total: g.total, metodo_pago: g.metodoPago,
  estado_pago: g.estadoPago ?? 'pendiente',
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

const toDbFactura = (f: Factura): RawFactura => ({
  id: f.id, area: f.area, tipo: f.tipo, numero: f.numero, serie: f.serie ?? null,
  cliente: f.cliente, concepto: f.concepto, base_imponible: f.baseImponible,
  porcentaje_iva: f.porcentajeIVA, importe_iva: f.importeIVA, total: f.total,
  fecha: f.fecha, fecha_vencimiento: f.fechaVencimiento ?? null,
  fecha_pago: f.fechaPago ?? null, pagada: f.pagada,
  pagos_recibidos: f.pagosRecibidos ?? 0,
  iva_deducible: f.ivaDeducible, evento_id: f.eventoId ?? null,
  ingreso_id: f.ingresoId ?? null, enviada: f.enviada ?? false,
  notas: f.notas ?? null,
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
  estado_pago: g.estadoPago ?? 'pendiente', proveedor: g.proveedor ?? null,
  tipo: g.tipo ?? null, pagado_por: g.pagadoPor ?? null,
});

const toDbPagoEvento  = (p: PagoEvento): RawPagoEvento => ({
  id: p.id, ingreso_id: p.ingresoId, area: p.area, fecha: p.fecha,
  importe: p.importe, metodo_pago: p.metodoPago, concepto: p.concepto,
  observaciones: p.observaciones ?? null, created_at: p.createdAt,
});

const toDbDocumento   = (d: Documento): RawDocumento => ({
  id: d.id, entity_type: d.entityType, entity_id: d.entityId, area: d.area,
  nombre: d.nombre, tipo: d.tipo, storage_key: d.storageKey, url: d.url,
  fecha_subida: d.fechaSubida, subido_por: d.subidoPor,
  subido_por_nombre: d.subidoPorNombre, tamano: d.tamano, created_at: d.createdAt,
});

const toDbUsuario     = (u: Usuario): RawUsuario => ({
  id: u.id, email: u.email, nombre: u.nombre, password_hash: u.passwordHash,
  rol: u.rol, permisos: u.permisos, activo: u.activo, created_at: u.createdAt,
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
) {
  return {
    async getAll(): Promise<T[]> {
      const { data, error } = await supabase.from(table).select('*').order(orderCol, { ascending: false });
      check(error, `${table}.getAll`);
      return ((data ?? []) as R[]).map(mapFrom);
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
    async delete(id: string): Promise<void> {
      const { error } = await supabase.from(table).delete().eq('id', id);
      check(error, `${table}.delete`);
    },
  };
}

// ── API pública ───────────────────────────────────────────────────────────────

export const db = {
  eventos:      makeCrud<Evento,      RawEvento>      ('eventos',      mapEvento,      toDbEvento,      'fecha'),
  ingresos:     makeCrud<Ingreso,     RawIngreso>     ('ingresos',     mapIngreso,     toDbIngreso,     'fecha_evento'),
  gastos:       makeCrud<Gasto,       RawGasto>       ('gastos',       mapGasto,       toDbGasto,       'fecha'),
  suplidos:     makeCrud<Suplido,     RawSuplido>     ('suplidos',     mapSuplido,     toDbSuplido,     'fecha'),
  facturas:     makeCrud<Factura,     RawFactura>     ('facturas',     mapFactura,     toDbFactura,     'fecha'),
  equipo:       makeCrud<Equipo,      RawEquipo>      ('equipo',       mapEquipo,      toDbEquipo,      'fecha_compra'),
  gastosEvento: makeCrud<GastoEvento, RawGastoEvento> ('gastos_evento', mapGastoEvento, toDbGastoEvento, 'fecha'),
  pagosEvento:  makeCrud<PagoEvento,  RawPagoEvento>  ('pagos_evento',  mapPagoEvento,  toDbPagoEvento,  'fecha'),
  documentos:   makeCrud<Documento,   RawDocumento>   ('documentos',   mapDocumento,   toDbDocumento,   'fecha_subida'),
  usuarios:     makeCrud<Usuario,     RawUsuario>     ('usuarios',     mapUsuario,     toDbUsuario,     'created_at'),
  socios:            makeCrud<Socio,            RawSocio>            ('socios',             mapSocio,            toDbSocio,            'created_at'),
  movimientosSocios: makeCrud<MovimientoSocio,  RawMovimientoSocio>  ('movimientos_socios', mapMovimientoSocio,  toDbMovimientoSocio, 'fecha'),
  impuestos:         makeCrud<Impuesto,         RawImpuesto>         ('impuestos',          mapImpuesto,         toDbImpuesto,        'fecha'),
};
