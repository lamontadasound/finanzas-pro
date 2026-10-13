// ── Cliente de Google Drive API v3 — lógica pura, sin Deno.serve ───────────
// Implementación REAL (no simulada) de las llamadas a Google, aislada en un
// módulo sin dependencias de Deno para poder probarla con vitest (mockeando
// `fetch`) desde el resto del proyecto. `index.ts` (la Edge Function) solo
// envuelve estas funciones con Deno.serve + lectura de variables de entorno.
//
// Flujo de autenticación: cuenta de servicio de Google (JWT Bearer, RFC
// 7523) — se firma un JWT con la clave privada de la cuenta de servicio y
// se intercambia por un access_token en el endpoint OAuth2 de Google. Nunca
// se usa una API key ni credenciales de usuario — la cuenta de servicio
// debe tener la carpeta de Drive compartida con su email (o Domain-Wide
// Delegation), paso de autorización manual explícitamente NO realizado en
// esta fase.
export interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

export interface DriveUploadResult {
  fileId: string;
  folderId: string;
  link: string;
  duplicadoDe?: string;
}

const TOKEN_URI_DEFAULT = 'https://oauth2.googleapis.com/token';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

// ── Base64URL sin relleno (RFC 7515) ────────────────────────────────────────
function base64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** Construye y firma el JWT de la cuenta de servicio (RS256) — RFC 7523. */
export async function firmarJwtCuentaServicio(sa: ServiceAccount, scope = DRIVE_SCOPE, ahoraSec = Math.floor(Date.now() / 1000)): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    scope,
    aud: sa.token_uri ?? TOKEN_URI_DEFAULT,
    iat: ahoraSec,
    exp: ahoraSec + 3600,
  };
  const encabezadoYReclamaciones = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;

  const key = await crypto.subtle.importKey(
    'pkcs8', pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
  const firma = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(encabezadoYReclamaciones));
  return `${encabezadoYReclamaciones}.${base64url(firma)}`;
}

/** Intercambia el JWT firmado por un access_token de Google OAuth2. */
export async function obtenerAccessToken(sa: ServiceAccount, scope = DRIVE_SCOPE): Promise<string> {
  const jwt = await firmarJwtCuentaServicio(sa, scope);
  const res = await fetch(sa.token_uri ?? TOKEN_URI_DEFAULT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  if (!res.ok) {
    const texto = await res.text().catch(() => '');
    throw new Error(`No se pudo obtener el token de Google (HTTP ${res.status}): ${texto}`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error('Respuesta de Google sin access_token.');
  return data.access_token as string;
}

/**
 * Busca un archivo dentro de `carpetaId` cuya propiedad personalizada
 * `appProperties[clave]` valga `valor` — usado tanto para idempotencia por
 * factura (clave='facturaId') como para detección de duplicados por
 * contenido (clave='contenidoHash'). Nunca lanza si no encuentra nada:
 * devuelve `null`.
 */
export async function buscarPorAppProperty(accessToken: string, carpetaId: string, clave: string, valor: string): Promise<DriveUploadResult | null> {
  const q = `'${carpetaId}' in parents and appProperties has { key='${clave}' and value='${valor.replace(/'/g, "\\'")}' } and trashed = false`;
  const url = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,parents,webViewLink)&pageSize=1`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const texto = await res.text().catch(() => '');
    throw new Error(`Error buscando en Drive (HTTP ${res.status}): ${texto}`);
  }
  const data = await res.json();
  const archivo = data.files?.[0];
  if (!archivo) return null;
  return { fileId: archivo.id, folderId: carpetaId, link: archivo.webViewLink ?? `https://drive.google.com/file/d/${archivo.id}/view` };
}

/**
 * Sube un archivo a Drive (multipart: metadata JSON + contenido binario),
 * guardando `facturaId` y `contenidoHash` como `appProperties` — así
 * `buscarPorAppProperty` puede encontrarlo después para idempotencia y
 * detección de duplicados, sin depender de ninguna base de datos aparte.
 * Nunca devuelve un resultado parcial: si la API de Drive responde con
 * error, lanza — el llamador (`sincronizarFacturaConDrive`) ya trata
 * cualquier excepción como reintentable, sin marcar nada como sincronizado.
 */
export async function subirArchivo(accessToken: string, args: {
  carpetaId: string; nombreArchivo: string; mimeType: string;
  contenidoBase64: string; facturaId: string; contenidoHash: string; fileId?:string;
}): Promise<DriveUploadResult> {
  const metadata = {
    ...(args.fileId ? {id:args.fileId}:{}),
    name: args.nombreArchivo,
    parents: [args.carpetaId],
    appProperties: { facturaId: args.facturaId, contenidoHash: args.contenidoHash },
  };
  const boundary = `mi-espacio-${crypto.randomUUID()}`;
  const bytes=Uint8Array.from(atob(args.contenidoBase64),c=>c.charCodeAt(0));
  const cuerpo = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: ${args.mimeType}\r\n\r\n`, bytes, `\r\n--${boundary}--`,
  ]);

  const res = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,parents,webViewLink&supportsAllDrives=true`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: cuerpo,
  });
  if (res.status===409 && args.fileId) {
    const existing=await archivoPorId(accessToken,args.fileId);
    if(existing?.appProperties?.facturaId===args.facturaId && existing?.appProperties?.contenidoHash===args.contenidoHash && existing.parents?.includes(args.carpetaId)) return {fileId:args.fileId,folderId:args.carpetaId,link:`https://drive.google.com/file/d/${args.fileId}/view`};
  }
  if (!res.ok) {
    const texto = await res.text().catch(() => '');
    throw new Error(`No se pudo subir el archivo a Drive (HTTP ${res.status}): ${texto}`);
  }
  const data = await res.json();
  return { fileId: data.id, folderId: args.carpetaId, link: data.webViewLink ?? `https://drive.google.com/file/d/${data.id}/view` };
}

/** OAuth offline consent for a personal Drive; refresh token exists only in server secrets. */
export async function obtenerTokenOAuth(clientId:string,clientSecret:string,refreshToken:string):Promise<string>{
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refreshToken,grant_type:'refresh_token'})});
 if(!response.ok)throw new Error('No se pudo renovar el acceso a Google Drive. Revisa la autorización.');
 const data=await response.json();if(typeof data.access_token!=='string')throw new Error('Respuesta OAuth inválida.');return data.access_token;
}
export async function generarFileId(token:string):Promise<string>{
 const response=await fetch('https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=drive&type=files',{headers:{Authorization:`Bearer ${token}`}});
 if(!response.ok)throw new Error('No se pudo reservar un identificador en Drive.');
 const data=await response.json();if(!data.ids?.[0])throw new Error('Drive no devolvió un identificador.');return data.ids[0];
}
export async function archivoPorId(token:string,id:string):Promise<{id:string;appProperties?:Record<string,string>;parents?:string[]}|null>{
 const response=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,parents,appProperties&supportsAllDrives=true`,{headers:{Authorization:`Bearer ${token}`}});
 if(response.status===404)return null;
 if(!response.ok)throw new Error('No se pudo comprobar el archivo de Drive.');return response.json();
}
