// ── Áreas ─────────────────────────────────────────────────────────────────────
export type Area = 'montada' | 'dj';
export type AreaKey = 'montada' | 'dj' | 'inversiones' | 'facturas' | 'informes';

// ── Permisos y usuarios ───────────────────────────────────────────────────────
export interface PermisoArea {
  ver: boolean;
  crear: boolean;
  editar: boolean;
  eliminar: boolean;
}

export type Permisos = Record<AreaKey, PermisoArea>;

export const ALL_PERMS: Permisos = {
  montada:     { ver: true, crear: true, editar: true, eliminar: true },
  dj:          { ver: true, crear: true, editar: true, eliminar: true },
  inversiones: { ver: true, crear: true, editar: true, eliminar: true },
  facturas:    { ver: true, crear: true, editar: true, eliminar: true },
  informes:    { ver: true, crear: true, editar: true, eliminar: true },
};

export const NO_PERMS: Permisos = {
  montada:     { ver: false, crear: false, editar: false, eliminar: false },
  dj:          { ver: false, crear: false, editar: false, eliminar: false },
  inversiones: { ver: false, crear: false, editar: false, eliminar: false },
  facturas:    { ver: false, crear: false, editar: false, eliminar: false },
  informes:    { ver: false, crear: false, editar: false, eliminar: false },
};

export type UserRol = 'admin' | 'usuario';

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  passwordHash: string;
  rol: UserRol;
  permisos: Permisos;
  activo: boolean;
  createdAt: string;
}

// ── Enumeraciones ─────────────────────────────────────────────────────────────
export type EventType =
  | 'boda'
  | 'real_madrid'
  | 'alquiler'
  | 'evento_privado'
  | 'dj_personal'
  | 'empresa'
  | 'otro';

export type EventStatus = 'pendiente' | 'confirmado' | 'realizado' | 'cobrado' | 'facturado';

// Ampliado: presupuesto y cancelado
export type PaymentStatus = 'presupuesto' | 'pendiente' | 'parcial' | 'pagado' | 'cancelado';

export type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque' | 'bizum' | 'otro';

export type GastoTipo = 'fijo' | 'variable';

export type GastoCategoria =
  | 'Alquiler'
  | 'Gestoría'
  | 'Seguros'
  | 'Combustible'
  | 'Vehículos'
  | 'Publicidad'
  | 'Software'
  | 'Teléfono'
  | 'Personal'
  | 'Material oficina'
  | 'Reparaciones'
  | 'Transporte'
  | 'Dietas'
  | 'Hotel'
  | 'Autónomos'
  | 'Almacén'
  | 'Comunicaciones'
  | 'Otros';

export type GastoEventoCategoria =
  | 'DJ'
  | 'Técnico'
  | 'Fotomatón'
  | 'Personal'
  | 'Gasolina'
  | 'Transporte'
  | 'Hotel'
  | 'Alquiler material'
  | 'Catering'
  | 'Peajes'
  | 'Dietas'
  | 'Proveedores'
  | 'Comisiones'
  | 'Reparaciones'
  | 'Otros';

export type DocumentoTipo = 'factura' | 'presupuesto' | 'contrato' | 'justificante' | 'ticket' | 'otro';
export type DocumentoEntityType = 'ingreso' | 'gasto' | 'factura' | 'evento' | 'equipo';

// ── Entidades ────────────────────────────────────────────────────────────────

export interface Ingreso {
  id: string;
  area: Area;
  concepto: string;
  cliente: string;
  empresa: boolean;           // true=empresa, false=particular
  tipoEvento: EventType;
  eventoId?: string;
  // Fechas
  fechaEvento: string;
  fechaFactura?: string;
  fechaCobroPrevista?: string;
  fechaPago?: string;
  // Importes
  baseImponible: number;
  porcentajeIVA: number;
  importeIVA: number;
  total: number;
  // Cobro
  metodoPago: PaymentMethod;
  estadoPago: PaymentStatus;
  pagosRecibidos: number;
  // Factura
  facturaEmitida: boolean;
  numeroFactura?: string;
  notas?: string;
  createdAt: string;
}

export interface Gasto {
  id: string;
  area: Area;
  fecha: string;
  concepto: string;
  categoria: GastoCategoria;
  tipo: GastoTipo;
  proveedor?: string;
  // Importes
  baseImponible: number;
  porcentajeIVA: number;
  importeIVA: number;
  total: number;
  // Detalles
  metodoPago: PaymentMethod;
  estadoPago: 'pendiente' | 'pagado';
  facturaRecibida: boolean;
  deducible: boolean;
  eventoId?: string;
  observaciones?: string;
  createdAt: string;
}

