import {jsPDF} from 'jspdf';
import {BRAND_LOGO} from './brandLogo';
export const TIPOS_CONTRATO={boda:'Bodas',corporativo:'Eventos corporativos',alquiler:'Alquileres'} as const;
export const CONDICIONES_BASE:Record<keyof typeof TIPOS_CONTRATO,string>={
 boda:'La Montada Sound prestará los servicios detallados para la boda en el lugar, fecha y horario indicados. Las partes coordinarán previamente el acceso, montaje, pruebas y desmontaje con la persona de contacto designada. Los cambios de servicios, horarios o precio se acordarán por escrito. Los servicios adicionales se presupuestarán por separado. Las condiciones específicas de cambio de fecha o cancelación que se pacten se incorporarán a este documento, sin limitar los derechos legalmente aplicables.',
 corporativo:'La Montada Sound prestará los servicios audiovisuales descritos en el lugar, fecha y horario indicados. La persona de contacto de la entidad coordinará los accesos y la información necesaria para el montaje y las pruebas. Cualquier modificación del alcance, horario o precio se acordará por escrito. Los servicios adicionales se presupuestarán por separado. Las condiciones específicas de cambio de fecha o cancelación que se pacten se incorporarán a este documento, sin limitar los derechos legalmente aplicables.',
 alquiler:'El alquiler comprende exclusivamente el material, cantidades, accesorios y periodo detallados en este documento. Las partes comprobarán el inventario y el estado del material en la entrega y en la devolución, dejando constancia de las incidencias. El material se utilizará conforme a sus instrucciones y se devolverá en el lugar y plazo acordados. Cualquier ampliación del periodo o cambio de material se acordará por escrito. Las condiciones de fianza, transporte y cancelación, cuando existan, se especificarán en este documento, sin limitar los derechos legalmente aplicables.'
};
export type ContractData={plantillaReferencia?:boolean;duracion?:string;fechaFirma?:string;cliente:string;nif:string;direccion:string;contacto:string;email:string;telefono:string;fecha:string;lugar:string;horario:string;servicios:string;base:number;iva:number;pago:string;condiciones:string;devolucion:string;fianza:string;representante:string;pareja:string;emisor:string;nifEmisor:string;direccionEmisor:string};
export type SoundContract={id:string;tipo:keyof typeof TIPOS_CONTRATO;titulo:string;contenido:ContractData;created_at?:string};
export const contractTotal=(c:ContractData)=>Math.round((c.base+Math.round(c.base*c.iva)/100)*100)/100;
export function contratoPdf(c:SoundContract){
 if(c.contenido.plantillaReferencia)return contratoReferenciaPdf(c);
 const d=new jsPDF({compress:true}),v=c.contenido;let y=24;const brown=[75,56,54] as const;
 const page=()=>{d.setFillColor(250,248,245);d.rect(0,0,210,297,'F');};page();
 const line=(text:string,size=10,bold=false)=>{d.setFont('helvetica',bold?'bold':'normal');d.setFontSize(size);d.setTextColor(...brown);for(const t of d.splitTextToSize(text,174) as string[]){if(y>262){d.addPage();page();y=24;}d.text(t,18,y);y+=5;}y+=2;};
 d.setFont('helvetica','bold');d.setFontSize(23);d.setTextColor(...brown);d.text('CONTRATO',18,y);const scale=48*1563/1110;d.addImage(BRAND_LOGO,'PNG',143-228*scale/1563,18-703*scale/1563,scale,scale);y=42;
 line(TIPOS_CONTRATO[c.tipo].toUpperCase(),10,true);line(c.titulo,12,true);line(`Referencia: CT-${c.id.slice(0,8).toUpperCase()}`,8);
 line('PARTES',11,true);line(`${v.emisor} · ${v.nifEmisor}\n${v.direccionEmisor}`);line(`Cliente: ${v.cliente}\nNIF/CIF: ${v.nif}\nDirección: ${v.direccion}`);
 if(v.representante)line(`Representante: ${v.representante}`);if(v.pareja&&c.tipo==='boda')line(`Contrayentes: ${v.pareja}`);
 line(`Contacto: ${[v.contacto,v.email,v.telefono].filter(Boolean).join(' · ')}`);
 line('SERVICIO CONTRATADO',11,true);line(`Fecha: ${v.fecha}\nLugar: ${v.lugar}\nHorario: ${v.horario}`);line(v.servicios);
 const euro=(n:number)=>n.toLocaleString('es-ES',{style:'currency',currency:'EUR',useGrouping:'always'} as Intl.NumberFormatOptions);
 line('IMPORTE Y PAGO',11,true);line(`Total sin IVA: ${euro(v.base)}\nIVA (${v.iva}%): ${euro(Math.round(v.base*v.iva)/100)}\nTotal con IVA: ${euro(contractTotal(v))}`);line(v.pago);
 if(c.tipo==='alquiler'){line('ENTREGA Y DEVOLUCIÓN',11,true);line(v.devolucion);if(v.fianza)line(`Fianza: ${v.fianza}`);}
 if(y+(d.splitTextToSize(v.condiciones,174) as string[]).length*5+60>274){d.addPage();page();y=24;}
 line('CONDICIONES ACORDADAS',11,true);line(v.condiciones);
 if(y>230){d.addPage();page();y=24;}line('FIRMAS',11,true);line('Las partes confirman los servicios, importes y condiciones recogidos en este documento.',9);y+=16;d.setDrawColor(...brown);d.line(18,y,93,y);d.line(115,y,190,y);y+=6;d.setFontSize(9);d.text('LA MONTADA SOUND SL',18,y);d.text('CLIENTE',115,y);y+=8;d.text('Lugar y fecha: __________________________',18,y);
 for(let p=1;p<=d.getNumberOfPages();p++){d.setPage(p);d.setFontSize(8);d.text(`CT-${c.id.slice(0,8).toUpperCase()} · ${p} / ${d.getNumberOfPages()}`,18,286);}
 return d;
}

