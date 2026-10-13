import {useState} from 'react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {EventCategoryField} from './EventCategoryField';
import {normalizeEventCategory,eventCategoryOptions} from '../../lib/eventCategories';
vi.mock('../../store/useStore',()=>({useStore:(selector:(s:unknown)=>unknown)=>selector({gastosEvento:[{categoria:'Catering'}]})}));
afterEach(cleanup);
function Form({initial='DJ'}:{initial?:string}){const [category,setCategory]=useState(initial);return <><EventCategoryField value={category} onChange={setCategory}/><output aria-label="Resultado">{category}</output></>;}
describe('Categorías de evento',()=>{
 it('ofrece solo las categorías de Configuración, sin escribir nuevas',()=>{render(<Form/>);const select=screen.getByLabelText('Categoría del gasto') as HTMLSelectElement;const values=[...select.options].map(o=>o.value);expect(values).toContain('Técnico');expect(values).not.toContain('Catering');expect(values).not.toContain('__custom__');fireEvent.change(select,{target:{value:'Técnico'}});expect(screen.getByLabelText('Resultado').textContent).toBe('Técnico');});
 it('conserva la categoría de un gasto antiguo al editarlo',()=>{render(<Form initial="Catering"/>);const select=screen.getByLabelText('Categoría del gasto') as HTMLSelectElement;expect(select.value).toBe('Catering');});
 it('normaliza antes de persistir y rechaza vacíos',()=>{expect(normalizeEventCategory('  Hotel   equipo ')).toBe('Hotel equipo');expect(()=>normalizeEventCategory(' ')).toThrow();expect(()=>normalizeEventCategory('a'.repeat(81))).toThrow();});
 it('recupera categorías guardadas sin duplicar mayúsculas',()=>{expect(eventCategoryOptions(['DJ','dj','Catering','catering']).filter(c=>c.toLowerCase()==='catering')).toEqual(['Catering']);});
});
