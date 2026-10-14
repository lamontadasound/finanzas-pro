import {describe,it,expect} from 'vitest';
import type {Factura} from '../types';
import {driveAccounting,accountingTotals,type AccountingFile} from './driveAccounting';
const file:AccountingFile={id:'drive-a',nombre:'Factura 1',numero:1,tipo:'emitida',anio:2026,mes:10,url:'https://drive.google.com/file/d/drive-a',actualizado_en:null,sincronizado_en:'2026-10-14'};
const invoice={id:'app-a',driveFileId:'drive-a',tipo:'emitida',estado:'emitida',baseImponible:100,importeIVA:21} as unknown as Factura;
describe('Resumen exclusivo del archivo Drive',()=>{
 it('excluye facturas de app sin documento en Drive y no empareja por número',()=>{
  expect(driveAccounting([],[],[invoice])).toEqual([]);
  expect(accountingTotals(driveAccounting([file],[],[{...invoice,driveFileId:undefined,numero:'1'}])).pending).toBe(1);
 });
 it('calcula bases, totales, resultado e IVA con gastos documentados',()=>{
  const expense={...file,id:'expense',tipo:'recibida' as const};
  const rows=driveAccounting([file,expense],[{file_id:'expense',source_modified_at:null,estado:'leido',proveedor:'Proveedor',numero_factura:'X',fecha_factura:null,base:50,iva:10.5,total:60.5,retencion:0,nota:''}],[invoice]);
  expect(accountingTotals(rows)).toEqual({income:100,outputVat:21,incomeTotal:121,expenses:50,inputVat:10.5,expenseTotal:60.5,result:50,vat:10.5,pending:0});
 });
 it('no inventa importes para documentos desconocidos y admite abonos',()=>{
  const rows=driveAccounting([file,{...file,id:'unknown'}],[],[{...invoice,baseImponible:-100,importeIVA:-21}]);
  expect(accountingTotals(rows)).toMatchObject({income:-100,incomeTotal:-121,pending:1});
 });
 it('no cuenta anuladas ni asociaciones ambiguas',()=>{
  expect(accountingTotals(driveAccounting([file],[],[{...invoice,estado:'anulada'}])).pending).toBe(1);
  expect(accountingTotals(driveAccounting([file],[],[invoice,{...invoice,id:'other'}])).pending).toBe(1);
 });
});

it('suma ingresos leídos del PDF aunque no estén enlazados a una factura de la app',()=>{
 const extracted={file_id:file.id,source_modified_at:null,estado:'leido' as const,proveedor:'',numero_factura:'',fecha_factura:null,base:200,iva:42,total:242,retencion:0,nota:''};
 expect(accountingTotals(driveAccounting([file],[],[],[extracted]))).toMatchObject({income:200,outputVat:42,incomeTotal:242,pending:0});
 expect(accountingTotals(driveAccounting([file],[],[invoice],[extracted]))).toMatchObject({income:200,outputVat:42,pending:0});
});
it('no suma una lectura obsoleta ni cifras incompletas de ingresos',()=>{
 const extracted={file_id:file.id,source_modified_at:'2026-01-01',estado:'leido' as const,proveedor:'',numero_factura:'',fecha_factura:null,base:200,iva:42,total:242,retencion:0,nota:''};
 expect(accountingTotals(driveAccounting([file],[],[],[extracted]))).toMatchObject({income:0,pending:1});
 expect(accountingTotals(driveAccounting([file],[],[],[{...extracted,source_modified_at:null,iva:null}]))).toMatchObject({income:0,pending:1});
});
