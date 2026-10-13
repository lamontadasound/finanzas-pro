// ── Pruebas del cliente REAL de Google Drive — con `fetch` SIMULADO ────────
// No llama a Google en ningún caso — todas las respuestas de la API vienen
// de mocks en este archivo. Prueba que el CÓDIGO que hablará con Drive de
// verdad construye las peticiones correctamente e interpreta bien éxito,
// error y ausencia de resultado. La conexión real (cuenta de servicio
// autorizada de verdad) sigue sin probarse — no puede probarse sin
// credenciales reales, y no se finge que sí.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { firmarJwtCuentaServicio, obtenerAccessToken, buscarPorAppProperty, subirArchivo } from './googleDrive';

// Par de claves RSA de PRUEBA generado aquí mismo — nunca una credencial
// real. Solo sirve para ejercitar la ruta de firmado, no para hablar con
// Google (el endpoint de token está mockeado más abajo).
async function generarServiceAccountDePrueba() {
  const par = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['sign', 'verify'],
  );
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', par.privateKey);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(pkcs8)));
  const pem = `-----BEGIN PRIVATE KEY-----\n${b64.match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----`;
  return { sa: { client_email: 'prueba@ejemplo.iam.gserviceaccount.com', private_key: pem }, publicKey: par.publicKey };
}

describe('firmarJwtCuentaServicio — estructura del JWT firmado', () => {
  it('produce un JWT de 3 segmentos con el header y las claims correctas, verificable con la clave pública', async () => {
    const { sa, publicKey } = await generarServiceAccountDePrueba();
    const jwt = await firmarJwtCuentaServicio(sa, 'https://www.googleapis.com/auth/drive.file', 1000);
    const partes = jwt.split('.');
    expect(partes).toHaveLength(3);

    const header = JSON.parse(atob(partes[0].replace(/-/g, '+').replace(/_/g, '/')));
    expect(header).toEqual({ alg: 'RS256', typ: 'JWT' });

    const claims = JSON.parse(atob(partes[1].replace(/-/g, '+').replace(/_/g, '/')));
    expect(claims.iss).toBe(sa.client_email);
    expect(claims.scope).toBe('https://www.googleapis.com/auth/drive.file');
    expect(claims.exp - claims.iat).toBe(3600);

    // Verificación criptográfica real de la firma — no solo estructural.
    const datosFirmados = new TextEncoder().encode(`${partes[0]}.${partes[1]}`);
    const firma = Uint8Array.from(atob(partes[2].replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    const valido = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, firma, datosFirmados);
    expect(valido).toBe(true);
  });
});

describe('obtenerAccessToken — intercambio del JWT por un access_token', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });

  it('devuelve el access_token cuando Google responde 200', async () => {
    const { sa } = await generarServiceAccountDePrueba();
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ access_token: 'token-simulado-123' }) } as never);
    const token = await obtenerAccessToken(sa);
    expect(token).toBe('token-simulado-123');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('oauth2.googleapis.com'), expect.objectContaining({ method: 'POST' }));
  });

  it('lanza un error claro si Google responde con error (p. ej. cuenta no autorizada todavía)', async () => {
    const { sa } = await generarServiceAccountDePrueba();
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 401, text: async () => 'invalid_grant' } as never);
    await expect(obtenerAccessToken(sa)).rejects.toThrow(/401/);
  });
});

describe('buscarPorAppProperty — idempotencia y detección de duplicados', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });

  it('devuelve el archivo si Drive encuentra una coincidencia', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true, json: async () => ({ files: [{ id: 'gdrive-1', webViewLink: 'https://drive.google.com/x' }] }),
    } as never);
    const r = await buscarPorAppProperty('token', 'carpeta-1', 'facturaId', 'f1');
    expect(r).toEqual({ fileId: 'gdrive-1', folderId: 'carpeta-1', link: 'https://drive.google.com/x' });
  });

  it('devuelve null (nunca inventa un resultado) si Drive no encuentra nada', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ files: [] }) } as never);
    const r = await buscarPorAppProperty('token', 'carpeta-1', 'facturaId', 'f-inexistente');
    expect(r).toBeNull();
  });

  it('lanza si la API de Drive responde con error', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500, text: async () => 'server error' } as never);
    await expect(buscarPorAppProperty('token', 'carpeta-1', 'facturaId', 'f1')).rejects.toThrow(/500/);
  });
});

describe('subirArchivo — subida real, error y "nunca resultado parcial"', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });

  it('sube correctamente y devuelve fileId/folderId/link', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true, json: async () => ({ id: 'gdrive-nuevo', webViewLink: 'https://drive.google.com/nuevo' }),
    } as never);
    const r = await subirArchivo('token', {
      carpetaId: 'carpeta-1', nombreArchivo: 'factura-77.pdf', mimeType: 'application/pdf',
      contenidoBase64: 'JVBERi0xLjQK', facturaId: 'f1', contenidoHash: 'hash-abc',
    });
    expect(r.fileId).toBe('gdrive-nuevo');
    // Confirma que se envían los appProperties (facturaId/contenidoHash) —
    // así `buscarPorAppProperty` puede encontrarlo después.
    const [, opciones] = vi.mocked(fetch).mock.calls[0];
    expect(await (opciones?.body as Blob).text()).toContain('"facturaId":"f1"');
    expect(await (opciones?.body as Blob).text()).toContain('"contenidoHash":"hash-abc"');
  });

  it('lanza (nunca devuelve un resultado parcial) si Drive rechaza la subida', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 403, text: async () => 'insufficient permissions' } as never);
    await expect(subirArchivo('token', {
      carpetaId: 'c', nombreArchivo: 'x.pdf', mimeType: 'application/pdf',
      contenidoBase64: 'AA==', facturaId: 'f2', contenidoHash: 'h2',
    })).rejects.toThrow(/403/);
  });

  it('un fallo de red (fetch rechaza) también se propaga, nunca se traga en silencio', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'));
    await expect(subirArchivo('token', {
      carpetaId: 'c', nombreArchivo: 'x.pdf', mimeType: 'application/pdf',
      contenidoBase64: 'AA==', facturaId: 'f3', contenidoHash: 'h3',
    })).rejects.toThrow(/network error/);
  });
});