export interface Suplido {
  id: string;
  area: Area;
  fecha: string;
  cliente: string;
  concepto: string;
  importe: number;
  metodoPago: PaymentMethod;
  justificante: boolean;
  eventoId?: string;
  observaciones?: string;
  createdAt: string;
}

export interface Evento {
  id: string;
  nombre: string;
  cliente: string;
  fecha: string;
  tipo: EventType;
  area: Area;
  presupuesto: number;
  pagosRecibidos: number;
  estado: EventStatus;
  notas?: string;
  createdAt: string;
}

export interface Factura {
  id: string;
  area: Area;
  tipo: 'emitida' | 'recibida';
  numero: string;
  serie?: string;             // LMS-2026 / DJ-2026
  cliente: string;
  concepto: string;
  baseImponible: number;
  porcentajeIVA: number;
  importeIVA: number;
  total: number;
  fecha: string;
  fechaVencimiento?: string;
  fechaPago?: string;
  pagada: boolean;
  pagosRecibidos?: number;
  ivaDeducible: boolean;
  eventoId?: string;
  ingresoId?: string;
  notas?: string;
  enviada?: boolean;
}

export interface GastoEvento {
  id: string;
  ingresoId: string;
  area: Area;
  fecha: string;
  concepto: string;
  categoria: GastoEventoCategoria;
  importe: number;
  observaciones?: string;
  createdAt: string;
}

export interface PagoEvento {
  id: string;
  ingresoId: string;
  area: Area;
  fecha: string;
  importe: number;
  metodoPago: PaymentMethod;
  concepto: string;
  observaciones?: string;
  createdAt: string;
}

export interface Equipo {
  id: string;
  area: Area;
  nombre: string;
  categoria: string;
  baseImponible: number;
  porcentajeIVA: number;
  importeIVA: number;
  total: number;
  fechaCompra: string;
  proveedor?: string;
  facturaRecibida: boolean;
  formaPago?: PaymentMethod;
  financiado?: boolean;
  vidaUtil?: number;          // años
  garantia?: number;          // meses
  fechaFinGarantia?: string;
  numeroSerie?: string;
  observaciones?: string;
  createdAt: string;
}

export interface Documento {
  id: string;
  entityType: DocumentoEntityType;
  entityId: string;
  area: Area;
  nombre: string;
  tipo: DocumentoTipo;
  storageKey: string;
  url: string;
  fechaSubida: string;
  subidoPor: string;
  subidoPorNombre: string;
  tamano: number;
  createdAt: string;
}

// ── AppState ──────────────────────────────────────────────────────────────────
export interface AppState {
  eventos:      Evento[];
  ingresos:     Ingreso[];
  gastos:       Gasto[];
  suplidos:     Suplido[];
  facturas:     Factura[];
  equipo:       Equipo[];
  gastosEvento: GastoEvento[];
  pagosEvento:  PagoEvento[];
  documentos:   Documento[];
  usuarios:     Usuario[];

  _loaded: boolean;
  _error: string | null;
  initData: () => Promise<void>;

  addEvento: (e: Evento) => void;
  updateEvento: (id: string, e: Partial<Evento>) => void;
  deleteEvento: (id: string) => void;

  addIngreso: (i: Ingreso) => void;
  updateIngreso: (id: string, i: Partial<Ingreso>) => void;
  deleteIngreso: (id: string) => void;

  addGasto: (g: Gasto) => void;
  updateGasto: (id: string, g: Partial<Gasto>) => void;
  deleteGasto: (id: string) => void;

  addSuplido: (s: Suplido) => void;
  updateSuplido: (id: string, s: Partial<Suplido>) => void;
  deleteSuplido: (id: string) => void;

  addFactura: (f: Factura) => void;
  updateFactura: (id: string, f: Partial<Factura>) => void;
  deleteFactura: (id: string) => void;

  addEquipo: (e: Equipo) => void;
  updateEquipo: (id: string, e: Partial<Equipo>) => void;
  deleteEquipo: (id: string) => void;

  addGastoEvento: (g: GastoEvento) => void;
  updateGastoEvento: (id: string, g: Partial<GastoEvento>) => void;
  deleteGastoEvento: (id: string) => void;

  addPagoEvento: (p: PagoEvento) => void;
  updatePagoEvento: (id: string, p: Partial<PagoEvento>) => void;
  deletePagoEvento: (id: string) => void;

  addDocumento: (d: Documento) => void;
  deleteDocumento: (id: string) => void;

  addUsuario: (u: Usuario) => void;
  updateUsuario: (id: string, u: Partial<Usuario>) => void;
  deleteUsuario: (id: string) => void;
}
