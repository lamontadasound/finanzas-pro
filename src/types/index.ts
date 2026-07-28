// ── Áreas ─────────────────────────────────────────────────────────────────────
export type Area = 'montada' | 'dj';
export type AreaKey = 'montada' | 'dj' | 'inversiones' | 'facturas' | 'informes' | 'pagos';

// Inversiones tiene su propia categorización de 3 áreas (independiente de Area).
// 'real_madrid' se muestra en el frontend como "DJ Personal (Real Madrid)",
// pero el valor almacenado sigue siendo 'real_madrid' — debe coincidir con el
// permitido por el CHECK de equipo.area en Supabase.
export type InversionArea = 'montada' | 'dj' | 'real_madrid';

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
  pagos:       { ver: true, crear: true, editar: true, eliminar: true },
};

export const NO_PERMS: Permisos = {
  montada:     { ver: false, crear: false, editar: false, eliminar: false },
  dj:          { ver: false, crear: false, editar: false, eliminar: false },
  inversiones: { ver: false, crear: false, editar: false, eliminar: false },
  facturas:    { ver: false, crear: false, editar: false, eliminar: false },
  informes:    { ver: false, crear: false, editar: false, eliminar: false },
  pagos:       { ver: false, crear: false, editar: false, eliminar: false },
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

// Quién ha pagado el gasto (lista cerrada)
export type PagadoPor = 'La Montada' | 'Julia' | 'Rodrigo' | 'Julia y Rodrigo' | 'Marco';

// Categorías de Gastos generales (cerradas)
export type GastoCategoria =
  | 'Impuestos'
  | 'Gestoría'
  | 'Marketing'
  | 'RRSS'
  | 'Software'
  | 'Personal'
  | 'Material'
  | 'Equipo';

// Categorías de Gastos de evento/actuación (cerradas)
export type GastoEventoCategoria =
  | 'Cámara'
  | 'DJ'
  | 'Montador'
  | 'Técnico'
  | 'Decoración'
  | 'Gasolina'
  | 'Transporte'
  | 'Personal'
  | 'Alquiler'
  | 'Proveedor'
  | 'Otro';

export type DocumentoTipo = 'factura' | 'presupuesto' | 'contrato' | 'justificante' | 'garantia' | 'ticket' | 'otro';
export type DocumentoEntityType = 'ingreso' | 'gasto' | 'factura' | 'evento' | 'equipo';

// ── Entidades ────────────────────────────────────────────────────────────────

export interface Ingreso {
  id: string;
  area: Area;
  concepto: string;
  cliente: string;
  empresa: boolean;           // true=empresa, false=particular
  tipoEvento: string;         // texto libre (antes era EventType cerrado)
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
  // Reserva y "No factura"
  reserva?: number;
  tieneReserva?: boolean;
  fechaCobroReserva?: string;
  metodoPagoReserva?: PaymentMethod;
  sinFactura?: boolean;
  // Línea de negocio — distinta de "Tipo de evento"
  lineaNegocio?: 'La Montada Sound' | 'DJs' | 'Real Madrid';
  // DJ relacionado con la actuación
  djRelacionado?: string;
}

export interface Gasto {
  id: string;
  area: Area;
  fecha: string;
  concepto: string;
  categoria: GastoCategoria;  // lista cerrada
  tipo: GastoTipo;            // Fijo / Variable — lista cerrada
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
  // Gastos recurrentes
  pagadoPor?: PagadoPor;
  fechaPago?: string;
  numeroFactura?: string;
  esRecurrente?: boolean;
  periodicidad?: 'mensual' | 'trimestral' | 'semestral' | 'anual' | 'personalizada';
  fechaInicioRecurrencia?: string;
  fechaFinRecurrencia?: string;
  proximaFechaPago?: string;
  renovacionAutomatica?: boolean;
  recurrenciaId?: string;
  // Línea de negocio del gasto general — para separar la rentabilidad de
  // inversiones entre La Montada Sound y DJ Personal (Real Madrid)
  lineaNegocio?: 'La Montada Sound' | 'DJs' | 'Real Madrid';
}

export interface Suplido {
  id: string;
  area: Area;
  fecha: string;
  cliente: string;
  concepto: string;
  importe: number;           // cantidad adelantada
  metodoPago: PaymentMethod;
  justificante: boolean;
  eventoId?: string;
  observaciones?: string;
  createdAt: string;
  // Suplidos por actuación (DJs)
  ingresoId?: string;                          // vincula el suplido a la actuación (Ingreso.id)
  estado?: 'pendiente' | 'cobrado';
  cantidadRecuperada?: number;
  fechaCobro?: string;
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
  // Documento adjunto — pendiente de activar bucket de Storage
  documentoId?: string;
}

export interface GastoEvento {
  id: string;
  ingresoId: string;
  area: Area;
  fecha: string;
  concepto: string;
  categoria: GastoEventoCategoria;
  importe: number;             // legado — total del coste (no se modifica su significado)
  observaciones?: string;
  createdAt: string;
  // Desglose de IVA (columnas nuevas, no persiste hasta aplicar SQL)
  baseImponible?: number;
  porcentajeIVA?: number;
  importeIVA?: number;
  totalConIva?: number;
  facturaRecibida?: boolean;
  numeroFactura?: string;
  estadoPago?: 'pendiente' | 'pagado';
  proveedor?: string;
  tipo?: GastoTipo;
  pagadoPor?: PagadoPor;
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
  area: InversionArea;
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
  // Ampliación de Inversiones
  descripcion?: string;
  marca?: string;
  modelo?: string;
  comprador?: string;
  propietario?: string;
  eventoRelacionadoId?: string;
  valorResidual?: number;
  documentoId?: string;
  // Cantidad de unidades de este mismo producto
  cantidad?: number;
}

// ── Reparto socios (La Montada Sound) ────────────────
export interface Socio {
  id: string;
  nombre: string;
  porcentaje: number; // 0-100, configurable por el administrador (no 50% por defecto)
  fechaIncorporacion?: string;
  activo?: boolean; // por defecto true
  observaciones?: string;
  createdAt: string;
}

export type MovimientoSocioTipo =
  | 'aportacion_personal'
  | 'reintegro_aportacion'
  | 'beneficio_reinvertido'
  | 'reparto_beneficio_cobrado'
  | 'adelanto_socio'
  | 'devolucion_adelanto'
  | 'ajuste';

export interface MovimientoSocio {
  id: string;
  socioId: string;
  fecha: string;
  tipo: MovimientoSocioTipo;
  cantidad: number;
  concepto: string;
  cuenta?: string;
  documentoId?: string;
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
  socios:            Socio[];
  movimientosSocios: MovimientoSocio[];

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

  addSocio: (s: Socio) => void;
  updateSocio: (id: string, s: Partial<Socio>) => void;
  deleteSocio: (id: string) => void;

  addMovimientoSocio: (m: MovimientoSocio) => void;
  updateMovimientoSocio: (id: string, m: Partial<MovimientoSocio>) => void;
  deleteMovimientoSocio: (id: string) => void;
}
