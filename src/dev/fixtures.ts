// ── Datos ficticios para el entorno local de pruebas visuales ──────────────
// Usados SOLO por src/dev/DevPreview.tsx, que a su vez solo se monta cuando
// `import.meta.env.DEV` es true (ver src/App.tsx) — Vite elimina esta rama
// por completo del build de producción (dead-code elimination sobre una
// condición estática), así que nada de esto llega nunca a producción.
// Ningún dato aquí es real: nombres, importes y fechas son inventados.
import { LINEA_IDS, type LineaId } from '../config/businessLines';
import { ALL_PERM_CRUD } from '../types';
import type {
  Ingreso, Gasto, Factura, Cliente, ConfiguracionFiscal, Evento,
} from '../types';

export const FIXTURE_PERMISOS_LINEAS: Record<LineaId, typeof ALL_PERM_CRUD> =
  Object.fromEntries(LINEA_IDS.map((id) => [id, ALL_PERM_CRUD])) as Record<LineaId, typeof ALL_PERM_CRUD>;

export const fixtureIngresos: Ingreso[] = [
  { id: 'fx-i1', area: 'montada', concepto: 'Boda — Finca El Encinar', cliente: 'Laura & Marcos', empresa: false, tipoEvento: 'boda', fechaEvento: '2026-06-14', baseImponible: 2400, porcentajeIVA: 21, importeIVA: 504, total: 2904, metodoPago: 'transferencia', estadoPago: 'parcial', pagosRecibidos: 1200, facturaEmitida: true, createdAt: '2026-04-01T10:00:00Z' },
  { id: 'fx-i2', area: 'dj', concepto: 'Sesión privada — cumpleaños 40', cliente: 'Andrea Ruiz', empresa: false, tipoEvento: 'privado', fechaEvento: '2026-05-02', baseImponible: 600, porcentajeIVA: 21, importeIVA: 126, total: 726, metodoPago: 'bizum', estadoPago: 'pagado', pagosRecibidos: 726, facturaEmitida: true, createdAt: '2026-03-10T10:00:00Z' },
  { id: 'fx-i3', area: 'montada', concepto: 'Comunión — Salón Jardín Azul', cliente: 'Familia Torres', empresa: false, tipoEvento: 'comunion', fechaEvento: '2026-05-20', baseImponible: 900, porcentajeIVA: 21, importeIVA: 189, total: 1089, metodoPago: 'transferencia', estadoPago: 'pendiente', pagosRecibidos: 0, facturaEmitida: false, createdAt: '2026-03-20T10:00:00Z' },
  { id: 'fx-i4', area: 'dj', concepto: 'Evento corporativo — Real Madrid Fundación', cliente: 'Real Madrid Fundación', empresa: true, lineaNegocio: 'Real Madrid', tipoEvento: 'corporativo', fechaEvento: '2026-04-18', baseImponible: 3200, porcentajeIVA: 21, importeIVA: 672, total: 3872, metodoPago: 'transferencia', estadoPago: 'pagado', pagosRecibidos: 3872, facturaEmitida: true, createdAt: '2026-02-15T10:00:00Z' },
];

export const fixtureGastos: Gasto[] = [
  { id: 'fx-g1', area: 'montada', fecha: '2026-03-05', concepto: 'Alquiler almacén', categoria: 'Material', tipo: 'fijo', baseImponible: 350, porcentajeIVA: 21, importeIVA: 73.5, total: 423.5, metodoPago: 'transferencia', facturaRecibida: true, deducible: true, createdAt: '2026-03-05T10:00:00Z' } as Gasto,
  { id: 'fx-g2', area: 'dj', fecha: '2026-04-01', concepto: 'Auriculares monitorización', categoria: 'Equipo', tipo: 'variable', baseImponible: 180, porcentajeIVA: 21, importeIVA: 37.8, total: 217.8, metodoPago: 'tarjeta', facturaRecibida: true, deducible: true, createdAt: '2026-04-01T10:00:00Z' } as Gasto,
];

export const fixtureClientes: Cliente[] = [
  { id: 'fx-c1', nombre: 'Laura & Marcos', esEmpresa: false, email: 'laura.marcos@example.com', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'fx-c2', nombre: 'Real Madrid Fundación', nifCif: 'G00000000', direccion: 'Paseo de la Castellana, Madrid', esEmpresa: true, createdAt: '2026-01-01T00:00:00Z' },
];

export const fixtureFacturas: Factura[] = [
  { id: 'fx-f1', area: 'montada', tipo: 'emitida', numero: '77', cliente: 'Laura & Marcos', concepto: 'Boda — Finca El Encinar', baseImponible: 1200, porcentajeIVA: 21, importeIVA: 252, total: 1452, fecha: '2026-04-02', pagada: false, ivaDeducible: false, ingresoId: 'fx-i1', estado: 'emitida', porcentajeFacturado: 50, numeroSecuencial: 77 },
  { id: 'fx-f2', area: 'dj', tipo: 'emitida', numero: '76', cliente: 'Andrea Ruiz', concepto: 'Sesión privada', baseImponible: 600, porcentajeIVA: 21, importeIVA: 126, total: 726, fecha: '2026-03-11', pagada: true, ivaDeducible: false, ingresoId: 'fx-i2', estado: 'cobrada', porcentajeFacturado: 100, numeroSecuencial: 76 },
  { id: 'fx-f3', area: 'montada', tipo: 'emitida', numero: '', cliente: 'Familia Torres', concepto: 'Comunión — anticipo', baseImponible: 0, porcentajeIVA: 21, importeIVA: 0, total: 0, fecha: '2026-04-10', pagada: false, ivaDeducible: false, ingresoId: 'fx-i3', estado: 'borrador', porcentajeFacturado: 0 },
];

export const fixtureEmisores: ConfiguracionFiscal[] = [
  {
    id: 'default', nombreInterno: 'La Montada Sound SL', activo: true,
    razonSocial: '[Ejemplo] La Montada Sound S.L.', nifCif: 'B00000000',
    direccionFiscal: 'Calle Ejemplo 1, Madrid', email: 'facturacion@ejemplo.com',
    iban: 'ES00 0000 0000 0000 0000 0000', numeracionConfirmada: true, numeroInicial: 78,
  },
  {
    id: 'fx-emisor-dj', nombreInterno: 'Julia Centeno (autónoma, DJ)', activo: true,
    razonSocial: 'Julia Centeno Díaz-Jiménez', nifCif: '00000000X',
    direccionFiscal: 'Calle Ejemplo 2, Madrid', email: 'dj@ejemplo.com',
    iban: 'ES00 1111 1111 1111 1111 1111', numeracionConfirmada: false,
  },
];

export const fixtureProyectoEmisorMap: Record<string, string> = {
  montada_sound: 'default', real_madrid: 'default', dj: 'fx-emisor-dj', montada_installations: 'default',
};

export const fixtureEventos: Evento[] = [];
