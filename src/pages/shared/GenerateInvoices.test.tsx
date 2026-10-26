import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup,act} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {GenerateInvoices} from './GenerateInvoices';
import {useStore} from '../../store/useStore';
import {useAuthStore} from '../../store/useAuthStore';
import {useConfirmStore} from '../../store/useConfirmStore';
import {serializeConcepts} from '../../lib/invoiceConcepts';
import type {Factura} from '../../types';
const mocks=vi.hoisted(()=>({rpc:vi.fn(),insert:vi.fn(),get:vi.fn(),upsert:vi.fn(),delete:vi.fn()}));
vi.mock('../../lib/supabase',()=>({supabase:{rpc:mocks.rpc}}));
vi.mock('../../lib/db',()=>({db:{facturas:{insertIfMissing:mocks.insert,getById:mocks.get,upsert:mocks.upsert,delete:mocks.delete}}}));
vi.mock('../../lib/invoiceSync',()=>({syncInvoice:vi.fn().mockRejectedValue(Error('Sin conexión'))}));
beforeEach(()=>{localStorage.clear();vi.clearAllMocks();const profile={id:'user',nombre:'Test',email:'a@example.invalid',rol:'admin' as const,activo:true,permisosLineas:{},permisosModulos:{} as never,permisosFacturacion:{emitir:true,rectificar:true,gestionarNumeracion:true}};useAuthStore.setState({profile,user:profile});useStore.setState({ingresos:[],facturas:[],emisores:[{id:'default',razonSocial:'LA MONTADA SOUND SL',nifCif:'B21642913',direccionFiscal:'Dirección'}],proyectoEmisorMap:{montada_sound:'default'}});mocks.get.mockImplementation(async(id:string)=>({id,numero:'83',numeroSecuencial:83,fecha:'2026-09-23',tipo:'emitida',lineaNegocio:'montada_sound',cliente:'Cliente nuevo',total:121,concepto:serializeConcepts([{id:'line',descripcion:'Alquiler',cantidad:1,precio:100,descuento:0}]),baseImponible:100,importeIVA:21,porcentajeIVA:21,clienteSnapshot:{nombre:'Cliente nuevo',nifCif:'B12345678',direccion:'Calle 1'}}));});afterEach(cleanup);
const fill=()=>{fireEvent.click(screen.getByRole('button',{name:'Crear factura'}));for(const [label,value] of [['Nombre / razón social','Cliente nuevo'],['NIF/CIF','B12345678'],['Dirección fiscal','Calle 1'],['Concepto 1','Alquiler'],['Precio 1','100']])fireEvent.change(screen.getByLabelText(label),{target:{value}});};
describe('Factura independiente',()=>{
 it('envía la numeración solicitada y la fecha del evento',async()=>{mocks.rpc.mockResolvedValue({error:null});render(<MemoryRouter><GenerateInvoices linea="montada_sound"/></MemoryRouter>);fill();fireEvent.change(screen.getByLabelText(/Numeración solicitada/),{target:{value:'95'}});fireEvent.change(screen.getByLabelText('Fecha del evento'),{target:{value:'2026-10-10'}});fireEvent.click(screen.getByRole('button',{name:'Emitir factura'}));await waitFor(()=>expect(mocks.rpc).toHaveBeenCalledWith('emitir_factura_independiente',expect.objectContaining({p_numero_solicitado:95,p_fecha_evento:'2026-10-10'})));});

 it('guarda un borrador con datos fiscales editables y sin consumir numeración',async()=>{let saved:unknown;mocks.insert.mockImplementation(async(f:unknown)=>{saved=f;});mocks.get.mockImplementation(async()=>saved);render(<MemoryRouter><GenerateInvoices linea="montada_sound"/></MemoryRouter>);fill();fireEvent.click(screen.getByRole('button',{name:'Guardar borrador'}));await screen.findByText(/Borrador guardado en la app/);expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({estado:'borrador',numero:'',clienteBorrador:expect.objectContaining({nifCif:'B12345678'})}));expect(mocks.insert.mock.calls[0][0].clienteSnapshot).toBeUndefined();expect(screen.getByRole('button',{name:/Abrir borrador/})).toBeTruthy();});

 it('recupera datos y varios conceptos después de desmontar el formulario',()=>{const view=render(<MemoryRouter><GenerateInvoices linea="montada_sound"/></MemoryRouter>);fill();fireEvent.click(screen.getByRole('button',{name:'Añadir concepto'}));fireEvent.change(screen.getByLabelText('Concepto 2'),{target:{value:'Técnico'}});fireEvent.change(screen.getByLabelText('Precio 2'),{target:{value:'80'}});view.unmount();render(<MemoryRouter><GenerateInvoices linea="montada_sound"/></MemoryRouter>);fireEvent.click(screen.getByRole('button',{name:'Crear factura'}));expect((screen.getByLabelText('Nombre / razón social') as HTMLInputElement).value).toBe('Cliente nuevo');expect((screen.getByLabelText('Concepto 2') as HTMLInputElement).value).toBe('Técnico');expect(screen.getByText('Total sin IVA: 180,00 €')).toBeTruthy();});

 it('emite sin crear un ingreso y fija los datos fiscales',async()=>{mocks.rpc.mockResolvedValue({error:null});render(<MemoryRouter><GenerateInvoices linea="montada_sound"/></MemoryRouter>);fill();fireEvent.click(screen.getByRole('button',{name:'Emitir factura'}));await waitFor(()=>expect(mocks.rpc).toHaveBeenCalledWith('emitir_factura_independiente',expect.objectContaining({p_ingreso_id:null,p_base_imponible:100,p_total:121,p_datos_cliente:expect.objectContaining({nombre:'Cliente nuevo'})})));expect(useStore.getState().ingresos).toEqual([]);expect(await screen.findByText(/subida a Drive queda pendiente/)).toBeTruthy();});
 it('no consume numeración con campos incompletos',async()=>{render(<MemoryRouter><GenerateInvoices linea="montada_sound"/></MemoryRouter>);fireEvent.click(screen.getByRole('button',{name:'Crear factura'}));fireEvent.click(screen.getByRole('button',{name:'Emitir factura'}));expect(await screen.findByRole('alert')).toBeTruthy();expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.insert).not.toHaveBeenCalled();});
 it('un reintento usa el mismo identificador',async()=>{mocks.rpc.mockResolvedValueOnce({error:Error('Respuesta perdida')}).mockResolvedValueOnce({error:null});render(<MemoryRouter><GenerateInvoices linea="montada_sound"/></MemoryRouter>);fill();fireEvent.click(screen.getByRole('button',{name:'Emitir factura'}));await screen.findByText('Respuesta perdida');fireEvent.click(screen.getByRole('button',{name:'Emitir factura'}));await waitFor(()=>expect(mocks.rpc).toHaveBeenCalledTimes(2));expect(mocks.rpc.mock.calls[0][1].p_factura_id).toBe(mocks.rpc.mock.calls[1][1].p_factura_id);});
});

