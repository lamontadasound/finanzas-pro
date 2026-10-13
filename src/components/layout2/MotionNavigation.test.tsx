import {afterEach,describe,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {SlideMenuLineas} from './SlideMenuLineas';
import {Sidebar001,Sidebar001Content,Sidebar001Item} from '../unlumen-ui/sidebar-001';
import {LINEA_NAV_ITEMS} from '../../config/lineaNavItems';
afterEach(cleanup);
describe('Navegación animada',()=>{
 it('solo muestra las líneas autorizadas y permite volver desde el submenú',()=>{
  render(<MemoryRouter><SlideMenuLineas visibleLineas={['montada_sound']}/></MemoryRouter>);
  expect(screen.queryByRole('button',{name:'DJ'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'La Montada'}));
  expect(screen.getByRole('link',{name:'Presupuestos'}).getAttribute('href')).toBe('/lineas/montada-sound/presupuestos');
  fireEvent.click(screen.getByRole('button',{name:'Volver a líneas de negocio'}));
  expect(screen.getByRole('button',{name:'La Montada'})).toBeTruthy();
 });
 it('ajusta el ancho por teclado y conserva un enlace activo accesible',()=>{
  const click=vi.fn(e=>e.preventDefault());
  render(<Sidebar001><Sidebar001Content><Sidebar001Item href="/" label="Resumen" isActive onClick={click}/></Sidebar001Content></Sidebar001>);
  const resize=screen.getByRole('separator',{name:'Ancho de la barra lateral'});
  fireEvent.keyDown(resize,{key:'ArrowRight'});
  expect(resize.getAttribute('aria-valuenow')).toBe('256');
  fireEvent.click(screen.getByRole('link',{name:'Resumen'}));expect(click).toHaveBeenCalled();
  expect(screen.getByRole('link',{name:'Resumen'}).getAttribute('aria-current')).toBe('page');
 });
 it('expone Presupuestos únicamente en Sound e Installations',()=>{
  for(const [line,items] of Object.entries(LINEA_NAV_ITEMS))expect(items.some(i=>i.label==='Presupuestos')).toBe(['montada_sound','montada_installations'].includes(line));
 });
});
