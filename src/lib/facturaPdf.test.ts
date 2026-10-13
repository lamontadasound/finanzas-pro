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