it('suplidos: recupera la selección y emite excluyéndola del IVA',async()=>{
 mocks.rpc.mockResolvedValue({error:null});const view=render(<MemoryRouter><GenerateInvoices linea="montada_sound"/></MemoryRouter>);fill();
 fireEvent.click(screen.getByRole('button',{name:'Añadir concepto'}));
 fireEvent.change(screen.getByLabelText('Concepto 2'),{target:{value:'Tasa'}});
 fireEvent.change(screen.getByLabelText('Precio 2'),{target:{value:'50'}});
 fireEvent.click(screen.getByRole('checkbox',{name:'Suplido 2'}));
 expect(screen.getByText('Total sin IVA: 100,00 €')).toBeTruthy();expect(screen.getByText('IVA: 21,00 €')).toBeTruthy();expect(screen.getByText('Total con IVA: 171,00 €')).toBeTruthy();
 view.unmount();render(<MemoryRouter><GenerateInvoices linea="montada_sound"/></MemoryRouter>);
 fireEvent.click(screen.getByRole('button',{name:'Crear factura'}));
 expect(screen.getByRole('checkbox',{name:'Suplido 2'})).toHaveProperty('checked',true);
 fireEvent.click(screen.getByRole('button',{name:'Emitir factura'}));
 await waitFor(()=>expect(mocks.rpc).toHaveBeenCalledWith('emitir_factura_independiente',expect.objectContaining({p_base_imponible:100,p_importe_iva:21,p_total:171,p_concepto:expect.stringContaining('; suplido]')})));
});

