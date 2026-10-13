import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,act} from '@testing-library/react';
import {EditarNumeroFactura} from './EditarNumeroFactura';
import {useStore} from '../../store/useStore';
import {useAuthStore} from '../../store/useAuthStore';
import type {Factura} from '../../types';
const mock=vi.hoisted(()=>({rpc:vi.fn(),confirm:vi.fn(),getById:vi.fn()}));
vi.mock('../../lib/supabase',()=>({supabase:{rpc:mock.rpc}}));
vi.mock('../../lib/db',()=>({db:{facturas:{getById:mock.getById}}}));
vi.mock('../../store/useConfirmStore',()=>({useConfirmStore:(selector:(s:{show:typeof mock.confirm})=>unknown)=>selector({show:mock.confirm})}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
const factura={id:'test',numero:'84',numeroSecuencial:84,total:121,tipo:'emitida',lineaNegocio:'montada_sound'} as Factura;
function setup(){useAuthStore.setState({canGestionarNumeracion:()=>true,canEditLinea:()=>true});useStore.setState({facturas:[factura]});render(<EditarNumeroFactura factura={factura}/>);fireEvent.click(screen.getByRole('button',{name:'Editar numeración'}));}
it('precarga el número y guarda tras confirmar sin cambiar importes',async()=>{mock.rpc.mockResolvedValue({error:null});mock.getById.mockResolvedValue({...factura,numero:'85',numeroSecuencial:85});setup();expect(screen.getByLabelText('Número de factura')).toHaveProperty('value','84');fireEvent.change(screen.getByLabelText('Número de factura'),{target:{value:'85'}});fireEvent.click(screen.getByRole('button',{name:'Guardar numeración'}));expect(mock.rpc).not.toHaveBeenCalled();await act(async()=>{await mock.confirm.mock.calls[0][1]();});expect(mock.rpc).toHaveBeenCalledWith('editar_numero_factura',{p_id:'test',p_numero:85});expect(useStore.getState().facturas[0]).toMatchObject({numero:'85',total:121});});
it('conserva el número y muestra el rechazo del servidor',async()=>{mock.rpc.mockResolvedValue({error:{message:'Número ocupado'}});setup();fireEvent.change(screen.getByLabelText('Número de factura'),{target:{value:'83'}});fireEvent.click(screen.getByRole('button',{name:'Guardar numeración'}));await act(async()=>{await mock.confirm.mock.calls[0][1]();});expect(screen.getByRole('alert').textContent).toBe('Número ocupado');expect(useStore.getState().facturas[0].numero).toBe('84');});
