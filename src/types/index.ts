export type Area = 'montada' | 'dj';

export type EventType =
  | 'boda'
  | 'real_madrid'
  | 'alquiler'
  | 'evento_privado'
  | 'dj_personal'
  | 'empresa'
  | 'otro';

export type EventStatus = 'pendiente' | 'confirmado' | 'realizado' | 'cobrado' | 'facturado';
export type PaymentStatus = 'pendiente' | 'parcial' | 'pagado';
export type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque' | 'otro';
export type GastoTipo = 'fijo' | 'variable';

export type GastoCategoria =
  | 'Personal'
  | 'Transporte'
  | 'Gasolina'
  | 'Dietas'
  | 'Alquiler externo'
  | 'Técnico'
  | 'Material'
  | 'Hotel'
  | 'Autónomos'
  | 'Gestoría'
  | 'Almacén'
  | 'Seguros'
  | 'Software'
  | 'Comunicaciones'
  | 'Publicidad'
  | 'Otros';

export interface Ingreso {
  id: string;
  area: Area;
  concepto: string;
  cliente: string;
  tipoEvento: EventType;
  eventoId?: string;
  // Fechas
  fechaEvento: string;
  fechaFactura?: string;
  fechaPago?: string;
  // Importes — cálculos SIEMPRE en baseImponible
  baseImponible: number;
  porcentajeIVA: number;
  importeIVA: number;
  total: number;
  // Cobro
  metodoPago: PaymentMethod;
  estadoPago: PaymentStatus;
  pagosRecibidos: number;     // en total con IVA
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
  ivaDeducible: boolean;
  eventoId?: string;
  notas?: string;
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
  observaciones?: string;
  createdAt: string;
}

export interface AppState {
  // ── datos ──────────────────────────────────────────────────────────────────
  eventos: Evento[];
  ingresos: Ingreso[];
  gastos: Gasto[];
  suplidos: Suplido[];
  facturas: Factura[];
  equipo: Equipo[];

  // ── estado de carga ────────────────────────────────────────────────────────
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
}