const issuedInvoice=()=>({id:'issued',tipo:'emitida',lineaNegocio:'montada_sound',numero:'90',numeroSecuencial:90,emisorId:'default',fecha:'2026-10-17',fechaEvento:'2026-10-20',cliente:'Cliente emitido',estado:'emitida',pagada:false,baseImponible:100,importeIVA:21,porcentajeIVA:21,total:121,driveFileId:'drive-old',concepto:serializeConcepts([{id:'line',descripcion:'Servicio',cantidad:1,precio:100,descuento:0}]),clienteSnapshot:{nombre:'Cliente emitido',nifCif:'B123',direccion:'Calle 1',email:'antes@example.com',telefono:'123'},emisorSnapshot:{razonSocial:'LA MONTADA SOUND SL',nifCif:'B21642913',direccionFiscal:'Calle Portugalete'}} as Factura);
it('abre primero el listado y permite editar una emitida tras confirmar',async()=>{
 const invoice=issuedInvoice();useStore.setState({facturas:[invoice]});mocks.rpc.mockResolvedValue({error:null});mocks.get.mockResolvedValue({...invoice,numero:'91',numeroSecuencial:91,driveFileId:undefined,total:242});
 render(<MemoryRouter><GenerateInvoices linea="montada_sound"/></MemoryRouter>);
 expect(screen.getByRole('heading',{name:'Facturas'})).toBeTruthy();expect(screen.queryByLabelText('Concepto 1')).toBeNull();expect(screen.getByText('En Drive')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:/Abrir factura 90/}));
 expect(screen.getByLabelText('Número de factura')).toHaveProperty('value','90');
 fireEvent.change(screen.getByLabelText('Número de factura'),{target:{value:'91'}});
 fireEvent.change(screen.getByLabelText('Precio 1'),{target:{value:'200'}});
 fireEvent.change(screen.getByLabelText('Email'),{target:{value:'nuevo@example.com'}});
 fireEvent.click(screen.getByRole('button',{name:'Guardar cambios'}));expect(mocks.rpc).not.toHaveBeenCalled();
 expect(useConfirmStore.getState().message).toContain('Esta factura ya está emitida.');
 await act(async()=>{await useConfirmStore.getState().onConfirm?.();});
 expect(mocks.rpc).toHaveBeenCalledWith('editar_factura_emitida',expect.objectContaining({p_id:'issued',p_numero:91,p_base_imponible:200,p_importe_iva:42,p_total:242,p_datos_cliente:expect.objectContaining({email:'nuevo@example.com'}),p_concepto:expect.stringContaining('200.00 EUR')}));
 expect(useStore.getState().facturas[0].total).toBe(242);expect(screen.getByRole('button',{name:'Volver a subir a Drive'})).toBeTruthy();
});
it('sin permiso de numeración permite editar otros campos conservando el número',async()=>{
 useAuthStore.setState({profile:{...useAuthStore.getState().profile!,rol:'empleado' as never,permisosLineas:{montada_sound:{ver:true,editar:true,crear:false,eliminar:false}},permisosFacturacion:{emitir:true,rectificar:false,gestionarNumeracion:false}}});
 const invoice=issuedInvoice();useStore.setState({facturas:[invoice]});mocks.rpc.mockResolvedValue({error:null});mocks.get.mockResolvedValue(invoice);
 render(<MemoryRouter><GenerateInvoices linea="montada_sound"/></MemoryRouter>);fireEvent.click(screen.getByRole('button',{name:/Abrir factura 90/}));expect(screen.getByLabelText('Número de factura')).toHaveProperty('disabled',true);
 fireEvent.click(screen.getByRole('button',{name:'Guardar cambios'}));await act(async()=>{await useConfirmStore.getState().onConfirm?.();});expect(mocks.rpc).toHaveBeenCalledWith('editar_factura_emitida',expect.objectContaining({p_numero:90}));
});
it('no altera la factura local si el servidor rechaza el cambio',async()=>{
 const invoice=issuedInvoice();useStore.setState({facturas:[invoice]});mocks.rpc.mockResolvedValue({error:{message:'Número ocupado'}});
 render(<MemoryRouter><GenerateInvoices linea="montada_sound"/></MemoryRouter>);fireEvent.click(screen.getByRole('button',{name:/Abrir factura 90/}));fireEvent.click(screen.getByRole('button',{name:'Guardar cambios'}));await act(async()=>{await useConfirmStore.getState().onConfirm?.();});expect(screen.getByRole('alert')).toHaveProperty('textContent','Número ocupado');expect(useStore.getState().facturas[0]).toEqual(invoice);
});

