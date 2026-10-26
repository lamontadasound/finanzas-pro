import {serializeConcepts} from './invoiceConcepts';
import {REAL_MADRID_BILLING,REAL_MADRID_REFERENCE,REAL_MADRID_CONCEPT,REAL_MADRID_DETAIL} from './realMadridInvoice';
import {describe,it,expect} from 'vitest';
import {generarFacturaPdf,type FacturaPdfInput} from './facturaPdf';
const input:FacturaPdfInput={factura:{numero:'81',fecha:'2026-09-16',concepto:'Montaje de sonido',baseImponible:1000,porcentajeIVA:21,importeIVA:210,total:1210},configuracionFiscal:{razonSocial:'LA MONTADA SOUND SL',nifCif:'B21642913',direccionFiscal:'CALLE PORTUGALETE 68, 28223, POZUELO DE ALARCÓN, MADRID'},cliente:{nombre:'Cliente de prueba',nifCif:'TEST',direccion:'Madrid'}};
describe('PDF de factura',()=>{
 it('mantiene los mismos bytes al regenerar la misma factura',()=>{expect(generarFacturaPdf(input).output()).toBe(generarFacturaPdf(input).output());});
 it('pagina conceptos largos sin una foto de montaje',()=>{
  const doc=generarFacturaPdf({...input,factura:{...input.factura,concepto:'Servicio de montaje detallado. '.repeat(300)}});
  expect(doc.getNumberOfPages()).toBeGreaterThan(1);expect(doc.output()).not.toContain('FOTO DEL MONTAJE');
 });
});


it('Real Madrid: partido en cabecera, referencia tras dirección y concepto en una línea',()=>{
 const pdf=generarFacturaPdf({...input,cliente:{...REAL_MADRID_BILLING,referenciaFactura:REAL_MADRID_REFERENCE},factura:{...input.factura,lineaNegocio:'real_madrid',fechaEvento:'2026-08-30',concepto:serializeConcepts([{id:'1',descripcion:REAL_MADRID_CONCEPT,detalle:'FECHA EVENTO: 30 Agosto 2026 Real Madrid vs Málaga\n'+REAL_MADRID_DETAIL,cantidad:1,precio:1000,descuento:0}])}}).output();
 expect(pdf).not.toContain('Cliente:');expect(pdf).not.toContain('NIF / CIF:');expect(pdf).not.toContain('FECHA EVENTO:');
 expect(pdf).toContain('30 Agosto 2026');expect(pdf).toContain('Real Madrid');expect(pdf).toContain('G28034718');
 expect(pdf.indexOf(REAL_MADRID_REFERENCE)).toBeGreaterThan(pdf.indexOf('AVENIDA DE CONCHA ESPINA'));
 expect(pdf).toContain('L.ESTE \\(AFFINITY\\) + DJ JULIA CENTENO Y L.OESTE + DJ CARLOS');
});
