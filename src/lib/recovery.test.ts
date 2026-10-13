import {describe,it,expect,vi,beforeEach} from 'vitest';
import {syncInvoice} from './invoiceSync';
import {supabase} from './supabase';
import {generarFacturaPdf} from './facturaPdf';
import {mapFactura,toDbFactura} from './db';
import {useStore} from '../store/useStore';
import {useAuthStore} from '../store/useAuthStore';
import {db} from './db';
import type {Factura,Ingreso} from '../types';
import {validateUserInput} from '../../supabase/functions/_shared/permissions';

const invoice:Factura={id:'draft',area:'dj',tipo:'emitida',numero:'A-42',cliente:'Cliente',concepto:'Servicio',baseImponible:300,importeIVA:63,porcentajeIVA:21,total:363,fecha:'2026-09-09',pagada:false,ivaDeducible:false,lineaNegocio:'montada_installations'};
const income={id:'income',area:'dj',concepto:'Servicio',cliente:'Cliente',baseImponible:100,total:121} as Ingreso;
beforeEach(()=>{vi.restoreAllMocks();useStore.setState({ingresos:[income],facturas:[],_saveError:null});});

describe('persistencia y recuperación',()=>{
 it('las facturas de gastos nunca se suben desde la app',async()=>{
  const invoke=vi.spyOn(supabase.functions,'invoke');
  await expect(syncInvoice({...invoice,tipo:'recibida',driveFileId:'existing'})).rejects.toThrow('únicamente desde Drive');
  expect(invoke).not.toHaveBeenCalled();
 });
 it('un fallo de escritura conserva los datos y devuelve error',async()=>{
  vi.spyOn(db.ingresos,'upsert').mockRejectedValue(new Error('Conexión perdida'));
  expect(await useStore.getState().updateIngreso('income',{total:500})).toBe(false);
  expect(useStore.getState().ingresos[0].total).toBe(121);
  expect(useStore.getState()._saveError).toBe('Conexión perdida');
 });
 it('la creación no aparece hasta que el servidor confirma',async()=>{
  let resolve!:()=>void;vi.spyOn(db.ingresos,'insert').mockImplementation(()=>new Promise<void>(r=>{resolve=r;}));
  const saving=useStore.getState().addIngreso({...income,id:'new'});
  expect(useStore.getState().ingresos).toHaveLength(1);
  resolve();expect(await saving).toBe(true);expect(useStore.getState().ingresos).toHaveLength(2);
 });
 it('una respuesta tardía no repuebla datos después de salir',async()=>{
  let resolve!:()=>void;vi.spyOn(db.ingresos,'insert').mockImplementation(()=>new Promise<void>(r=>{resolve=r;}));
  useAuthStore.setState({profile:{id:'first',rol:'admin',activo:true} as never});
  const saving=useStore.getState().addIngreso({...income,id:'late'});
  useAuthStore.setState({profile:null});resolve();await saving;
  expect(useStore.getState().ingresos).toEqual([]);
 });
 it('la línea de Installations y el documento sobreviven al mapper',()=>{
  const mapped=mapFactura(toDbFactura({...invoice,documentoId:'file',emisorId:'issuer',gastoId:'expense'}));
  expect(mapped).toMatchObject({lineaNegocio:'montada_installations',documentoId:'file',emisorId:'issuer',gastoId:'expense'});
 });
 it('normaliza los snapshots fiscales de PostgreSQL para el PDF',()=>{
  const raw={...toDbFactura(invoice),emisor_snapshot:{id:'issuer',razon_social:'Emisor real',nif_cif:'NIF',direccion_fiscal:'Dirección'},cliente_snapshot:{id:'client',nombre:'Cliente',nif_cif:'CLIENT',direccion:'Calle'}};
  expect(mapFactura(raw).emisorSnapshot).toMatchObject({razonSocial:'Emisor real',nifCif:'NIF',direccionFiscal:'Dirección'});
  expect(mapFactura(raw).clienteSnapshot?.nifCif).toBe('CLIENT');
 });
 it('el PDF es idéntico después de cambiar cobros o metadatos de Drive',()=>{
  const args={configuracionFiscal:{razonSocial:'Emisor',nifCif:'NIF',direccionFiscal:'Calle'},cliente:{nombre:'Cliente',nifCif:'CLIENT',direccion:'Calle'}};
  const first=generarFacturaPdf({...args,factura:invoice}).output();
  const changed={...invoice,pagada:true,driveFileId:'remote'};
  expect(generarFacturaPdf({...args,factura:changed}).output()).toBe(first);
 });
 it('las facturas emitidas no pasan por upsert para actualizar cobros',async()=>{
  useStore.setState({facturas:[{...invoice,numeroSecuencial:42}]});
  const update=vi.spyOn(db.facturas,'updatePayment').mockResolvedValue({...invoice,numeroSecuencial:42,pagada:true});
  const upsert=vi.spyOn(db.facturas,'upsert').mockResolvedValue();
  expect(await useStore.getState().updateFactura(invoice.id,{pagada:true})).toBe(true);
  expect(update).toHaveBeenCalledWith(invoice.id,{pagada:true});expect(upsert).not.toHaveBeenCalled();
 });
});

describe('validación administrativa de servidor',()=>{
 const base={email:'test@example.test',nombre:'Persona',rol:'usuario',permisosLineas:{dj:{ver:true,crear:true,editar:false,eliminar:false}},permisosModulos:{},permisosFacturacion:{emitir:true,rectificar:false,gestionarNumeracion:false}};
 it('acepta capacidades explícitas conocidas',()=>expect(validateUserInput(base)).toBeNull());
 it('rechaza capacidades inventadas',()=>expect(validateUserInput({...base,permisosLineas:{...base.permisosLineas,todo:base.permisosLineas.dj}})).not.toBeNull());
 it('rechaza booleanos como cadenas',()=>expect(validateUserInput({...base,permisosFacturacion:{...base.permisosFacturacion,emitir:'true'}})).not.toBeNull());
 it('rechaza escritura sin lectura',()=>expect(validateUserInput({...base,permisosLineas:{dj:{ver:false,crear:true,editar:false,eliminar:false}}})).not.toBeNull());
});