it('mantiene archivadas en el listado y restaura la misma factura antes de editar',async()=>{
 const invoice={...issuedInvoice(),ocultaEn:'2026-10-16T10:00:00Z'};useStore.setState({facturas:[invoice]});mocks.rpc.mockResolvedValue({error:null});mocks.get.mockResolvedValue({...invoice,ocultaEn:undefined});
 render(<MemoryRouter><GenerateInvoices linea="montada_sound"/></MemoryRouter>);
 expect(screen.getByText('Archivada')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:/Abrir factura 90/}));expect(mocks.rpc).not.toHaveBeenCalled();
 await act(async()=>{await useConfirmStore.getState().onConfirm?.();});
 expect(mocks.rpc).toHaveBeenCalledWith('restaurar_factura_generada',{p_id:'issued'});expect(screen.getByLabelText('Número de factura')).toHaveProperty('value','90');expect(useStore.getState().facturas).toHaveLength(1);expect(useStore.getState().facturas[0].ocultaEn).toBeUndefined();
});
it('si falla la restauración conserva la factura archivada y muestra el error',async()=>{
 const invoice={...issuedInvoice(),ocultaEn:'2026-10-16T10:00:00Z'};useStore.setState({facturas:[invoice]});mocks.rpc.mockResolvedValue({error:{message:'Sin permiso para restaurar'}});
 render(<MemoryRouter><GenerateInvoices linea="montada_sound"/></MemoryRouter>);fireEvent.click(screen.getByRole('button',{name:/Abrir factura 90/}));await act(async()=>{await useConfirmStore.getState().onConfirm?.();});expect(screen.getByRole('alert').textContent).toBe('Sin permiso para restaurar');expect(screen.queryByLabelText('Número de factura')).toBeNull();expect(useStore.getState().facturas[0]).toEqual(invoice);
});

it('conserva referencia y descripción al cerrar, reabrir y emitir',async()=>{
 mocks.rpc.mockResolvedValue({error:null});const view=render(<MemoryRouter><GenerateInvoices linea="montada_sound"/></MemoryRouter>);fill();
 const reference='0000123456789012345678901234567890-PO';
 fireEvent.change(screen.getByLabelText('Referencia del cliente / nº de pedido (opcional)'),{target:{value:reference}});
 fireEvent.change(screen.getByLabelText('Descripción 1'),{target:{value:'Dos altavoces y montaje'}});
 view.unmount();render(<MemoryRouter><GenerateInvoices linea="montada_sound"/></MemoryRouter>);fireEvent.click(screen.getByRole('button',{name:'Crear factura'}));
 expect(screen.getByLabelText('Referencia del cliente / nº de pedido (opcional)')).toHaveProperty('value',reference);
 expect(screen.getByLabelText('Descripción 1')).toHaveProperty('value','Dos altavoces y montaje');
 fireEvent.click(screen.getByRole('button',{name:'Emitir factura'}));
 await waitFor(()=>expect(mocks.rpc).toHaveBeenCalledWith('emitir_factura_independiente',expect.objectContaining({p_numero_solicitado:null,p_datos_cliente:expect.objectContaining({referenciaFactura:reference}),p_concepto:expect.stringContaining('Dos altavoces y montaje'),p_total:121})));
});
