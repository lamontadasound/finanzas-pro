import {describe,it,expect} from 'vitest';
import {serializeConcepts,parseConcepts,conceptAmount,invoiceAmounts} from './invoiceConcepts';
import {generarFacturaPdf} from './facturaPdf';
describe('Conceptos de factura',()=>{
 it('imprime evento, web e IBAN también en PDF regenerados del emisor',()=>{const pdf=generarFacturaPdf({factura:{numero:'84',fecha:'2026-09-23',fechaEvento:'2026-10-10',concepto:'Sonido',baseImponible:100,importeIVA:21,porcentajeIVA:21,total:121},cliente:{nombre:'Cliente'},configuracionFiscal:{nifCif:'B21642913',telefono:'626875079',email:'facturas@lamontada.es'}}).output();expect(pdf).toContain('2026-10-10');expect(pdf).toContain('www.lamontada.es');expect(pdf).toContain('ES82 0182 1941 7302 0172 1518');});

 const rows=[{id:'a',descripcion:'Sonido\nMontaje incluido',cantidad:2,precio:100,descuento:10},{id:'b',descripcion:'Técnico',cantidad:1,precio:50,descuento:0}];
 it('conserva cantidades, descuentos y varias líneas al guardar y reabrir',()=>{const parsed=parseConcepts(serializeConcepts(rows))!;expect(parsed.map(c=>({...c,id:undefined}))).toEqual(rows.map(c=>({...c,id:undefined})));expect(parsed.reduce((sum,c)=>sum+conceptAmount(c),0)).toBe(230);});
 it('mantiene compatibles las facturas antiguas y no acepta totales manipulados',()=>{expect(parseConcepts('Alquiler de sonido')).toBeNull();expect(parseConcepts(serializeConcepts(rows).replace('total 180.00','total 999.00'))).toBeNull();});
 it('incluye cada concepto en el PDF y calcula el total del documento',()=>{const doc=generarFacturaPdf({factura:{numero:'PRUEBA',fecha:'2026-09-23',concepto:serializeConcepts(rows),baseImponible:230,importeIVA:48.3,porcentajeIVA:21,total:278.3},cliente:{nombre:'Test'},configuracionFiscal:{razonSocial:'Test'}});const text=doc.output();expect(text).toContain('Montaje incluido');expect(text).toContain('278,30');expect(text).toContain('PRECIO');});
});

it('suplidos: conserva la marca y suma fuera de base e IVA en PDF',()=>{
 const rows=[{id:'a',descripcion:'Servicio',cantidad:1,precio:100,descuento:0},{id:'b',descripcion:'Tasa',cantidad:2,precio:30,descuento:5,suplido:true}];
 const restored=parseConcepts(serializeConcepts(rows))!;
 expect(restored[1].suplido).toBe(true);
 expect(invoiceAmounts(restored,21)).toEqual({base:100,suplidos:50,tax:21,total:171});
 const pdf=generarFacturaPdf({factura:{numero:'PRUEBA',fecha:'2026-09-23',concepto:serializeConcepts(rows),baseImponible:100,importeIVA:21,porcentajeIVA:21,total:171},cliente:{nombre:'Test'},configuracionFiscal:{razonSocial:'Test'}}).output();
 expect(pdf).toContain('Suplidos');expect(pdf).toContain('171,00');expect(pdf).toContain('PRECIO');
 expect(invoiceAmounts([rows[1]],21)).toEqual({base:0,suplidos:50,tax:0,total:50});
 expect(invoiceAmounts(restored.map(c=>({...c,suplido:false})),21)).toEqual({base:150,suplidos:0,tax:31.5,total:181.5});
});

it('conserva descripción independiente y referencia larga sin alterar importes ni numeración',()=>{
 const reference='0000123456789012345678901234567890-PO';
 const rows=[{id:'a',descripcion:'Equipo de sonido',detalle:'Dos altavoces\nMontaje y desmontaje incluidos',cantidad:2,precio:100,descuento:10}];
 const parsed=parseConcepts(serializeConcepts(rows))!;
 expect(parsed[0].descripcion).toBe('Equipo de sonido');expect(parsed[0].detalle).toBe(rows[0].detalle);
 expect(invoiceAmounts(parsed,21)).toEqual({base:180,suplidos:0,tax:37.8,total:217.8});
 const pdf=generarFacturaPdf({factura:{numero:'101',fecha:'2026-10-26',concepto:serializeConcepts(rows),baseImponible:180,importeIVA:37.8,porcentajeIVA:21,total:217.8},cliente:{nombre:'Empresa',referenciaFactura:reference},configuracionFiscal:{razonSocial:'Test'}}).output();
 expect(pdf).toContain(reference);expect(pdf).toContain('Dos altavoces');expect(pdf).toContain('Montaje y desmontaje incluidos');expect(pdf).toContain('Factura 101');
});
