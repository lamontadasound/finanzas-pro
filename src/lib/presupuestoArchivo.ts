import { supabase } from './supabase';
import { generarPresupuestoPdf } from './presupuestoPdf';
import { referenciaPresupuesto, type Presupuesto } from './presupuestos';
export const rutaPresupuestoPdf = (p: Presupuesto) => `${p.linea_negocio}/${p.id}/corporativo-foto-limpia/r${p.revision}.pdf`;
export async function prepararArchivoPresupuesto(p: Presupuesto, puedeArchivar: boolean): Promise<{ blob: Blob; archivado: boolean }> {
  const storage = supabase.storage.from('presupuestos');
  const path = rutaPresupuestoPdf(p);
  const existing = await storage.download(path);
  if (existing.data) return { blob: existing.data, archivado: true };
  const response = await fetch('/brand/la-montada-marron.png');
  if (!response.ok) throw new Error('No se pudo cargar el logo oficial. Inténtalo de nuevo.');
  const logo = new Uint8Array(await response.arrayBuffer());
  const blob = generarPresupuestoPdf(p, logo).output('blob');
  if (!puedeArchivar) return { blob, archivado: false };
  const result = await storage.upload(path, blob, { contentType: 'application/pdf', upsert: false });
  if (result.error) {
    // Another session may have archived this exact revision while we generated it.
    const retry = await storage.download(path);
    if (retry.data) return { blob: retry.data, archivado: true };
    throw new Error('El presupuesto está guardado, pero no se pudo archivar su PDF. Reintenta la descarga.');
  }
  return { blob, archivado: true };
}
export function descargarArchivoPresupuesto(blob: Blob, p: Presupuesto) {
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`${referenciaPresupuesto(p)}.pdf`;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
