import {describe,it,expect,vi} from 'vitest';
import {db} from './db';import type {GastoEvento} from '../types';
const saved=vi.hoisted(()=>({row:{} as Record<string,unknown>,table:''}));
vi.mock('./supabase',()=>({supabase:{from:(table:string)=>{saved.table=table;return {insert:async(row:Record<string,unknown>)=>{saved.row=row;return {error:null};},select:()=>({eq:()=>({single:async()=>({data:saved.row,error:null})})})};}}}));
vi.mock('../store/useAuthStore',()=>({useAuthStore:{getState:()=>({})}}));
describe('Persistencia real del mapper de gastos',()=>{
 it('envía el ingreso, categoría y método y los recupera tras recargar',async()=>{
 const expense:GastoEvento={id:'test',ingresoId:'evento-1',area:'montada',fecha:'2026-09-12',concepto:'Jorge',categoria:'Técnico',importe:350,pagadoPor:'La Montada',estadoPago:'pagado',metodoPago:'transferencia',createdAt:'2026-09-12'};
 await db.gastosEvento.insert(expense);expect(saved.table).toBe('gastos_evento');expect(saved.row).toMatchObject({ingreso_id:'evento-1',categoria:'Técnico',importe:350,metodo_pago:'transferencia',estado_pago:'pagado'});
 expect(await db.gastosEvento.getById('test')).toMatchObject(expense);
 });
 it('conserva sin indicar un pago histórico en vez de inventar un método',async()=>{saved.row={id:'old',importe:100,categoria:'Alquiler',metodo_pago:null,estado_pago:null};const row=await db.gastosEvento.getById('old');expect(row.metodoPago).toBeUndefined();expect(row.estadoPago).toBeUndefined();});
});

it('conserva Almacén y todos los datos del gasto general al guardar y recargar',async()=>{
 const expense:import('../types').Gasto={id:'general-test',area:'montada',fecha:'2026-09-14',concepto:'Almacén',categoria:'Almacén',tipo:'variable',proveedor:'NUT',baseImponible:200.42,porcentajeIVA:21,importeIVA:42.09,total:242.51,metodoPago:'transferencia',estadoPago:'pagado',facturaRecibida:true,deducible:true,createdAt:'2026-09-14',lineaNegocio:'montada_sound',pagadoPor:'La Montada',fechaPago:'2026-09-14',numeroFactura:'TEST',recurrenciaId:'rec-test'};
 await db.gastos.insert(expense);expect(saved.table).toBe('gastos');expect(saved.row).toMatchObject({categoria:'Almacén',pagado_por:'La Montada',fecha_pago:'2026-09-14',numero_factura:'TEST',recurrencia_id:'rec-test'});expect(await db.gastos.getById(expense.id)).toMatchObject(expense);
});
