import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {GenerateInvoices} from './GenerateInvoices';
import {useStore} from '../../store/useStore';
import {useAuthStore} from '../../store/useAuthStore';
const mocks=vi.hoisted(()=>({rpc:vi.fn(),insert:vi.fn(),get:vi.fn(),upsert:vi.fn(),delete:vi.fn()}));
vi.mock('../../lib/supabase',()=>({supabase:{rpc:mocks.rpc}}));
vi.mock('../../lib/db',()=>({db:{facturas:{insertIfMissing:mocks.insert,getById:mocks.get,upsert:mocks.upsert,delete:mocks.delete}}}));
vi.mock('../../lib/invoiceSync',()=>({syncInvoice:vi.fn().mockRejectedValue(Error('Sin conexión'))}));
beforeEach(()=>{localStorage.clear();vi.clearAllMocks();const profile={id:'user',nombre:'Test',email:'a@example.invalid',rol:'admin' as const,activo:true,permisosLineas:{},permisosModulos:{} as never,permisosFacturacion:{emitir:true,rectificar:true,gestionarNumeracion:true}};useAuthStore.setState({profile,user:profile});useStore.setState({ingresos:[],facturas:[],emisores:[{id:'default',razonSocial:'LA MONTADA SOUND SL',nifCif:'B21642913',direccionFiscal:'Dirección'}],proyectoEmisorMap:{montada_sound:'default'}});mocks.get.mockImplementation(async(id:string)=>({id,numero:'83',numeroSecuencial:83,fecha:'2026-09-23',tipo:'emitida',lineaNegocio:'montada_sound',cliente:'Cliente nuevo',total:121}));});afterEach(cleanup);
const fill=()=>{for(const [label,value] of [['Nombre / razón social','Cliente nuevo'],['NIF/CIF','B12345678'],['Dirección fiscal','Calle 1'],['Concepto 1','Alquiler'],['Precio 1','100']])fireEvent.change(screen.getByLabelText(label),{target:{value}});};
describe('Factura independiente',()=>{
 it('envía la numeración solicitada y la fecha del evento',async()=>{mocks.rpc.mockResolvedValue({error:null});render(<MemoryRouter><GenerateInvoices linea="montada_sound"/></MemoryRouter>);fill();fireEvent.change(screen.getByLabelText(/Numeración solicitada/),{target:{value:'95'}});fireEvent.change(screen.getByLabelText('Fecha del evento'),{target:{value:'2026-10-10'}});fireEvent.click(screen.getByRole('button',{name:'Emitir factura'}));await waitFor(()=>expect(mocks.rpc).toHaveBeenCalledWith('emitir_factura_independiente',expect.objectContaining({p_numero_solicitado:95,p_fecha_evento:'2026-10-10'})));});

 it('guarda un borrador con datos fiscales editables y sin consumir numeración',async()=>{let saved:unknown;mocks.insert.mockImplementation(async(f:unknown)=>{saved=f;});mocks.get.mockImplementation(async()=>saved);render(<MemoryRouter><GenerateInvoices linea="montada_sound"/></MemoryRouter>);fill();fireEvent.click(screen.getByRole('button',{name:'Guardar borrador'}));await screen.findByText(/Borrador guardado en la app/);expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({estado:'borrador',numero:'',clienteBorrador:expect.objectContaining({nifCif:'B12345678'})}));expect(mocks.insert.mock.calls[0][0].clienteSnapshot).toBeUndefined();expect(screen.getByRole('button',{name:'Abrir borrador'})).toBeTruthy();});

 it('recupera datos y varios conceptos después de desmontar el formulario',()=>{const view=render(<MemoryRouter><GenerateInvoices linea="montada_sound"/></MemoryRouter>);fill();fireEvent.click(screen.getByRole('button',{name:'Añadir concepto'}));fireEvent.change(screen.getByLabelText('Concepto 2'),{target:{value:'Técnico'}});fireEvent.change(screen.getByLabelText('Precio 2'),{target:{value:'80'}});view.unmount();render(<MemoryRouter><GenerateInvoices linea="montada_sound"/></MemoryRouter>);expect((screen.getByLabelText('Nombre / razón social') as HTMLInputElement).value).toBe('Cliente nuevo');expect((screen.getByLabelText('Concepto 2') as HTMLInputElement).value).toBe('Técnico');expect(screen.getByText('Total sin IVA: 180,00 €')).toBeTruthy();});

 it('emite sin crear un ingreso y fija los datos fiscales',async()=>{mocks.rpc.mockResolvedValue({error:null});render(<MemoryRouter><GenerateInvoices linea="montada_sound"/></MemoryRouter>);fill();fireEvent.click(screen.getByRole('button',{name:'Emitir factura'}));await waitFor(()=>expect(mocks.rpc).toHaveBeenCalledWith('emitir_factura_independiente',expect.objectContaining({p_ingreso_id:null,p_base_imponible:100,p_total:121,p_datos_cliente:expect.objectContaining({nombre:'Cliente nuevo'})})));expect(useStore.getState().ingresos).toEqual([]);expect(await screen.findByText(/subida a Drive queda pendiente/)).toBeTruthy();});
 it('no consume numeración con campos incompletos',async()=>{render(<MemoryRouter><GenerateInvoices linea="montada_sound"/></MemoryRouter>);fireEvent.click(screen.getByRole('button',{name:'Emitir factura'}));expect(await screen.findByRole('alert')).toBeTruthy();expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.insert).not.toHaveBeenCalled();});
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
 expect(screen.getByRole('checkbox',{name:'Suplido 2'})).toHaveProperty('checked',true);
 fireEvent.click(screen.getByRole('button',{name:'Emitir factura'}));
 await waitFor(()=>expect(mocks.rpc).toHaveBeenCalledWith('emitir_factura_independiente',expect.objectContaining({p_base_imponible:100,p_importe_iva:21,p_total:171,p_concepto:expect.stringContaining('; suplido]')})));
});
