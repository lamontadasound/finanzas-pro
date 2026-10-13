// ── Pruebas del ADAPTADOR real de Drive — respuestas simuladas de la API ───
// No llama a Drive de verdad, ni a la Edge Function real (que ni siquiera
// está desplegada) — simula lo que `supabase.functions.invoke('drive-sync')`
// devolvería, para probar que EL ADAPTADOR (`driveTransportReal.ts`)
// interpreta esas respuestas correctamente: éxito, error y duplicado.
//
// Diferencia clave con `driveSync.simulado.ts` + `driveSync.test.ts`: aquello
// simula el TRANSPORTE completo en memoria del navegador (usado en el
// arnés de pruebas visuales). Esto prueba el ADAPTADOR HTTP real que
// llamará a la Edge Function cuando exista — con la Edge Function
// simulada vía mock de `supabase.functions.invoke`, nunca con datos que
// puedan llegar a marcar una factura real como sincronizada (estos mocks
// viven solo en este archivo de test, nunca se importan desde código de
// producción).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));
import { supabase } from './supabase';
import { driveTransportReal } from './driveTransportReal';

beforeEach(() => vi.mocked(supabase.functions.invoke).mockReset());

describe('driveTransportReal — subida correcta', () => {
  it('interpreta una respuesta de éxito de la Edge Function', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { fileId: 'gdrive-123', folderId: 'carpeta-x', link: 'https://drive.google.com/x' }, error: null,
    } as never);
    const r = await driveTransportReal.upload({ facturaId: 'f1', nombreArchivo: 'a.pdf', contenidoHash: 'h1', carpetaId: 'carpeta-x', contenidoBase64: 'AA==', mimeType: 'application/pdf' });
    expect(r.fileId).toBe('gdrive-123');
    expect(supabase.functions.invoke).toHaveBeenCalledWith('drive-sync', { body: expect.objectContaining({ accion: 'upload', facturaId: 'f1' }) });
  });
});

describe('driveTransportReal — error (p.ej. Drive no configurado todavía)', () => {
  it('propaga el error, nunca devuelve un resultado inventado', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null, error: { message: 'Google Drive no está configurado todavía (autorización pendiente).' },
    } as never);
    await expect(driveTransportReal.upload({ facturaId: 'f2', nombreArchivo: 'b.pdf', contenidoHash: 'h2', carpetaId: 'c', contenidoBase64: 'AA==', mimeType: 'application/pdf' }))
      .rejects.toThrow(/no está configurado/);
  });
});

describe('driveTransportReal — búsquedas (idempotencia y duplicados)', () => {
  it('buscarExistente devuelve null si la Edge Function no encuentra nada, sin inventar un resultado', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: null, error: null } as never);
    const r = await driveTransportReal.buscarExistente('f3');
    expect(r).toBeNull();
  });

  it('buscarPorHash propaga un duplicadoDe si la Edge Function lo reporta', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { fileId: 'gdrive-999', folderId: 'c', link: 'https://drive.google.com/999' }, error: null,
    } as never);
    const r = await driveTransportReal.buscarPorHash('hash-compartido', 'c');
    expect(r?.fileId).toBe('gdrive-999');
  });
});
