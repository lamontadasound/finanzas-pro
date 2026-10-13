import {it,expect,vi} from 'vitest';
import {syncInvoice} from './invoiceSync';
import type {Factura} from '../types';
const mock=vi.hoisted(()=>({invoke:vi.fn(),get:vi.fn()}));
vi.mock('./supabase',()=>({supabase:{functions:{invoke:mock.invoke}}}));
vi.mock('./db',()=>({db:{facturas:{getById:mock.get}}}));
vi.mock('./facturaPdf',()=>({generarFacturaPdf:()=>({output:()=>({type:'application/pdf',arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer})})}));
it('actualiza la carpeta mensual y reintenta una sola subida de la misma factura',async()=>{mock.invoke.mockResolvedValueOnce({error:{context:new Response(JSON.stringify({error:'No se encuentra la carpeta mensual de Drive.'}),{status:409})}}).mockResolvedValueOnce({data:{ok:true}}).mockResolvedValueOnce({data:{fileId:'file'}});mock.get.mockResolvedValue({id:'test',driveFileId:'file'});const result=await syncInvoice({id:'test',tipo:'emitida',numeroSecuencial:85,emisorSnapshot:{},clienteSnapshot:{},cliente:'Test'} as Factura);expect(mock.invoke.mock.calls.map(c=>c[0])).toEqual(['drive-sync','drive-invoice-archive','drive-sync']);expect(mock.invoke.mock.calls[0][1]).toEqual(mock.invoke.mock.calls[2][1]);expect(result.driveFileId).toBe('file');});
