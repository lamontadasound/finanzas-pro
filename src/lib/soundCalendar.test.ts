import {it,expect} from 'vitest';
import {monthDays,soundCalendarEvents} from './soundCalendar';
import type {Evento,Ingreso} from '../types';
it('muestra solo Sound y evita repetir eventos enlazados con ingresos',()=>{
 const incomes=[{id:'i',lineaNegocio:'montada_sound',fechaEvento:'2026-10-22',eventoId:'linked',concepto:'Boda'},{id:'dj',lineaNegocio:'dj',fechaEvento:'2026-10-23'},{id:'installation',lineaNegocio:'montada_installations',eventoId:'installation-event'}] as Ingreso[];
 const events=[{id:'linked',area:'montada',fecha:'2026-10-22'},{id:'standalone',area:'montada',fecha:'2026-10-23',nombre:'Fiesta'},{id:'installation-event',area:'montada',fecha:'2026-10-24'}] as Evento[];
 expect(soundCalendarEvents(incomes,events).map(e=>e.id)).toEqual(['income:i','event:standalone']);
});
it('ordena por fecha y admite varios eventos en un día',()=>{
 const rows=[{id:'b',lineaNegocio:'montada_sound',fechaEvento:'2026-10-22',concepto:'B'},{id:'a',lineaNegocio:'montada_sound',fechaEvento:'2026-10-22',concepto:'A'}] as Ingreso[];
 expect(soundCalendarEvents(rows,[]).map(e=>e.id)).toEqual(['income:a','income:b']);
});
it('cuadrícula de lunes a domingo con febrero bisiesto y cambios de año',()=>{
 expect(monthDays(2024,1).filter(d=>d.inMonth)).toHaveLength(29);
 expect(monthDays(2026,0)[0].date).toBe('2025-12-29');
 expect(monthDays(2026,11).at(-1)?.date).toBe('2027-01-10');
});
