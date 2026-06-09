/**
 * db.ts — Capa de acceso a Supabase
 * ─────────────────────────────────────────────────────────────────────────────
 * Cada entidad expone: getAll · insert · upsert · delete
 * Las funciones mapean entre snake_case (Postgres) ↔ camelCase (TypeScript).
 */
import { supabase } from './supabase';
import type {
  Evento,
  Ingreso,
  Gasto,
  Suplido,
  Factura,
  Equipo,
  GastoEvento,
  PagoEvento,
} from '../types';

// ── Tipos raw de las filas de Supabase ──────────────────────────────────────

type RawEvento = {
  id: string; nombre: string; cliente: string; fecha: string; tipo: string;
  area: string; presupuesto: number; pagos_recibidos: number; estado: string;
  notas: string | null; created_at: string;
};

type RawIngreso = {
  id: string; area: string; concepto: string; cliente: string;
  tipo_evento: string; evento_id: string | null; fecha_evento: string;
  fecha_factura: string | null; fecha_pago: string | null;
  base_imponible: number; porcentaje_iva: number; importe_iva: number;
  total: number; metodo_pago: string; estado_pago: string;
  pagos_recibidos: number; factura_emitida: boolean;
  numero_factura: string | null; notas: string | null; created_at: string;
};

type RawGasto = {
  id: string; area: string; fecha: string; concepto: string;
  categoria: string; tipo: string; proveedor: string | null;
  base_imponible: number; porcentaje_iva: number; importe_iva: number;
  total: number; metodo_pago: string; factura_recibida: boolean;
  deducible: boolean; evento_id: string | null; observaciones: string | null;
  created_at: string;
};

type RawSuplido = {
  id: string; area: string; fecha: string; cliente: string; concepto: string;
  importe: number; metodo_pago: string; justificante: boolean;
  evento_id: string | null; observaciones: string | null; created_at: string;
};

type RawFactura = {
  id: string; area: string; tipo: string; numero: string; cliente: string;
  concepto: string; base_imponible: number; porcentaje_iva: number;
  importe_iva: number; total: number; fecha: string;
  fecha_vencimiento: string | null; fecha_pago: string | null;
  pagada: boolean; iva_deducible: boolean; evento_id: string | null;
  notas: string | null;
};

type RawEquipo = {
  id: string; area: string; nombre: string; categoria: string;
  base_imponible: number; porcentaje_iva: number; importe_iva: number;
  total: number; fecha_compra: string; proveedor: string | null;
  factura_recibida: boolean; observaciones: string | null; created_at: string;
};

type RawGastoEvento = {
  id: string; ingreso_id: string; area: string; fecha: string;
  concepto: string; categoria: string; importe: number;
  observaciones: string | null; created_at: string;
};

type RawPagoEvento = {
  id: string; ingreso_id: string; area: string; fecha: string;
  importe: number; metodo_pago: string; concepto: string;
  observaciones: string | null; created_at: string;
};

// ── Mappers DB → TS ─────────────────────────────────────────────────────────

const mapEvento = (r: RawEvento): Evento => ({
  id: r.id, nombre: r.nombre, cliente: r.cliente, fecha: r.fecha,
  tipo: r.tipo as Evento['tipo'], area: r.area as Evento['area'],
  presupuesto: Number(r.presupuesto),
  pagosRecibidos: Number(r.pagos_recibidos),
  estado: r.estado as Evento['estado'],
  notas: r.notas ?? undefined,
  createdAt: r.created_at,
});

const mapIngreso = (r: RawIngreso): Ingreso => ({
  id: r.id, area: r.area as Ingreso['area'],
  concepto: r.concepto, cliente: r.cliente,
  tipoEvento: r.tipo_evento as Ingreso['tipoEvento'],
  eventoId: r.evento_id ?? undefined,
  fechaEvento: r.fecha_evento,
  fechaFactura: r.fecha_factura ?? undefined,
  fechaPago: r.fecha_pago ?? undefined,
  baseImponible: Number(r.base_imponible),
  porcentajeIVA: Number(r.porcentaje_iva),
  importeIVA: Number(r.importe_iva),
  total: Number(r.total),
  metodoPago: r.metodo_pago as Ingreso['metodoPago'],
  estadoPago: r.estado_pago as Ingreso['estadoPago'],
  pagosRecibidos: Number(r.pagos_recibidos),
  facturaEmitida: r.factura_emitida,
  numeroFactura: r.numero_factura ?? undefined,
  notas: r.notas ?? undefined,
  createdAt: r.created_at,
});

