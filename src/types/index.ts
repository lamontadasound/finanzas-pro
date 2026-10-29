// ── Áreas ─────────────────────────────────────────────────────────────────────
export type Area = 'montada' | 'dj';
export type AreaKey = 'montada' | 'dj' | 'inversiones' | 'facturas' | 'informes' | 'pagos' | 'impuestos';

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
  impuestos:   { ver: true, crear: true, editar: true, eliminar: true },
};

export const NO_PERMS: Permisos = {
  montada:     { ver: false, crear: false, editar: false, eliminar: false },
  dj:          { ver: false, crear: false, editar: false, eliminar: false },
  inversiones: { ver: false, crear: false, editar: false, eliminar: false },
  facturas:    { ver: false, crear: false, editar: false, eliminar: false },
  informes:    { ver: false, crear: false, editar: false, eliminar: false },
  pagos:       { ver: false, crear: false, editar: false, eliminar: false },
  impuestos:   { ver: false, crear: false, editar: false, eliminar: false },
};

// ── Permisos granulares por línea de negocio y por módulo (Fase F) ──────────
// Modelo definitivo: cada permiso vivirá en `user_line_permissions` /
// `user_module_permissions` (ver supabase/migrations/…fase_f_permisos.sql,
// preparada y NO ejecutada). Hasta que esa migración se apruebe y se migre
// el login a Supabase Auth (`auth.users`/`auth.uid()` — requisito real para
// que RLS pueda distinguir usuarios), estos permisos se guardan dentro del
// MISMO campo JSONB `usuarios.permisos` ya existente, en dos claves nuevas
// (`lineas` y `modulos`) que no chocan con las claves legadas de `Permisos`
// — cero migración de esquema, 100% aditivo y reversible. Un usuario sin
// estas claves (fila antigua) se trata como "sin ningún permiso" (denegar
// por defecto), nunca como "todo permitido".
export type ModuloId = 'contabilidad' | 'informes' | 'impuestos' | 'administracion';
export const MODULO_IDS: ModuloId[] = ['contabilidad', 'informes', 'impuestos', 'administracion'];

export interface PermisoCRUD {
  secciones?: string[] | null;
  ver: boolean;
  crear: boolean;
  editar: boolean;
  eliminar: boolean;
}

export const NO_PERM_CRUD: PermisoCRUD = { ver: false, crear: false, editar: false, eliminar: false };
export const ALL_PERM_CRUD: PermisoCRUD = { ver: true, crear: true, editar: true, eliminar: true };

// Se define aquí (no importando LineaId de config/businessLines) para no
// crear una dependencia circular types↔config; el shape es idéntico y se
// usa siempre indexado por LineaId real en tiempo de ejecución.
export type PermisosLineas = Record<string, PermisoCRUD>;
export type PermisosModulos = Record<ModuloId, PermisoCRUD>;

export const NO_PERMS_MODULOS: PermisosModulos = {
  contabilidad: { ...NO_PERM_CRUD },
  informes: { ...NO_PERM_CRUD },
  impuestos: { ...NO_PERM_CRUD },
  administracion: { ...NO_PERM_CRUD },
};

export const ALL_PERMS_MODULOS: PermisosModulos = {
  contabilidad: { ...ALL_PERM_CRUD },
  informes: { ...ALL_PERM_CRUD },
  impuestos: { ...ALL_PERM_CRUD },
  administracion: { ...ALL_PERM_CRUD },
};

export type UserRol = 'admin' | 'usuario';

// Fase G: sin `passwordHash` — el frontend ya no descarga, calcula ni
// compara ningún hash de contraseña. Cuenta legada, pendiente de migrar a
// `profiles`/Supabase Auth (ver auditoría de migración de usuarios).
export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: UserRol;
  permisos: Permisos;
  activo: boolean;
  createdAt: string;
  // Fase F — granular por línea/módulo. Opcionales: una fila creada antes
  // de esta fase no los tiene, y se trata como "sin ningún permiso nuevo"
  // (deny-by-default), nunca como acceso implícito.
  permisosLineas?: PermisosLineas;
  permisosModulos?: PermisosModulos;
  /** Fase H — permisos finos de facturación, independientes del CRUD genérico de `contabilidad`. Opcional: deny-by-default si no está. */
  permisosFacturacion?: PermisosFacturacion;
  ultimoAcceso?: string;
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

// Categorías configurables, conservadas como texto en el histórico.
export type GastoCategoria = string;

