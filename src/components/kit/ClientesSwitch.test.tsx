import {it,expect,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {MemoryRouter,useLocation} from 'react-router-dom';
import {ClientesSwitch} from './ClientesSwitch';
afterEach(cleanup);
function Location(){return <output>{useLocation().pathname}</output>;}
it('Cerrados y CRM mantienen sus rutas',()=>{render(<MemoryRouter initialEntries={['/lineas/montada-sound/clientes']}><ClientesSwitch/><Location/></MemoryRouter>);fireEvent.click(screen.getByRole('tab',{name:'CRM'}));expect(screen.getByText('/lineas/montada-sound/crm')).toBeTruthy();fireEvent.click(screen.getByRole('tab',{name:'Cerrados'}));expect(screen.getByText('/lineas/montada-sound/clientes')).toBeTruthy();});
