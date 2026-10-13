import {describe,it,expect} from 'vitest';
import {joinDriveExpenses,driveExpenseTotals,type DriveExpenseFile,type DriveExpenseAmount} from './driveExpenses';
const f:DriveExpenseFile={id:'a',nombre:'Factura',anio:2026,mes:9,url:'https://drive.google.com/file/d/a/view',actualizado_en:'2026-09-20T00:00:00Z',sincronizado_en:'2026-09-20T00:00:00Z'};
const a:DriveExpenseAmount={file_id:'a',source_modified_at:f.actualizado_en,estado:'leido',proveedor:'B123',numero_factura:'26/1',fecha_factura:'2026-09-01',base:100,iva:21,total:106,retencion:15,nota:''};
describe('Estimación exclusivamente documental de Drive',()=>{
 it('un archivo sin importes queda pendiente, no se considera gasto cero',()=>{const rows=joinDriveExpenses([f],[]);expect(driveExpenseTotals(rows)).toEqual({base:0,iva:0,total:0,leidos:0,pendientes:1,excluidos:0});});
 it('admite retenciones sin restarlas al gasto sin IVA',()=>{expect(driveExpenseTotals(joinDriveExpenses([f],[a]))).toMatchObject({base:100,iva:21,total:106,leidos:1});});
 it('invalida importes al cambiar el documento y acepta zonas horarias equivalentes',()=>{expect(joinDriveExpenses([f],[{...a,source_modified_at:'2026-09-19T00:00:00Z'}])[0].estado).toBe('pendiente');expect(joinDriveExpenses([f],[{...a,source_modified_at:'2026-09-20 00:00:00+00'}])[0].estado).toBe('leido');});
 it('no suma copias del mismo proveedor y número ni documentos fuera de Drive',()=>{const rows=joinDriveExpenses([f,{...f,id:'b'}],[a,{...a,file_id:'b'},{...a,file_id:'deleted',base:999}]);expect(driveExpenseTotals(rows)).toMatchObject({base:100,leidos:1,excluidos:1});});
 it('deja las versiones contradictorias pendientes sin elegir una al azar',()=>{const rows=joinDriveExpenses([f,{...f,id:'b'}],[a,{...a,file_id:'b',base:200,iva:42,total:227}]);expect(driveExpenseTotals(rows)).toMatchObject({base:0,leidos:0,pendientes:2});});
 it('ignora importes que no cuadran y conserva abonos negativos',()=>{expect(joinDriveExpenses([f],[{...a,total:999}])[0].estado).toBe('pendiente');expect(driveExpenseTotals(joinDriveExpenses([f],[{...a,base:-100,iva:-21,total:-121,retencion:0}])).base).toBe(-100);});
});