const mapGasto = (r: RawGasto): Gasto => ({
  id: r.id, area: r.area as Gasto['area'],
  fecha: r.fecha, concepto: r.concepto,
  categoria: r.categoria as Gasto['categoria'],
  tipo: r.tipo as Gasto['tipo'],
  proveedor: r.proveedor ?? undefined,
  baseImponible: Number(r.base_imponible),
  porcentajeIVA: Number(r.porcentaje_iva),
  importeIVA: Number(r.importe_iva),
  total: Number(r.total),
  metodoPago: r.metodo_pago as Gasto['metodoPago'],
  facturaRecibida: r.factura_recibida,
  deducible: r.deducible,
  eventoId: r.evento_id ?? undefined,
  observaciones: r.observaciones ?? undefined,
  createdAt: r.created_at,
});

const mapSuplido = (r: RawSuplido): Suplido => ({
  id: r.id, area: r.area as Suplido['area'],
  fecha: r.fecha, cliente: r.cliente, concepto: r.concepto,
  importe: Number(r.importe),
  metodoPago: r.metodo_pago as Suplido['metodoPago'],
  justificante: r.justificante,
  eventoId: r.evento_id ?? undefined,
  observaciones: r.observaciones ?? undefined,
  createdAt: r.created_at,
});

const mapFactura = (r: RawFactura): Factura => ({
  id: r.id, area: r.area as Factura['area'],
  tipo: r.tipo as Factura['tipo'],
  numero: r.numero, cliente: r.cliente, concepto: r.concepto,
  baseImponible: Number(r.base_imponible),
  porcentajeIVA: Number(r.porcentaje_iva),
  importeIVA: Number(r.importe_iva),
  total: Number(r.total),
  fecha: r.fecha,
  fechaVencimiento: r.fecha_vencimiento ?? undefined,
  fechaPago: r.fecha_pago ?? undefined,
  pagada: r.pagada,
  ivaDeducible: r.iva_deducible,
  eventoId: r.evento_id ?? undefined,
  notas: r.notas ?? undefined,
});

const mapEquipo = (r: RawEquipo): Equipo => ({
  id: r.id, area: r.area as Equipo['area'],
  nombre: r.nombre, categoria: r.categoria,
  baseImponible: Number(r.base_imponible),
  porcentajeIVA: Number(r.porcentaje_iva),
  importeIVA: Number(r.importe_iva),
  total: Number(r.total),
  fechaCompra: r.fecha_compra,
  proveedor: r.proveedor ?? undefined,
  facturaRecibida: r.factura_recibida,
  observaciones: r.observaciones ?? undefined,
  createdAt: r.created_at,
});

// ── Mappers TS → DB ─────────────────────────────────────────────────────────

const toDbEvento = (e: Evento): RawEvento => ({
  id: e.id, nombre: e.nombre, cliente: e.cliente, fecha: e.fecha,
  tipo: e.tipo, area: e.area,
  presupuesto: e.presupuesto,
  pagos_recibidos: e.pagosRecibidos,
  estado: e.estado,
  notas: e.notas ?? null,
  created_at: e.createdAt,
});

const toDbIngreso = (i: Ingreso): RawIngreso => ({
  id: i.id, area: i.area, concepto: i.concepto, cliente: i.cliente,
  tipo_evento: i.tipoEvento,
  evento_id: i.eventoId ?? null,
  fecha_evento: i.fechaEvento,
  fecha_factura: i.fechaFactura ?? null,
  fecha_pago: i.fechaPago ?? null,
  base_imponible: i.baseImponible,
  porcentaje_iva: i.porcentajeIVA,
  importe_iva: i.importeIVA,
  total: i.total,
  metodo_pago: i.metodoPago,
  estado_pago: i.estadoPago,
  pagos_recibidos: i.pagosRecibidos,
  factura_emitida: i.facturaEmitida,
  numero_factura: i.numeroFactura ?? null,
  notas: i.notas ?? null,
  created_at: i.createdAt,
});

const toDbGasto = (g: Gasto): RawGasto => ({
  id: g.id, area: g.area, fecha: g.fecha, concepto: g.concepto,
  categoria: g.categoria, tipo: g.tipo,
  proveedor: g.proveedor ?? null,
  base_imponible: g.baseImponible,
  porcentaje_iva: g.porcentajeIVA,
  importe_iva: g.importeIVA,
  total: g.total,
  metodo_pago: g.metodoPago,
  factura_recibida: g.facturaRecibida,
  deducible: g.deducible,
  evento_id: g.eventoId ?? null,
  observaciones: g.observaciones ?? null,
  created_at: g.createdAt,
});

const toDbSuplido = (s: Suplido): RawSuplido => ({
  id: s.id, area: s.area, fecha: s.fecha, cliente: s.cliente,
  concepto: s.concepto, importe: s.importe,
  metodo_pago: s.metodoPago,
  justificante: s.justificante,
  evento_id: s.eventoId ?? null,
  observaciones: s.observaciones ?? null,
  created_at: s.createdAt,
});

