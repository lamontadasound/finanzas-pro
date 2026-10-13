// ── Transporte de Drive REAL — llama a la Edge Function, nunca a Drive ──────
// directamente desde el navegador. Implementa el mismo contrato
// `DriveTransport` que `driveSync.simulado.ts`, así que es un sustituto
// directo: una vez la cuenta de Drive esté autorizada y la Edge Function
// desplegada, este es el único cambio necesario en la UI (ninguno — ya está
// conectado, ver `SincronizarDriveButton.tsx`).
//
// Ahora mismo la Edge Function `drive-sync` NO está desplegada (preparada en
// supabase/functions/drive-sync/) — cada llamada falla con un error claro
// ("no configurado todavía"), nunca con un resultado simulado. Así, en la
// app real, sincronizar SIEMPRE falla honestamente hasta la autorización —
// jamás marca una factura real como sincronizada con datos ficticios.
import { supabase } from './supabase';
import type { DriveTransport, DriveUploadResult } from './driveSync';

async function invocar<T>(accion: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('drive-sync', { body: { accion, ...body } });
  if (error) throw new Error(`Drive (${accion}): ${error.message}`);
  return data as T;
}

export const driveTransportReal: DriveTransport = {
  async buscarExistente(facturaId) {
    return invocar<DriveUploadResult | null>('buscar_existente', { facturaId });
  },
  async buscarPorHash(contenidoHash, carpetaId) {
    return invocar<DriveUploadResult | null>('buscar_por_hash', { contenidoHash, carpetaId });
  },
  async upload({ facturaId, nombreArchivo, contenidoHash, carpetaId, contenidoBase64, mimeType }) {
    return invocar<DriveUploadResult>('upload', { facturaId, nombreArchivo, contenidoHash, carpetaId, contenidoBase64, mimeType });
  },
};
