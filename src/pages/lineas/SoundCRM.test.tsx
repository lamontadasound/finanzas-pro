import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {SoundCRM} from './SoundCRM';
const mocks=vi.hoisted(()=>({rpc:vi.fn(async()=>({error:null})),load:vi.fn(async()=>[
 {cliente_id:'won',etapa:'ganado',origen:'Web',contacto_nombre:'Ana',tipo_servicio:'boda',motivo_perdida:'',fecha_cierre:'2026-09-20',proxima_accion:'',fecha_seguimiento:null,notas:'',cliente:{id:'won',nombre:'Cliente confirmado',email:'test@example.invalid',telefono:'123'}}
 /*{cliente_id:'lead',etapa:'contacto',origen:'Instagram',contacto_nombre:'Luis',tipo_servicio:'alquiler',motivo_perdida:'',fecha_cierre:null,proxima_accion:'Llamar',fecha_seguimiento:null,notas:'',cliente:{id:'lead',nombre:'Contacto abierto',email:'',telefono:''}}*/
])}));
vi.mock('../../lib/crmSound',async original=>({...await original<typeof import('../../lib/crmSound')>(),cargarCRM:mocks.load}));
vi.mock('../../lib/supabase',()=>({supabase:{rpc:mocks.rpc,from:()=>({select:()=>({eq:async()=>({data:[]})})})}}));
vi.mock('../../lib/presupuestosDb',()=>({listarPresupuestos:async()=>[]}));
vi.mock('../../store/useStore',()=>({useStore:Object.assign((s:(state:unknown)=>unknown)=>s({clientes:[],facturas:[],ingresos:[],documentos:[]}),{setState:vi.fn()})}));
vi.mock('../../store/useAuthStore',()=>({useAuthStore:(s:(state:unknown)=>unknown)=>s({canCreateLinea:()=>true,canEditLinea:()=>true,canDeleteLinea:()=>true,canViewModulo:()=>true})}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
describe('Clientes cerrados y CRM',()=>{
 it('muestra las carpetas independientes agrupadas por servicio',async()=>{render(<MemoryRouter><SoundCRM/></MemoryRouter>);expect(await screen.findByText('Cliente confirmado')).toBeTruthy();expect(screen.queryByText('Contacto abierto')).toBeNull();expect(screen.getByText('Boda · Sin fecha de evento')).toBeTruthy();expect(screen.queryByText('123')).toBeNull();expect(screen.queryByText('test@example.invalid')).toBeNull();expect(screen.getByRole('button',{name:/Boda\s*1/})).toBeTruthy();});
 it('edita la carpeta sin escribir en el CRM independiente',async()=>{render(<MemoryRouter><SoundCRM/></MemoryRouter>);fireEvent.click(await screen.findByRole('button',{name:'Editar Cliente confirmado'}));fireEvent.change(screen.getByLabelText('Nombre'),{target:{value:'Nombre actualizado'}});fireEvent.click(screen.getByRole('button',{name:'Guardar cambios'}));await waitFor(()=>expect(mocks.rpc).toHaveBeenCalledWith('guardar_carpeta_sound',expect.objectContaining({p_id:'won',p_datos:expect.objectContaining({nombre:'Nombre actualizado',tipo_servicio:'boda'})})));});
 it('permite editar desde la tarjeta y cancelar un borrado sin modificar datos',async()=>{render(<MemoryRouter><SoundCRM/></MemoryRouter>);fireEvent.click(await screen.findByRole('button',{name:'Editar Cliente confirmado'}));expect(screen.getByLabelText('Nombre')).toBeTruthy();cleanup();render(<MemoryRouter><SoundCRM/></MemoryRouter>);fireEvent.click(await screen.findByRole('button',{name:'Borrar Cliente confirmado'}));fireEvent.click(screen.getByRole('button',{name:'Cancelar'}));expect(mocks.rpc).not.toHaveBeenCalled();});
 it('borra solo al confirmar y retira la tarjeta',async()=>{render(<MemoryRouter><SoundCRM/></MemoryRouter>);fireEvent.click(await screen.findByRole('button',{name:'Borrar Cliente confirmado'}));expect(mocks.rpc).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Confirmar borrado'}));await waitFor(()=>expect(mocks.rpc).toHaveBeenCalledWith('borrar_cliente_sound',{p_id:'won'}));await waitFor(()=>expect(screen.queryByRole('button',{name:'Borrar Cliente confirmado'})).toBeNull());});
 it('mantiene al cliente si el servidor rechaza el borrado',async()=>{mocks.rpc.mockResolvedValueOnce({error:{message:'Sin permiso'}} as never);render(<MemoryRouter><SoundCRM/></MemoryRouter>);fireEvent.click(await screen.findByRole('button',{name:'Borrar Cliente confirmado'}));fireEvent.click(screen.getByRole('button',{name:'Confirmar borrado'}));await waitFor(()=>expect(screen.getAllByRole('alert').some(el=>el.textContent==='Sin permiso')).toBe(true));expect(screen.getByRole('button',{name:'Borrar Cliente confirmado'})).toBeTruthy();});

});