// Categorías de evento editables, persistidas en cada gasto.
export type GastoEventoCategoria = string;

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
  reservaIncluyeIva?: boolean;
  restanteIncluyeIva?: boolean;
  sinFactura?: boolean;
  // Línea de negocio — distinta de "Tipo de evento"
  lineaNegocio?: 'La Montada Sound' | 'DJs' | 'Real Madrid' | 'La Montada Installations' | 'montada_sound' | 'dj' | 'real_madrid' | 'montada_installations';
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
  lineaNegocio?: 'La Montada Sound' | 'DJs' | 'Real Madrid' | 'La Montada Installations' | 'montada_sound' | 'dj' | 'real_madrid' | 'montada_installations';
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

// ── Facturación (Fase H) ─────────────────────────────────────────────────
// Estados de una factura EMITIDA — nunca se confunde "facturado" (estos
// estados) con "cobrado" (estadoPago/pagosRecibidos del Ingreso, ya
// centralizado en `lib/contabilidad.ts`). Son dos ejes independientes.
export type FacturaEstado =
  | 'borrador'                // 0% — no consume número, no es fiscal
  | 'emitida'                 // número asignado, nada cobrado todavía
  | 'parcialmente_cobrada'
  | 'cobrada'
  | 'anulada'                 // número NUNCA se reutiliza
  | 'pendiente_sincronizar'   // PDF generado, subida a Drive pendiente/en curso
  | 'error_sincronizacion';

export type FacturaSyncEstado = 'sin_sincronizar' | 'sincronizada' | 'pendiente' | 'error';

export interface FacturaHistorialEntry {
  fecha: string;       // ISO
  usuarioId: string;
  usuarioNombre: string;
  accion: 'creada' | 'editada' | 'factura_editada' | 'factura_restaurada' | 'emitida' | 'anulada' | 'cobro_registrado' | 'reintento_sync';
  detalle?: string;
}

export interface Factura {
  emisorId?: string;
  gastoId?: string;
  id: string;
  area: Area;
  tipo: 'emitida' | 'recibida';
  numero: string;
  serie?: string;             // LMS-2026 / DJ-2026
  cliente: string;
  concepto: string;
  // Línea de negocio — igual que en Ingreso/Gasto/Impuesto, distingue Real
  // Madrid dentro de area='dj'. Campo opcional, no persiste en Supabase
  // hasta aplicar la migración `linea_negocio` preparada (tabla `facturas`
  // hoy tiene 0 filas reales, así que no hay datos existentes que migrar).
  lineaNegocio?: 'La Montada Sound' | 'DJs' | 'Real Madrid' | 'La Montada Installations' | 'montada_sound' | 'dj' | 'real_madrid' | 'montada_installations';
  baseImponible: number;
  porcentajeIVA: number;
  importeIVA: number;
  retencion?: number;         // importe de retención, si aplica (0 si no)
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

  // ── Facturación parcial por porcentaje (solo tipo='emitida') ────────────
  estado?: FacturaEstado;
  porcentajeFacturado?: number;      // 0 | 30 | 50 | 100 | personalizado
  numeroSecuencial?: number;         // el número real, ya asignado (atómico) — `numero` es su representación con formato
  fechaEmision?: string;             // cuándo se confirmó la emisión (distinto de `fecha`, que es la fecha del documento)
  emitidaPor?: string;               // userId de quien confirmó la emisión
  anuladaPor?: string;
  fechaAnulacion?: string;
  motivoAnulacion?: string;
  historial?: FacturaHistorialEntry[];
  // Copia congelada de los datos del emisor/cliente EN EL MOMENTO de la
  // emisión — una edición posterior de `ConfiguracionFiscal`/`Cliente`
  // nunca debe alterar una factura ya emitida. El PDF de una factura con
  // estado distinto de 'borrador' se genera siempre desde este snapshot.
  emisorSnapshot?: Partial<ConfiguracionFiscal>;
  clienteSnapshot?: Partial<Cliente>;
  clienteBorrador?: Partial<Cliente>;
  fechaEvento?: string;
  numeroSolicitado?: number;
  ocultaEn?: string;
  /** Si esta factura ES una rectificativa, apunta a la factura original que corrige. */
  facturaRectificaId?: string;

  // ── Factura de gasto (tipo='recibida') — número propio del proveedor ───
  numeroProveedor?: string;          // NUNCA entra en la numeración propia
  proveedor?: string;
  posibleDuplicado?: boolean;        // detectado por hash/heurística al adjuntar

