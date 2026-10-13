import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prepararArchivoPresupuesto, rutaPresupuestoPdf } from './presupuestoArchivo';
import { nuevoPresupuesto, type Presupuesto } from './presupuestos';
const storage=vi.hoisted(()=>({download:vi.fn(),upload:vi.fn()}));
vi.mock('./supabase',()=>({supabase:{storage:{from:()=>storage}}}));
vi.mock('./presupuestoPdf',()=>({generarPresupuestoPdf:()=>({output:()=>new Blob(['generated'])})}));
afterEach(()=>vi.unstubAllGlobals());
const p:Presupuesto={id:'q',numero:1,linea_negocio:'dj',revision:2,contenido:nuevoPresupuesto()};
beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,arrayBuffer:async()=>new ArrayBuffer(2)}));});
describe('Archivo de PDF',()=>{
 it('recupera los bytes archivados sin regenerarlos',async()=>{
  const blob=new Blob(['original']);storage.download.mockResolvedValue({data:blob});
  expect(await prepararArchivoPresupuesto(p,true)).toEqual({blob,archivado:true});
  expect(storage.download).toHaveBeenCalledWith('dj/q/corporativo-foto-limpia/r2.pdf');expect(storage.upload).not.toHaveBeenCalled();
 });
 it('archiva una versión nueva sin sobrescribir las anteriores',async()=>{
  storage.download.mockResolvedValue({data:null});storage.upload.mockResolvedValue({error:null});
  expect((await prepararArchivoPresupuesto(p,true)).archivado).toBe(true);
  expect(storage.upload).toHaveBeenCalledWith(rutaPresupuestoPdf(p),expect.any(Blob),{contentType:'application/pdf',upsert:false});
 });
 it('no anuncia un archivo guardado si falla la subida',async()=>{
  storage.download.mockResolvedValue({data:null});storage.upload.mockResolvedValue({error:{message:'offline'}});
  await expect(prepararArchivoPresupuesto(p,true)).rejects.toThrow('no se pudo archivar');
 });
 it('un lector puede descargar sin escribir en el archivo',async()=>{
  storage.download.mockResolvedValue({data:null});expect((await prepararArchivoPresupuesto(p,false)).archivado).toBe(false);expect(storage.upload).not.toHaveBeenCalled();
 });
});
