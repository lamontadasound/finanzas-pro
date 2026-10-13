import {parseConcepts,conceptAmount,invoiceAmounts} from './invoiceConcepts';
import { jsPDF } from 'jspdf';
import { BRAND_LOGO } from './brandLogo';
import type { ConfiguracionFiscal, Cliente, Factura } from '../types';
export interface FacturaPdfInput {
 factura: Pick<Factura,'numero'|'fecha'|'concepto'|'baseImponible'|'importeIVA'|'porcentajeIVA'|'retencion'|'total'|'porcentajeFacturado'|'notas'|'fechaEvento'>;
 fechaEvento?: string;
 configuracionFiscal: Partial<ConfiguracionFiscal> | null;
 cliente: Partial<Cliente> & {nombre:string};
}
export function generarFacturaPdf(input:FacturaPdfInput):jsPDF {
 const {factura:f,cliente,configuracionFiscal:cf}=input;
 const fechaEvento=input.fechaEvento||f.fechaEvento;
 const montada=cf?.nifCif?.replace(/\s/g,'').toUpperCase()==='B21642913';
 const iban=cf?.iban||(montada?'ES82 0182 1941 7302 0172 1518':'');
 const web=cf?.web||(montada?'www.lamontada.es':'');
 const doc=new jsPDF();const brown=[75,56,54] as const;let y=20;
 doc.setCreationDate(new Date(f.fecha+'T12:00:00Z'));
 let hash=2166136261;for(const c of JSON.stringify({numero:f.numero,fecha:f.fecha,concepto:f.concepto,base:f.baseImponible,iva:f.importeIVA,pctIVA:f.porcentajeIVA,retencion:f.retencion,total:f.total,porcentaje:f.porcentajeFacturado,notas:f.notas,configuracionFiscal:cf,cliente,fechaEvento}))hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
 doc.setFileId(hash.toString(16).padStart(8,'0').repeat(4));
 const money=(n:number)=>n.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
 const font=(size=9,bold=false)=>{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(...brown);};
 const bg=()=>{doc.setFillColor(250,248,245);doc.rect(0,0,210,297,'F');};
 const next=()=>{doc.addPage();bg();y=22;font(12,true);doc.text(`FACTURA · ${f.numero||'VISTA PREVIA'}`,16,y);y+=12;};
 const ensure=(height:number)=>{if(y+height>258)next();};
 const block=(text:string,size=9,bold=false)=>{font(size,bold);for(const line of doc.splitTextToSize(text,178) as string[]){ensure(5);font(size,bold);doc.text(line,16,y);y+=5;}};
 bg();font(27,true);doc.text('FACTURA',16,31);
 const logoSize=58*1563/1110;doc.addImage(BRAND_LOGO,'PNG',136-228*logoSize/1563,22-703*logoSize/1563,logoSize,logoSize);
 y=43;block(cf?.razonSocial||'[Emisor pendiente]',10,true);block(`CIF: ${cf?.nifCif||'[Pendiente]'}`);block(cf?.direccionFiscal||'[Dirección pendiente]');
 y+=3;doc.setDrawColor(...brown);doc.setLineWidth(.8);doc.line(16,y,194,y);y+=8;
 const left=[`Fecha de emisión: ${f.fecha}`,`Nº factura: ${f.numero||'VISTA PREVIA'}`,...(fechaEvento?[`Fecha del evento: ${fechaEvento}`]:[]),...(f.porcentajeFacturado!=null&&f.porcentajeFacturado<100?[`Porcentaje facturado: ${f.porcentajeFacturado}%`]:[])];
 const right=[`Cliente: ${cliente.nombre}`,`NIF / CIF: ${cliente.nifCif||'[Pendiente]'}`,cliente.direccion||'[Dirección pendiente]'];
 font();const a=left.flatMap(t=>doc.splitTextToSize(t,76) as string[]),b=right.flatMap(t=>doc.splitTextToSize(t,76) as string[]);const height=Math.max(a.length,b.length)*4.6+12;
 if(height<100){for(const [x,lines] of [[16,a],[108,b]] as const){doc.setFillColor(255,255,255);doc.setDrawColor(222,215,210);doc.setLineWidth(.25);doc.roundedRect(x,y,86,height,2,2,'FD');font();lines.forEach((line,i)=>doc.text(line,x+5,y+8+i*4.6));}y+=height+8;}
 else{for(const t of [...left,...right])block(t);y+=6;}
 const concepts=parseConcepts(f.concepto);
 const suplidos=concepts?invoiceAmounts(concepts,f.porcentajeIVA).suplidos:0;
 if(concepts&&Math.abs(concepts.filter(c=>!c.suplido).reduce((sum,c)=>sum+conceptAmount(c),0)-f.baseImponible)<.01){
  const header=()=>{ensure(16);doc.setFillColor(...brown);doc.rect(16,y,178,11,'F');font(8,true);doc.setTextColor(255,255,255);doc.text('CONCEPTO',19,y+7);doc.text('UDS.',111,y+7,{align:'right'});doc.text('PRECIO',138,y+7,{align:'right'});doc.text('DTO./UD.',165,y+7,{align:'right'});doc.text('TOTAL',191,y+7,{align:'right'});y+=11;};
  header();
  for(const c of concepts){font();const lines=doc.splitTextToSize(c.descripcion+(c.suplido?' · Suplido (sin IVA)':''),80) as string[];for(let i=0;i<lines.length;i++){if(y+9>258){next();header();}doc.setFillColor(255,255,255);doc.rect(16,y,178,7,'F');font(8);doc.text(lines[i],19,y+5);if(i===0){doc.text(String(c.cantidad),111,y+5,{align:'right'});doc.text(money(c.precio),138,y+5,{align:'right'});doc.text(money(c.descuento),165,y+5,{align:'right'});doc.text(money(conceptAmount(c)),191,y+5,{align:'right'});}y+=7;}doc.setDrawColor(222,215,210);doc.line(16,y,194,y);}
 }else{
 const header=()=>{ensure(16);doc.setFillColor(...brown);doc.rect(16,y,178,11,'F');font(8,true);doc.setTextColor(255,255,255);doc.text('CONCEPTO / DESCRIPCIÓN',19,y+7);doc.text('IMPORTE',191,y+7,{align:'right'});y+=11;};
 header();font();const lines=doc.splitTextToSize(f.concepto||'[Concepto pendiente]',133) as string[];
 for(let i=0;i<lines.length;i++){
  if(y+10>258){next();header();}doc.setFillColor(255,255,255);doc.rect(16,y,178,7,'F');font();doc.text(lines[i],19,y+5);
  if(i===0)doc.text(money(f.baseImponible),191,y+5,{align:'right'});y+=7;
 }
 }
 y+=8;const totals=[['Total sin IVA',f.baseImponible],[`IVA (${f.porcentajeIVA}%)`,f.importeIVA],...(suplidos?[['Suplidos (sin IVA)',suplidos]]:[]),...(f.retencion?[['Retención',-f.retencion]]:[])] as [string,number][];
 const boxHeight=totals.length*9+20;ensure(boxHeight+8);doc.setFillColor(255,255,255);doc.setDrawColor(222,215,210);doc.roundedRect(105,y,89,boxHeight,2,2,'FD');
 totals.forEach(([label,value],i)=>{font(10,i===0);doc.text(label,110,y+9+i*9);font(10);doc.text(money(value),189,y+9+i*9,{align:'right'});});
 doc.setDrawColor(...brown);doc.setLineWidth(.5);doc.line(109,y+totals.length*9+5,190,y+totals.length*9+5);
 font(14,true);doc.text('TOTAL',110,y+boxHeight-5);doc.text(money(f.total-(f.retencion??0)),189,y+boxHeight-5,{align:'right'});y+=boxHeight+12;
 if(iban||cf?.condicionesPago){ensure(18);block('INFORMACIÓN PARA EL PAGO',9,true);if(iban)block(`IBAN: ${iban}`);if(cf?.condicionesPago)block(cf.condicionesPago);y+=5;}
 if(f.notas){ensure(12);block('OBSERVACIONES',9,true);block(f.notas);}
 if(cf?.textoLegal){y+=4;block(cf.textoLegal,8);}
 for(let page=1;page<=doc.getNumberOfPages();page++){
  doc.setPage(page);doc.setDrawColor(222,215,210);doc.setLineWidth(.25);doc.line(16,270,194,270);font(8);
  const contacts=[cf?.telefono,cf?.email,web].filter(Boolean).join(' · ');const wrapped=doc.splitTextToSize(contacts,178) as string[];
  wrapped.slice(0,2).forEach((line,i)=>doc.text(line,105,275+i*4,{align:'center'}));if(iban)doc.text(`IBAN: ${iban}`,105,284,{align:'center'});font(7);doc.text(`Factura ${f.numero||'VISTA PREVIA'}`,16,291);doc.text(`${page} / ${doc.getNumberOfPages()}`,194,291,{align:'right'});
 }
 return doc;
}
export function facturaPdfBlobUrl(input:FacturaPdfInput):string{return URL.createObjectURL(generarFacturaPdf(input).output('blob'));}
