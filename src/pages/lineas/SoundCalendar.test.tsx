vi.mock('../../lib/supabase',()=>({supabase:{rpc:vi.fn().mockResolvedValue({data:[{id:'a',date:'2026-10-22',title:'Boda prueba',client:'Cliente prueba',type:'boda',total:null,status:''}],error:null})}}));
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {useAuthStore} from '../../store/useAuthStore';
import {SoundCalendar} from './SoundCalendar';
const model={ingresos:[{id:'a',lineaNegocio:'montada_sound',fechaEvento:'2026-10-22',concepto:'Boda prueba',cliente:'Cliente prueba',tipoEvento:'boda',estadoPago:'pendiente',total:121}],eventos:[],_saveError:null};
vi.mock('../../store/useStore',()=>({useStore:(selector:(s:unknown)=>unknown)=>selector(model)}));
afterEach(()=>{cleanup();vi.useRealTimers();});
it('navega meses y abre el detalle del evento seleccionado',()=>{
 useAuthStore.setState({profile:{activo:true,rol:'admin'} as never});vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(2026,9,22,12));render(<SoundCalendar/>);
 expect(screen.getByRole('button',{name:/jueves, 22 de octubre.*1 eventos/}).className).toContain('bg-[#fff0a8]');
 expect(screen.getByRole('heading',{name:'Calendario'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:/Boda prueba.*Cliente prueba/}));expect(screen.getByRole('dialog')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Cerrar'}));fireEvent.click(screen.getByRole('button',{name:'Mes siguiente'}));expect(screen.getByText('noviembre de 2026')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Hoy'}));expect(screen.getByText('octubre de 2026')).toBeTruthy();
});
