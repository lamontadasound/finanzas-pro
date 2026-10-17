import {useState} from 'react';
import {useStore} from '../../../store/useStore';
import {resolveLinea} from '../../../config/resolveLinea';
import {useLineaFinance} from '../../../hooks/useLineaFinance';
import {LineaResumenView} from '../../../components/lineas/LineaResumenView';
export const InstallationsResumen=()=>{
 const [year,setYear]=useState(new Date().getFullYear());
 const incomes=useStore(s=>s.ingresos).filter(i=>resolveLinea(i)==='montada_installations');
 const expenses=useStore(s=>s.gastos).filter(g=>resolveLinea(g)==='montada_installations');
 const costs=useStore(s=>s.gastosEvento);
 const ing=incomes.filter(i=>i.fechaEvento.startsWith(String(year))),gas=expenses.filter(g=>g.fecha.startsWith(String(year)));
 const linked=costs.filter(g=>ing.some(i=>i.id===g.ingresoId));
 // Preserve the installation summary's original cost and pending definitions.
 const calc=useLineaFinance(ing,gas,linked.map(g=>({...g,importe:g.baseImponible??g.importe})));
 const pending=ing.reduce((n,i)=>n+Math.max(0,i.total-i.pagosRecibidos),0);
 const months=Array.from({length:12},(_,m)=>{const rows=ing.filter(i=>new Date(i.fechaEvento).getMonth()===m);return {cobrado:rows.reduce((n,i)=>n+i.total-Math.max(0,i.total-i.pagosRecibidos),0),pendiente:rows.reduce((n,i)=>n+Math.max(0,i.total-i.pagosRecibidos),0)};});
 const years=[year,new Date().getFullYear(),...incomes.map(i=>Number(i.fechaEvento.slice(0,4))),...expenses.map(g=>Number(g.fecha.slice(0,4)))];
 return <LineaResumenView year={year} allYears={years} onYearChange={setYear} finance={{...calc,pendiente:pending,cobrado:calc.facturacionConIva-pending}} months={months} ivaRecuperado={[...gas,...linked].reduce((n,g)=>n+(g.importeIVA??0),0)} eventLabel="Instalaciones"/>;
};
