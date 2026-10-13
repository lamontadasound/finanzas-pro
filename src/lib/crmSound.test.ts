import {describe,it,expect} from 'vitest';
import {clienteCoincide,subirArchivoCRM,clienteFacturaDrive} from './crmSound';
import type {Cliente} from '../types';
const client=(id:string,nombre:string):Cliente=>({id,nombre,esEmpresa:true,createdAt:''});
describe('Carpetas CRM',()=>{
 it('solo reconoce facturas Drive con cliente explícito',()=>{expect(clienteFacturaDrive('Factura 80 - Arena Negra .pdf')).toBe('Arena Negra');expect(clienteFacturaDrive('Factura 80.pdf')).toBe('');expect(clienteFacturaDrive('Proforma 69 - Arena.pdf')).toBe('');});
 it('vincula solo coincidencias exactas sin ambigüedad',()=>{const c=client('a','Arena Negra');expect(clienteCoincide(' arena negra ',c,[c])).toBe(true);expect(clienteCoincide('Arena',c,[c])).toBe(false);expect(clienteCoincide('Arena Negra',c,[c,client('b','ARENA NEGRA')])).toBe(false);});
 it('no asocia clientes vacíos',()=>{const c=client('a','');expect(clienteCoincide('',c,[c])).toBe(false);});
 it('rechaza ejecutables antes de subirlos',async()=>{await expect(subirArchivoCRM('a','contrato',new File(['test'],'archivo.exe'))).rejects.toThrow('Selecciona');});
 it('rechaza archivos vacíos',async()=>{await expect(subirArchivoCRM('a','informacion',new File([],'listado.csv'))).rejects.toThrow('Selecciona');});
});
