import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup,within} from '@testing-library/react';
import {PagosPage} from './PagosPage';
import {fixtureIngresos} from '../../dev/fixtures';
const data={ingresos:[{...fixtureIngresos[0],id:'pendiente',cliente:'Cliente pendiente',lineaNegocio:'montada_sound',fechaEvento:'2026-01-01',estadoPago:'parcial',pagosRecibidos:21,baseImponible:100,total:121},{...fixtureIngresos[0],id:'pagado',cliente:'Cliente pagado',lineaNegocio:'montada_sound',fechaEvento:'2026-01-01',estadoPago:'pagado',pagosRecibidos:121,baseImponible:100,total:121}],updateIngreso:vi.fn()};
vi.mock('../../store/useStore',()=>({useStore:(s:(v:unknown)=>unknown)=>s(data)}));
vi.mock('../../store/useAuthStore',()=>({useAuthStore:(s:(v:unknown)=>unknown)=>s({canEditLinea:()=>true,canDeleteLinea:()=>true,lineasVisibles:()=>['montada_sound']})}));
afterEach(cleanup);
it('muestra de entrada clientes pendientes por línea y alertas sin elegir mes',()=>{render(<PagosPage area="todos"/>);const cards=screen.getByRole('region',{name:'Pendientes por apartado'});expect(within(cards).getByText('Cliente pendiente')).toBeTruthy();expect(within(cards).queryByText('Cliente pagado')).toBeNull();expect(within(cards).getByRole('status').textContent).toContain('30 días');expect(within(cards).getAllByText('100,00 €')).toHaveLength(2);});
