import {afterEach,describe,it,expect,vi} from 'vitest';
import {invoiceNumber,listChildren,readArchive} from '../../supabase/functions/drive-invoice-archive/catalog';
afterEach(()=>vi.unstubAllGlobals());
describe('Archivo Drive',()=>{
 it('distingue números fiscales de proformas y números incluidos en conceptos',()=>{
  expect(invoiceNumber('Factura 80 - Arena Negra.pdf')).toBe(80);
  expect(invoiceNumber('Factura 69 PROFORMA - Saint')).toBeNull();
  expect(invoiceNumber('Hotel 2026.pdf')).toBeNull();
  expect(invoiceNumber('Factura 9007199254740993.pdf')).toBeNull();
 });
 it('recorre todas las páginas de Drive antes de devolver el catálogo',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({files:[{id:'a'}],nextPageToken:'next'})}).mockResolvedValueOnce({ok:true,json:async()=>({files:[{id:'b'}]})});vi.stubGlobal('fetch',fetch);
  expect((await listChildren('token','root')).map(f=>f.id)).toEqual(['a','b']);expect(fetch.mock.calls[1][0]).toContain('pageToken=next');
 });
 it('no devuelve un archivo parcial si falla una lectura',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({files:[{id:'a'}],nextPageToken:'next'})}).mockResolvedValueOnce({ok:false}));
  await expect(listChildren('token','root')).rejects.toThrow('No se pudo leer');
 });
 it('respeta el mes de la carpeta y separa gastos de la numeración de ingresos',async()=>{
  const folder=(id:string,name:string)=>({id,name,mimeType:'application/vnd.google-apps.folder'});
  const tree:Record<string,unknown[]>={root:[folder('year','2026')],year:[folder('quarter','Tercer Trimestre')],quarter:[folder('month','Septiembre')],month:[{id:'income',name:'Factura 80 - Prueba',mimeType:'application/pdf',modifiedTime:'2026-08-01T00:00:00Z'},folder('expense','Gastos')],expense:[{id:'cost',name:'Factura 9999 - Proveedor',mimeType:'application/pdf'}]};
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>({ok:true,json:async()=>({files:tree[new URL(url).searchParams.get('q')!.match(/'([^']+)'/)![1]]})})));
  const result=await readArchive('token','root');expect(result.files).toHaveLength(2);
  expect(result.files[0]).toMatchObject({mes:9,numero:80,tipo:'emitida'});expect(result.files[1]).toMatchObject({mes:9,numero:null,tipo:'recibida'});
 });
});