  // ── Sincronización con Google Drive (Fase H — preparado, sin conectar) ──
  driveFileId?: string;
  driveFolderId?: string;
  driveLink?: string;
  driveNombreArchivo?: string;
  driveFechaSubida?: string;
  driveSubidoPor?: string;
  syncEstado?: FacturaSyncEstado;
  syncUltimoError?: string;
}

// ── Cliente — datos fiscales para autocompletar facturas ────────────────
export interface Cliente {
  referenciaFactura?: string; // Referencia externa de esta factura, no del perfil fiscal.
  id: string;
  nombre: string;                    // razón social o nombre comercial
  nifCif?: string;
  direccion?: string;
  email?: string;
  telefono?: string;
  esEmpresa: boolean;
  observaciones?: string;
  createdAt: string;
}

// ── Configuración fiscal de la sociedad (Administración, solo admin) ────
export interface ConfiguracionFiscal {
  id: string;                        // libre — 'default' es el emisor migrado del modelo antiguo, el resto son emisores creados por un admin
  nombreInterno?: string;            // solo para elegir en el desplegable de Admin — nunca aparece en el PDF
  activo?: boolean;
  razonSocial?: string;
  nombreComercial?: string;
  nifCif?: string;
  direccionFiscal?: string;
  email?: string;
  telefono?: string;
  iban?: string;
  web?: string;
  logoUrl?: string;
  condicionesPago?: string;
  textoLegal?: string;
  serieFormato?: string;             // p.ej. "{numero}" o "LMS-{numero}"
  numeroInicial?: number;            // solo editable por admin, una vez
  /** Debe ser `true` antes de que el backend permita emitir ninguna factura real (ver RPC `fijar_numero_inicial_factura`). */
  numeracionConfirmada?: boolean;
  actualizadoPor?: string;
  actualizadoEn?: string;
}
// RESUELTO (Fase H): existen tantas filas de `ConfiguracionFiscal` (emisores)
// como haga falta — ver `AppState.emisores`/`proyectoEmisorMap` y la página
// Administración → Emisores fiscales. Un proyecto no equivale
// automáticamente a un emisor distinto: cada línea de negocio se asigna
// explícitamente a un emisor, por defecto al de `id: 'default'` (migrado
// del antiguo modelo de fila única) hasta que un admin la reasigne.

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
  metodoPago?: PaymentMethod;
  // Desglose de IVA opcional; importe conserva el coste histórico.
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
  lineaNegocio?: 'montada_sound' | 'montada_installations';
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

// ── Impuestos (Contabilidad) ────────────────────────────────────
export type ImpuestoTipo = 'autonomos' | 'nominas_ss' | 'iva' | 'sociedades' | 'gestoria';

export const IMPUESTO_TIPO_LABEL: Record<ImpuestoTipo, string> = {
  autonomos:  'Cuota de autónomos',
  nominas_ss: 'Nóminas y Seguridad Social',
  iva:        'IVA',
  sociedades: 'Impuesto de Sociedades',
  gestoria: 'Gestoría',
};

export interface Impuesto {
  id: string;
  tipo: ImpuestoTipo;
  concepto: string;
  fecha: string;             // periodo/vencimiento del impuesto
  importe: number;
  estado: 'pendiente' | 'pagado';
  fechaPago?: string;
  observaciones?: string;
  lineaNegocio?: 'La Montada Sound' | 'DJs' | 'Real Madrid' | 'La Montada Installations' | 'montada_sound' | 'dj' | 'real_madrid' | 'montada_installations';
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
  impuestos:         Impuesto[];
  clientes:            Cliente[];
  // ── Emisores fiscales (Fase H) ──────────────────────────────────────────
  // Sustituye por completo el antiguo modelo de un único
  // `configuracionFiscal` — un proyecto puede facturar bajo cualquiera de
  // estos emisores, asignado vía `proyectoEmisorMap`. Se conserva siempre
  // al menos un emisor con `id: 'default'` como resultado de migrar el
  // dato antiguo (ver `useStore.initData`) — nunca dos fuentes de verdad
  // en paralelo: todo el código de facturación lee de aquí, nunca de un
  // campo `configuracionFiscal` suelto (eliminado).
  emisores: ConfiguracionFiscal[];
  /** lineaId (LineaId) → id de ConfiguracionFiscal asignado a esa línea/proyecto. */
  proyectoEmisorMap: Record<string, string>;