const toDbFactura = (f: Factura): RawFactura => ({
  id: f.id, area: f.area, tipo: f.tipo, numero: f.numero,
  cliente: f.cliente, concepto: f.concepto,
  base_imponible: f.baseImponible,
  porcentaje_iva: f.porcentajeIVA,
  importe_iva: f.importeIVA,
  total: f.total,
  fecha: f.fecha,
  fecha_vencimiento: f.fechaVencimiento ?? null,
  fecha_pago: f.fechaPago ?? null,
  pagada: f.pagada,
  iva_deducible: f.ivaDeducible,
  evento_id: f.eventoId ?? null,
  notas: f.notas ?? null,
});

const mapGastoEvento = (r: RawGastoEvento): GastoEvento => ({
  id: r.id, ingresoId: r.ingreso_id, area: r.area as GastoEvento['area'],
  fecha: r.fecha, concepto: r.concepto,
  categoria: r.categoria as GastoEvento['categoria'],
  importe: Number(r.importe),
  observaciones: r.observaciones ?? undefined,
  createdAt: r.created_at,
});

const mapPagoEvento = (r: RawPagoEvento): PagoEvento => ({
  id: r.id, ingresoId: r.ingreso_id, area: r.area as PagoEvento['area'],
  fecha: r.fecha, importe: Number(r.importe),
  metodoPago: r.metodo_pago as PagoEvento['metodoPago'],
  concepto: r.concepto,
  observaciones: r.observaciones ?? undefined,
  createdAt: r.created_at,
});

const toDbGastoEvento = (g: GastoEvento): RawGastoEvento => ({
  id: g.id, ingreso_id: g.ingresoId, area: g.area,
  fecha: g.fecha, concepto: g.concepto, categoria: g.categoria,
  importe: g.importe, observaciones: g.observaciones ?? null,
  created_at: g.createdAt,
});

const toDbPagoEvento = (p: PagoEvento): RawPagoEvento => ({
  id: p.id, ingreso_id: p.ingresoId, area: p.area,
  fecha: p.fecha, importe: p.importe,
  metodo_pago: p.metodoPago, concepto: p.concepto,
  observaciones: p.observaciones ?? null,
  created_at: p.createdAt,
});

const toDbEquipo = (e: Equipo): RawEquipo => ({
  id: e.id, area: e.area, nombre: e.nombre, categoria: e.categoria,
  base_imponible: e.baseImponible,
  porcentaje_iva: e.porcentajeIVA,
  importe_iva: e.importeIVA,
  total: e.total,
  fecha_compra: e.fechaCompra,
  proveedor: e.proveedor ?? null,
  factura_recibida: e.facturaRecibida,
  observaciones: e.observaciones ?? null,
  created_at: e.createdAt,
});

// ── Helper genérico para lanzar errores de Supabase ─────────────────────────

function check(error: { message: string } | null, ctx: string) {
  if (error) throw new Error(`[db.${ctx}] ${error.message}`);
}

// ── CRUD genérico ────────────────────────────────────────────────────────────

function makeCrud<T, R>(
  table: string,
  mapFrom: (r: R) => T,
  mapTo: (t: T) => R,
  orderCol: string
) {
  return {
    async getAll(): Promise<T[]> {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order(orderCol, { ascending: false });
      check(error, `${table}.getAll`);
      return ((data ?? []) as R[]).map(mapFrom);
    },

    async insert(item: T): Promise<void> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from(table).insert(mapTo(item) as any);
      check(error, `${table}.insert`);
    },

    async upsert(item: T): Promise<void> {
      const { error } = await supabase
        .from(table)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .upsert(mapTo(item) as any, { onConflict: 'id' });
      check(error, `${table}.upsert`);
    },

    async delete(id: string): Promise<void> {
      const { error } = await supabase.from(table).delete().eq('id', id);
      check(error, `${table}.delete`);
    },
  };
}

// ── API pública ──────────────────────────────────────────────────────────────

export const db = {
  eventos:      makeCrud<Evento,      RawEvento>      ('eventos',      mapEvento,      toDbEvento,      'fecha'),
  ingresos:     makeCrud<Ingreso,     RawIngreso>     ('ingresos',     mapIngreso,     toDbIngreso,     'fecha_evento'),
  gastos:       makeCrud<Gasto,       RawGasto>       ('gastos',       mapGasto,       toDbGasto,       'fecha'),
  suplidos:     makeCrud<Suplido,     RawSuplido>     ('suplidos',     mapSuplido,     toDbSuplido,     'fecha'),
  facturas:     makeCrud<Factura,     RawFactura>     ('facturas',     mapFactura,     toDbFactura,     'fecha'),
  equipo:       makeCrud<Equipo,      RawEquipo>      ('equipo',       mapEquipo,      toDbEquipo,      'fecha_compra'),
  gastosEvento: makeCrud<GastoEvento, RawGastoEvento> ('gastos_evento', mapGastoEvento, toDbGastoEvento, 'fecha'),
  pagosEvento:  makeCrud<PagoEvento,  RawPagoEvento>  ('pagos_evento',  mapPagoEvento,  toDbPagoEvento,  'fecha'),
};
