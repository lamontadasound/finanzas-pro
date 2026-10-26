export const REAL_MADRID_REFERENCE = '2526SER4531032474';
export function matchInvoiceDescription(date:string,match:string):string {
 const parsed=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
 if(!parsed||!match.trim())throw Error('Indica la fecha del evento y el partido.');
 const [,year,month,day]=parsed;
 const value=new Date(Date.UTC(Number(year),Number(month)-1,Number(day)));
 if(value.toISOString().slice(0,10)!==date)throw Error('La fecha del evento no es válida.');
 const months=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
 return `FECHA EVENTO: ${Number(day)} ${months[Number(month)-1]} ${year} ${match.trim()}`;
}
