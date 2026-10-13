// ── Backend de sincronización con Google Drive — PREPARADO, NO CONECTADO ───
// Define el contrato real que usará la sincronización cuando se autorice la
// cuenta de Drive (paso manual pendiente, explícitamente no realizado). El
// transporte real (llamada a una Edge Function con las credenciales server-
// side) se inyecta como dependencia (`DriveTransport`) — así el módulo entero
// se puede probar de verdad, con un transporte simulado, sin tocar Drive ni
// exponer ningún secreto en el frontend.
//
// Reglas que debe cumplir CUALQUIER transporte real que se conecte aquí más
// adelante (documentadas y ya verificadas contra el simulador):
//  - Si la subida falla, la factura NUNCA se marca como sincronizada.
//  - Un reintento sobre la MISMA factura nunca sube el archivo dos veces ni
//    genera un segundo `driveFileId` — es idempotente por `facturaId`.
//  - Un archivo que ya coincide con uno existente (mismo hash de contenido)
//    en la carpeta de destino se marca como posible duplicado, NUNCA se
//    sube silenciosamente una copia.
import type { Factura } from '../types';

export interface DriveUploadResult {
  fileId: string;
  folderId: string;
  link: string;
  duplicadoDe?: string; // fileId de un archivo ya existente con el mismo contenido, si se detecta
}

/** Contrato mínimo que un transporte real (Edge Function → API de Drive) debe implementar. */
export interface DriveTransport {
  /** Sube un archivo y devuelve dónde quedó. Debe lanzar si falla — nunca devolver un resultado parcial. */
  upload(args: {
    facturaId: string; nombreArchivo: string; contenidoHash: string; carpetaId: string;
    /** Contenido real del archivo en base64 y su tipo MIME — sin esto, el transporte real rechaza la subida (nunca sube "aire"). */
    contenidoBase64: string; mimeType: string;
  }): Promise<DriveUploadResult>;
  /** Busca un archivo ya subido para esta factura (para idempotencia ante reintento). */
  buscarExistente(facturaId: string): Promise<DriveUploadResult | null>;
  /** Busca si ya existe un archivo con el mismo hash de contenido en la carpeta (detección de duplicados). */
  buscarPorHash(contenidoHash: string, carpetaId: string): Promise<DriveUploadResult | null>;
}

export interface DriveSyncResult {
  ok: boolean;
  resultado?: DriveUploadResult;
  error?: string;
  reintentable: boolean;
}

/**
 * Sincroniza UNA factura con Drive a través del transporte dado. Nunca
 * marca nada como sincronizado si la subida falla — y nunca sube dos veces
 * el mismo archivo ante un reintento (comprueba primero si ya existe).
 */
export async function sincronizarFacturaConDrive(
  factura: Pick<Factura, 'id' | 'driveNombreArchivo'>,
  contenidoHash: string,
  carpetaId: string,
  transport: DriveTransport,
  /** Contenido real del archivo — opcional solo para no romper llamadas de prueba que no suben nada de verdad; el transporte real debe rechazar la subida si falta. */
  contenido?: { base64: string; mimeType: string },
): Promise<DriveSyncResult> {
  try {
    // 1) Idempotencia por factura — si ya se subió (aunque la respuesta de
    // aquel intento se perdiera), no se vuelve a subir el archivo.
    const existente = await transport.buscarExistente(factura.id);
    if (existente) return { ok: true, resultado: existente, reintentable: false };

    // 2) Prevención de duplicados por contenido — si ya hay un archivo con
    // el mismo hash en la carpeta (p.ej. la misma factura adjuntada dos
    // veces por error, o subida ya por otro usuario), se marca como tal en
    // vez de crear una copia silenciosa.
    const porHash = await transport.buscarPorHash(contenidoHash, carpetaId);
    if (porHash) {
      return { ok: true, resultado: { ...porHash, duplicadoDe: porHash.fileId }, reintentable: false };
    }

    // 3) Subida real.
    const resultado = await transport.upload({
      facturaId: factura.id,
      nombreArchivo: factura.driveNombreArchivo ?? `factura-${factura.id}`,
      contenidoHash, carpetaId,
      contenidoBase64: contenido?.base64 ?? '', mimeType: contenido?.mimeType ?? 'application/octet-stream',
    });
    return { ok: true, resultado, reintentable: false };
  } catch (e) {
    // Cualquier fallo de red/API se considera reintentable por defecto —
    // nunca se marca la factura como sincronizada ni se descarta el intento.
    return { ok: false, error: e instanceof Error ? e.message : 'Error desconocido al sincronizar con Drive.', reintentable: true };
  }
}
