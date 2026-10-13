import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {DriveInvoiceArchive} from './DriveInvoiceArchive';
const state=vi.hoisted(()=>({error:false,admin:true,invoke:vi.fn()}));
vi.mock('../ui/Modal',()=>({Modal:()=>null}));
vi.mock('../../store/useAuthStore',()=>({useAuthStore:(s:(v:unknown)=>unknown)=>s({isAdmin:()=>state.admin})}));
vi.mock('../../lib/supabase',()=>({supabase:{functions:{invoke:state.invoke},from:(table:string)=>{
 const result={error:state.error?new Error('offline'):null,data:table==='drive_invoice_files'?[{id:'f',nombre:'Factura 80 - Ejemplo',tipo:'emitida',anio:2026,mes:9,numero:80,url:'https://drive.google.com/file/d/f/view'}]:[{id:'m',nombre:'Septiembre',tipo:'emitida',anio:2026,mes:9}]};
 const chain={select:()=>chain,eq:()=>chain,order:()=>chain,then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(result).then(resolve)};return chain;
}}}));
afterEach(cleanup);beforeEach(()=>{state.error=false;state.admin=true;vi.clearAllMocks();});
describe('Carpetas de facturas de Drive',()=>{
 it('abre el mes original y el enlace al documento',async()=>{render(<DriveInvoiceArchive tipo="emitida"/>);fireEvent.click(await screen.findByRole('button',{name:/Septiembre 2026/}));expect(screen.getByRole('link',{name:/Factura 80/}).getAttribute('href')).toBe('https://drive.google.com/file/d/f/view');});
 it('muestra un fallo de carga',async()=>{state.error=true;render(<DriveInvoiceArchive tipo="emitida"/>);expect((await screen.findByRole('alert')).textContent).toContain('No se pudo cargar');});
 it('no permite sincronizar a usuarios sin permiso de administrador',async()=>{state.admin=false;render(<DriveInvoiceArchive tipo="emitida"/>);await screen.findByRole('button',{name:/Septiembre 2026/});expect(screen.queryByRole('button',{name:'Actualizar desde Drive'})).toBeNull();});
});
