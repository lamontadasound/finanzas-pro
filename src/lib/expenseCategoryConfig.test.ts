import {describe,it,expect} from 'vitest';
import {categoryColor,categoryOptions,DEFAULT_CATEGORIES} from './expenseCategoryConfig';
describe('Categorías configurables',()=>{
 it('conserva un color por nombre aunque cambie el orden de los datos',()=>{const categories=[{nombre:'Técnico',color:'#123456',general:true,evento:true}];expect(categoryColor('  técnico ',categories)).toBe('#123456');expect(categoryColor('Técnico',[...DEFAULT_CATEGORIES.filter(c=>c.nombre!=='Técnico'),...categories])).toBe('#123456');expect(categoryColor('Hotel')).toBe(categoryColor('hotel'));});
 it('combina configuración con histórico sin duplicados ni pérdidas',()=>{const categories=[{nombre:'Hotel',color:'#123456',general:false,evento:true}];expect(categoryOptions(categories,'general',['Personal'])).toEqual(['Personal']);expect(categoryOptions(categories,'evento',['hotel','Catering'])).toEqual(['Hotel','Catering']);});
});
