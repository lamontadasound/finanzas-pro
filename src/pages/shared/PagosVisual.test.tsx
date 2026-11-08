import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup,fireEvent,waitFor} from '@testing-library/react';
import {PagosPage} from './PagosPage';
import {MemoryRouter} from 'react-router-dom';
import {fixtureIngresos} from '../../dev/fixtures';
const data={ingresos:[{...fixtureIngresos[0],id:'pendiente',cliente:'Cliente pendiente',lineaNegocio:'montada_sound',fechaEvento:'2026-01-01',estadoPago:'parcial',pagosRecibidos:21,baseImponible:100,total:121},{...fixtureIngresos[0],id:'pagado',cliente:'Cliente pagado',lineaNegocio:'montada_sound',fechaEvento:'2026-01-01',estadoPago:'pagado',pagosRecibidos:121,baseImponible:100,total:121}],updateIngreso:vi.fn()};
vi.mock('../../store/useStore',()=>({useStore:(s:(v:unknown)=>unknown)=>s(data)}));
vi.mock('../../store/useAuthStore',()=>({useAuthStore:(s:(v:unknown)=>unknown)=>s({canEditLinea:()=>true,canDeleteLinea:()=>true,lineasVisibles:()=>['montada_sound']})}));
afterEach(cleanup);
it('muestra de entrada los pendientes de todos los años con su antigüedad',()=>{render(<MemoryRouter><PagosPage area="todos"/></MemoryRouter>);expect(screen.getByText('Cliente pendiente')).toBeTruthy();expect(screen.queryByText('Cliente pagado')).toBeNull();expect(screen.getByText('Más de 60 días')).toBeTruthy();expect(screen.getAllByText('100,00 €').length).toBeGreaterThan(0);});

it('un pago adicional no vuelve a sumar ninguna de las dos reservas', async () => {
 const original = data.ingresos;
 data.ingresos = [{...fixtureIngresos[0], id:'dos',cliente:'Dos reservas',lineaNegocio:'montada_sound',fechaEvento:'2026-01-01',total:1000,estadoPago:'parcial',pagosRecibidos:100,tieneReserva:true,reserva:200,numeroReservas:2,reserva2:300}];
 data.updateIngreso.mockResolvedValue(true);
 try {
  render(<MemoryRouter><PagosPage area="todos"/></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Cobro'}));
  fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'50'}});
  fireEvent.click(screen.getByRole('button',{name:'Registrar'}));
  await waitFor(()=>expect(data.updateIngreso).toHaveBeenCalledWith('dos',expect.objectContaining({pagosRecibidos:150,estadoPago:'parcial'})));
 } finally { data.ingresos=original; }
});
