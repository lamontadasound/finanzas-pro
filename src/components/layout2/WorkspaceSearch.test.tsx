import {afterEach,beforeAll,describe,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter,useLocation} from 'react-router-dom';
import {WorkspaceSearch} from './WorkspaceSearch';
vi.mock('../../store/useAuthStore',()=>({useAuthStore:()=>({canViewLinea:(id:string)=>id==='montada_sound',canViewModulo:()=>false})}));
beforeAll(()=>{HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};});
afterEach(cleanup);
function CurrentRoute(){return <output aria-label="Ruta actual">{useLocation().pathname}</output>;}
describe('Búsqueda del espacio de trabajo',()=>{
 it('encuentra un apartado autorizado y navega a él',()=>{render(<MemoryRouter><WorkspaceSearch/><CurrentRoute/></MemoryRouter>);fireEvent.click(screen.getByRole('button',{name:'Buscar un apartado'}));fireEvent.change(screen.getByRole('textbox',{name:'Nombre del apartado'}),{target:{value:'clientes'}});fireEvent.click(screen.getByRole('button',{name:/Clientes/}));expect(screen.getByLabelText('Ruta actual').textContent).toBe('/lineas/montada-sound/clientes');});
 it('abre con Ctrl K y no expone apartados de otras líneas',()=>{render(<MemoryRouter><WorkspaceSearch/></MemoryRouter>);fireEvent.keyDown(window,{key:'k',ctrlKey:true});expect(screen.getByRole('dialog')).toBeTruthy();fireEvent.change(screen.getByRole('textbox',{name:'Nombre del apartado'}),{target:{value:'Installations'}});expect(screen.getByText('No hay apartados que coincidan con tu búsqueda.')).toBeTruthy();});
});
