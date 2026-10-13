import {useState} from 'react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {EventCategoryField} from './EventCategoryField';
import {normalizeEventCategory,eventCategoryOptions} from '../../lib/eventCategories';
vi.mock('../../store/useStore',()=>({useStore:(selector:(s:unknown)=>unknown)=>selector({gastosEvento:[{categoria:'Catering'}]})}));
afterEach(cleanup);
function Form(){const [category,setCategory]=useState('DJ');return <><EventCategoryField value={category} onChange={setCategory}/><output aria-label="Resultado">{category}</output></>;}
describe('Categorías de evento',()=>{
 it('permite cambiar una categoría y reutilizar una guardada',()=>{render(<Form/>);fireEvent.change(screen.getByLabelText('Categoría del gasto'),{target:{value:'Catering'}});expect(screen.getByLabelText('Resultado').textContent).toBe('Catering');});
 it('permite escribir una nueva sin perderla durante la edición',()=>{render(<Form/>);fireEvent.change(screen.getByLabelText('Categoría del gasto'),{target:{value:'__custom__'}});fireEvent.change(screen.getByLabelText('Nombre de la categoría'),{target:{value:'Alojamiento'}});expect(screen.getByLabelText('Resultado').textContent).toBe('Alojamiento');expect(screen.getByLabelText('Nombre de la categoría')).toBeTruthy();});
 it('normaliza antes de persistir y rechaza vacíos',()=>{expect(normalizeEventCategory('  Hotel   equipo ')).toBe('Hotel equipo');expect(()=>normalizeEventCategory(' ')).toThrow();expect(()=>normalizeEventCategory('a'.repeat(81))).toThrow();});
 it('recupera categorías guardadas sin duplicar mayúsculas',()=>{expect(eventCategoryOptions(['DJ','dj','Catering','catering']).filter(c=>c.toLowerCase()==='catering')).toEqual(['Catering']);});
});
