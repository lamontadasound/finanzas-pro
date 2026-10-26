import type {Ingreso} from '../types';
import {newInvoiceConcept} from './invoiceConcepts';
export const REAL_MADRID_BILLING={nombre:'REAL MADRID CLUB DE FÚTBOL',nifCif:'G28034718',direccion:'AVENIDA DE CONCHA ESPINA, No 1 28028 - MADRID'};
export const REAL_MADRID_REFERENCE = '2627SER4531032474';
export function matchInvoiceDescription(date:string,match:string):string {
 const parsed=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
 if(!parsed||!match.trim())throw Error('Indica la fecha del evento y el partido.');
 const [,year,month,day]=parsed;
 const value=new Date(Date.UTC(Number(year),Number(month)-1,Number(day)));
 if(value.toISOString().slice(0,10)!==date)throw Error('La fecha del evento no es válida.');
 const months=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
 return `FECHA EVENTO: ${Number(day)} ${months[Number(month)-1]} ${year} ${match.trim()}`;
}

export const REAL_MADRID_CONCEPT='L.ESTE (AFFINITY) + DJ JULIA CENTENO Y L.OESTE + DJ CARLOS';
export const REAL_MADRID_DETAIL='DJ Julia Centeno, DJ Carlos Fernández, 2 x Mesa Mezclas (Pioneer), 48 x Focos Wash White, 2 x Cabina DJ, 4 x JBL PRX ONE, Técnico';
export function realMadridConcept(ingreso:Ingreso){return {...newInvoiceConcept(),descripcion:REAL_MADRID_CONCEPT,detalle:matchInvoiceDescription(ingreso.fechaEvento,ingreso.concepto)+'\n'+REAL_MADRID_DETAIL,precio:ingreso.baseImponible};}