function contratoReferenciaPdf(c:SoundContract){
 const d=new jsPDF({compress:true}),v=c.contenido,brown=[75,56,54] as const;let y=0;
 const header=()=>{d.setFillColor(255,255,255);d.rect(0,0,210,297,'F');d.setFillColor(...brown);d.rect(8,0,1.7,297,'F');const size=58*1563/1110;d.addImage(BRAND_LOGO,'PNG',21-228*size/1563,12-703*size/1563,size,size);y=48;};
 const next=()=>{d.addPage();header();};header();
 const text=(value:string,bold=false,size=10)=>{d.setFont('helvetica',bold?'bold':'normal');d.setFontSize(size);d.setTextColor(28,28,28);for(const line of d.splitTextToSize(value,166) as string[]){if(y>268)next();d.text(line,26,y);y+=4.8;}y+=3;};
 const section=(title:string,body:string)=>{if(y>248)next();text(title,true);text(body);y+=2;};
 const money=(n:number)=>n.toLocaleString('es-ES',{style:'currency',currency:'EUR',useGrouping:'always'} as Intl.NumberFormatOptions);
 text(c.tipo==='alquiler'?'CONTRATO DE ALQUILER DE EQUIPOS AUDIOVISUALES':'CONTRATO DE SERVICIOS AUDIOVISUALES PARA EVENTOS',true,11);
 y+=3;text(`Entre ${v.emisor}, con domicilio en ${v.direccionEmisor}, y NIF ${v.nifEmisor}, en adelante "La Montada Sound", y ${v.cliente}, con NIF/DNI ${v.nif}, domicilio en ${v.direccion}, en adelante "El Cliente".`);
 if(v.representante)text(`Representante: ${v.representante}`);
 section('1. OBJETO DEL CONTRATO',c.tipo==='alquiler'?'La Montada proporciona en alquiler el equipo detallado en el Anexo I, para el periodo, lugar y condiciones de entrega y devolución allí indicados.':'La Montada se compromete a proporcionar servicios de montaje audiovisual, sonido e iluminación, incluyendo montaje y desmontaje del equipo, para el evento organizado por El Cliente, en la fecha y lugar indicados en el Anexo I. Los detalles específicos de los servicios contratados estarán reflejados en dicho anexo.');
 section('2. PRECIO Y FORMA DE PAGO',`El precio total del servicio es de ${money(v.base)} + ${money(Math.round(v.base*v.iva)/100)} de IVA (${v.iva}%), total ${money(contractTotal(v))}.\n${v.pago}`);
 const sections=v.condiciones.split(/\n\n(?=\d+\. )/);
 for(const value of sections){const boundary=value.indexOf('\n');const heading=boundary>=0?value.slice(0,boundary):'CONDICIONES ACORDADAS';if(heading.startsWith('5.'))next();section(heading,boundary>=0?value.slice(boundary+1):value);}
 if(y>219)next();text(`En prueba de conformidad, ambas partes firman el presente contrato. Fecha: ${v.fechaFirma||'________________'}.`);y+=17;
 d.setDrawColor(...brown);d.line(26,y,98,y);d.line(119,y,191,y);y+=6;d.setFontSize(9);d.text('LA MONTADA SOUND SL',26,y);d.text('EL CLIENTE',119,y);y+=5;d.text(v.cliente.slice(0,38),119,y);
 next();text('ANEXO I - DETALLES DEL EVENTO',true,12);y+=4;
 text(`Fecha del evento: ${v.fecha}\nUbicación: ${v.lugar}\nHorario: ${v.horario}${v.duracion?'\nDuración estimada: '+v.duracion:''}`);
 if(v.pareja)text(`Contrayentes: ${v.pareja}`);
 text(`Contacto: ${[v.contacto,v.telefono,v.email].filter(Boolean).join(' · ')}`);y+=4;section('SERVICIOS Y EQUIPO CONTRATADO',v.servicios);
 if(c.tipo==='alquiler'){section('ENTREGA Y DEVOLUCIÓN',v.devolucion);if(v.fianza)text(`Fianza: ${v.fianza}`);}
 for(let p=1;p<=d.getNumberOfPages();p++){d.setPage(p);d.setFont('helvetica','normal');d.setFontSize(8);d.setTextColor(...brown);d.text(`CT-${c.id.slice(0,8).toUpperCase()} · ${p} / ${d.getNumberOfPages()}`,26,288);}
 return d;
}
