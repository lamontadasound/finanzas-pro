// ── Almacén local de archivos adjuntos (IndexedDB) ──────────────────────────
// Antes, "Adjuntar factura" fingía guardar el archivo: creaba un Documento
// con `url:''` y una `storageKey` que no apuntaba a nada real — al recargar,
// el archivo original ya no existía en ningún sitio aunque la UI lo
// mostrara como adjuntado. Esto está prohibido explícitamente ("no
// presentes un archivo local temporal como guardado definitivamente").
//
// Mientras no exista el backend de Drive, el archivo se guarda de verdad en
// IndexedDB de ESTE navegador — sobrevive a recargas y cierres de pestaña,
// aunque (a diferencia de Drive) no se sincroniza entre dispositivos ni
// usuarios. La UI debe dejar esto explícito, nunca presentarlo como
// "guardado en la nube" hasta que la sincronización real exista.
const DB_NAME = 'finanzas-local-files';
const STORE = 'archivos';
const VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function guardarArchivoLocal(id: string, file: File): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ blob: file, nombre: file.name, tipo: file.type, guardadoEn: new Date().toISOString() }, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function leerArchivoLocal(id: string): Promise<{ blob: Blob; nombre: string; tipo: string } | null> {
  const db = await openDb();
  const result = await new Promise<{ blob: Blob; nombre: string; tipo: string } | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

export async function borrarArchivoLocal(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
