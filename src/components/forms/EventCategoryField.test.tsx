import {useState} from 'react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {EventCategoryField} from './EventCategoryField';
import {normalizeEventCategory,eventCategoryOptions} from '../../lib/eventCategories';
vi.mock('../../store/useStore',()=>({useStore:(selector:(s:unknown)=>unknown)=>selector({gastosEvento:[{categoria:'Catering'}]})}));
afterEach(cleanup);
function Form({initial='DJ'}:{initial?:string}){const [category,setCategory]=useState(initial);return <><EventCategoryField value={category} onChange={setCategory}/><output aria-label="Resultado">{category}</output></>;}
describe('Categorías de evento',()=>{
 it('permite escribir y sugiere categorías guardadas',()=>{render(<Form/>);const input=screen.getByLabelText('Categoría del gasto') as HTMLInputElement;expect(document.querySelector('option[value="Catering"]')).toBeTruthy();fireEvent.change(input,{target:{value:'Hotel equipo'}});expect(screen.getByLabelText('Resultado').textContent).toBe('Hotel equipo');});
 it('conserva categorías antiguas al editar',()=>{render(<Form initial="Catering"/>);expect((screen.getByLabelText('Categoría del gasto') as HTMLInputElement).value).toBe('Catering');});
 it('normaliza antes de persistir y rechaza vacíos',()=>{expect(normalizeEventCategory('  Hotel   equipo ')).toBe('Hotel equipo');expect(()=>normalizeEventCategory(' ')).toThrow();expect(()=>normalizeEventCategory('a'.repeat(81))).toThrow();});
 it('recupera categorías guardadas sin duplicar mayúsculas',()=>{expect(eventCategoryOptions(['DJ','dj','Catering','catering']).filter(c=>c.toLowerCase()==='catering')).toEqual(['Catering']);});
});
