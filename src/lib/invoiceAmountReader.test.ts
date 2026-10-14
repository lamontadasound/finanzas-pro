import {describe,it,expect} from 'vitest';
import {readInvoiceAmounts,parseMoney} from './invoiceAmountReader';
describe('Lectura de importes de facturas',()=>{
 it('lee separadores españoles e ingleses sin confundir miles',()=>{expect(parseMoney('1.234,56')).toBe(1234.56);expect(parseMoney('1,234.56')).toBe(1234.56);expect(parseMoney('1.234')).toBeNull();});
 it('rellena todos los importes claros sin revisión',()=>{expect(readInvoiceAmounts('Base imponible 100,00 €\nIVA 21% 21,00 €\nTOTAL 121,00 €')).toMatchObject({base:100,iva:21,total:121,estado:'leido'});});
 it('deriva un importe solo con otros dos explícitos',()=>{expect(readInvoiceAmounts('Base imponible 100,00\nIVA incluido\nTOTAL 110,00')).toMatchObject({iva:10,estado:'leido'});});
 it('conserva el total aunque no se pueda leer el desglose',()=>{expect(readInvoiceAmounts('IVA ?\nTOTAL 121,00')).toMatchObject({iva:null,base:null,total:121,estado:'pendiente'});});
 it('lee valores en la línea siguiente y retención',()=>{expect(readInvoiceAmounts('Base imponible\n100,00\nIVA 21% 21,00\nIRPF 15% -15,00\nTotal a pagar 106,00')).toMatchObject({retencion:15,total:106,estado:'leido'});});
 it('no confunde porcentajes con cuotas ni inventa un IVA',()=>{expect(readInvoiceAmounts('IVA 21%\nTOTAL 121,00')).toMatchObject({iva:null,base:null,total:121,estado:'pendiente'});});
 it('deja las bases múltiples y las cifras contradictorias para revisión',()=>{expect(readInvoiceAmounts('Base imponible 100,00\nBase imponible 200,00\nIVA 42,00\nTOTAL 242,00').estado).toBe('pendiente');expect(readInvoiceAmounts('Base imponible 100,00\nIVA 21,00\nTOTAL 150,00').estado).toBe('pendiente');});
 it('admite abonos y no considera números de factura como total',()=>{expect(readInvoiceAmounts('Factura 2026/123\nBase imponible -100,00\nIVA -21,00\nTOTAL -121,00')).toMatchObject({base:-100,total:-121,estado:'leido'});});
});

it('no inventa IVA en documentos que no lo mencionan',()=>{expect(readInvoiceAmounts('Base imponible 100,00\nTOTAL 120,00')).toMatchObject({iva:null,estado:'pendiente'});});