  _loaded: boolean;
  _error: string | null;
  _saveError: string | null;
  initData: () => Promise<void>;

  addEvento: (e: Evento) => Promise<boolean>;
  updateEvento: (id: string, e: Partial<Evento>) => Promise<boolean>;
  deleteEvento: (id: string) => Promise<boolean>;

  addIngreso: (i: Ingreso) => Promise<boolean>;
  updateIngreso: (id: string, i: Partial<Ingreso>) => Promise<boolean>;
  deleteIngreso: (id: string) => Promise<boolean>;

  addGasto: (g: Gasto) => Promise<boolean>;
  updateGasto: (id: string, g: Partial<Gasto>) => Promise<boolean>;
  deleteGasto: (id: string) => Promise<boolean>;

  addSuplido: (s: Suplido) => Promise<boolean>;
  updateSuplido: (id: string, s: Partial<Suplido>) => Promise<boolean>;
  deleteSuplido: (id: string) => Promise<boolean>;

  addFactura: (f: Factura) => Promise<boolean>;
  updateFactura: (id: string, f: Partial<Factura>) => Promise<boolean>;
  deleteFactura: (id: string) => Promise<boolean>;

  addEquipo: (e: Equipo) => Promise<{ success: boolean; message: string }>;
  updateEquipo: (id: string, e: Partial<Equipo>) => Promise<{ success: boolean; message: string }>;
  deleteEquipo: (id: string) => Promise<{ success: boolean; message: string }>;

  addGastoEvento: (g: GastoEvento) => Promise<boolean>;
  updateGastoEvento: (id: string, g: Partial<GastoEvento>) => Promise<boolean>;
  deleteGastoEvento: (id: string) => Promise<boolean>;

  addPagoEvento: (p: PagoEvento) => Promise<boolean>;
  updatePagoEvento: (id: string, p: Partial<PagoEvento>) => Promise<boolean>;
  deletePagoEvento: (id: string) => Promise<boolean>;

  addDocumento: (d: Documento) => Promise<boolean>;
  deleteDocumento: (id: string) => Promise<boolean>;

  addUsuario: (u: Usuario) => Promise<boolean>;
  updateUsuario: (id: string, u: Partial<Usuario>) => Promise<boolean>;
  deleteUsuario: (id: string) => Promise<boolean>;

  addSocio: (s: Socio) => Promise<boolean>;
  updateSocio: (id: string, s: Partial<Socio>) => Promise<boolean>;
  deleteSocio: (id: string) => Promise<boolean>;

  addMovimientoSocio: (m: MovimientoSocio) => Promise<boolean>;
  updateMovimientoSocio: (id: string, m: Partial<MovimientoSocio>) => Promise<boolean>;
  deleteMovimientoSocio: (id: string) => Promise<boolean>;

  addImpuesto: (i: Impuesto) => Promise<boolean>;
  updateImpuesto: (id: string, i: Partial<Impuesto>) => Promise<boolean>;
  deleteImpuesto: (id: string) => Promise<boolean>;

  addCliente: (c: Cliente) => Promise<boolean>;
  updateCliente: (id: string, c: Partial<Cliente>) => Promise<boolean>;
  deleteCliente: (id: string) => Promise<boolean>;

  addEmisor: (e: ConfiguracionFiscal) => Promise<boolean>;
  updateEmisor: (id: string, e: Partial<ConfiguracionFiscal>) => Promise<boolean>;
  deleteEmisor: (id: string) => Promise<boolean>;
  /** Asigna (o reasigna) el emisor fiscal de una línea/proyecto — solo admin en la UI. */
  setProyectoEmisor: (lineaId: string, emisorId: string) => Promise<boolean>;

  // ── Permisos de facturación diferenciados (Fase H) ──────────────────────
  permisosFacturacion: Record<string, PermisosFacturacion>; // userId -> permisos
  setPermisosFacturacion: (userId: string, p: PermisosFacturacion) => Promise<boolean>;
}

/** Permisos específicos de facturación — independientes del CRUD genérico del módulo `contabilidad`. */
export interface PermisosFacturacion {
  emitir: boolean;
  rectificar: boolean;
  gestionarNumeracion: boolean;
}
export const NO_PERMS_FACTURACION: PermisosFacturacion = { emitir: false, rectificar: false, gestionarNumeracion: false };
export const ALL_PERMS_FACTURACION: PermisosFacturacion = { emitir: true, rectificar: true, gestionarNumeracion: true };
