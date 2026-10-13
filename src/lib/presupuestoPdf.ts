import { jsPDF } from 'jspdf';
import { referenciaPresupuesto, totalesPresupuesto, validarPresupuesto, MARCA_MONTADA, type Presupuesto } from './presupuestos';

export function generarPresupuestoPdf(p: Presupuesto, logo?: Uint8Array): jsPDF {
  const invalid = validarPresupuesto(p.contenido, true); if (invalid) throw new Error(invalid);
  const c=p.contenido, marca=c.marca??MARCA_MONTADA, ref=referenciaPresupuesto(p);
  const doc=new jsPDF(); const brown=[75,56,54] as const;
  let y=20;
  const money=(n:number)=>n.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
  const font=(size=9,bold=false)=>{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(...brown);};
  const background=()=>{doc.setFillColor(250,248,245);doc.rect(0,0,210,297,'F');};
  const next=()=>{doc.addPage();background();y=20;font(12,true);doc.text(`PRESUPUESTO · ${ref}`,16,y);y+=11;};
  const ensure=(height:number)=>{if(y+height>258)next();};
  const block=(text:string,width=178,size=9,bold=false)=>{
    font(size,bold);for(const line of doc.splitTextToSize(text,width) as string[]){ensure(5);font(size,bold);doc.text(line,16,y);y+=5;}
  };
  background();font(27,true);doc.text('PRESUPUESTO',16,31);
  if(logo){
    // Original transparent 1563px artwork, positioned using its visible bounds.
    // The source pixels and colour are preserved, including transparent margins.
    const size=58*1563/1110;
    doc.addImage(logo,'PNG',136-228*size/1563,22-703*size/1563,size,size);
  }
  y=43;block(marca.nombre,113,10,true);block(`CIF: ${marca.nif}`,113,9);block(marca.direccion,113,9);
  y+=3;doc.setDrawColor(...brown);doc.setLineWidth(.8);doc.line(16,y,194,y);y+=8;
  const left=[`Fecha de emisión: ${c.fecha}`,`Fecha del evento: ${c.fechaEvento||'Pendiente de confirmar'}`,`Nº presupuesto: ${ref}`,`Válido hasta: ${c.validez}`];
  const right=[`Cliente: ${c.cliente}`,`Servicio: ${c.titulo}`,...(c.direccion?[c.direccion]:[])];
  font(9);
  const leftLines=left.flatMap(t=>doc.splitTextToSize(t,76) as string[]),rightLines=right.flatMap(t=>doc.splitTextToSize(t,76) as string[]);
  // Typical customer details fit side by side. Very long details use flowing blocks.
  const cardHeight=Math.max(leftLines.length,rightLines.length)*4.6+12;
  if(cardHeight<100){
    for(const [x,lines] of [[16,leftLines],[108,rightLines]] as const){doc.setFillColor(255,255,255);doc.setDrawColor(222,215,210);doc.setLineWidth(.25);doc.roundedRect(x,y,86,cardHeight,2,2,'FD');font(9);lines.forEach((line,i)=>doc.text(line,x+5,y+8+i*4.6));}
    y+=cardHeight+8;
  }else{for(const text of [...left,...right])block(text);y+=6;}
  const edges=[16,51,116,130,163,194];
  const header=()=>{ensure(12);doc.setFillColor(...brown);doc.rect(16,y,178,11,'F');font(8,true);doc.setTextColor(255,255,255);['CONCEPTO','DESCRIPCIÓN DETALLADA','UDS.','PRECIO','TOTAL'].forEach((t,i)=>doc.text(t,i<2?edges[i]+3:(edges[i]+edges[i+1])/2,y+7,{align:i<2?'left':'center'}));y+=11;};
  header();
  for(const item of c.conceptos){
    font(9,true);const names=doc.splitTextToSize(item.descripcion,29) as string[];
    font(9);const details=doc.splitTextToSize(item.detalle||'',59) as string[];
    const count=Math.max(names.length,details.length,1);let cursor=0;
    while(cursor<count){
      if(y+17>258){next();header();}
      const capacity=Math.max(1,Math.floor((258-y-8)/4.6));
      const take=Math.min(capacity,count-cursor);const height=Math.max(item.descuento?19:16,take*4.6+8);
      if(y+height>258){next();header();}
      doc.setFillColor(255,255,255);doc.rect(16,y,178,height,'F');doc.setDrawColor(223,217,212);doc.setLineWidth(.2);doc.line(16,y+height,194,y+height);
      font(9,true);names.slice(cursor,cursor+take).forEach((line,i)=>doc.text(line,19,y+6+i*4.6));
      font(9);details.slice(cursor,cursor+take).forEach((line,i)=>doc.text(line,54,y+6+i*4.6));
      if(cursor===0){
        doc.text(String(item.cantidad),123,y+6,{align:'center'});
        if(item.incluido){font(8,true);doc.text('INCLUIDO',191,y+6,{align:'right'});}
        else{font(9);doc.text(money(item.precio??0),160,y+6,{align:'right'});doc.text(money(Math.round((item.cantidad*((item.precio??0)-(item.descuento??0))+Number.EPSILON)*100)/100),191,y+6,{align:'right'});
          if(item.descuento){font(7);doc.text(`Dto./ud.: -${money(item.descuento)}`,160,y+12,{align:'right'});}}
      }
      y+=height;cursor+=take;
    }
  }
  y+=6;ensure(38);const t=totalesPresupuesto(c);
  doc.setFillColor(255,255,255);doc.setDrawColor(222,215,210);doc.roundedRect(105,y,89,38,2,2,'FD');
  font(10,true);doc.text('Total sin IVA',110,y+9);font(10);doc.text(money(t.base),189,y+9,{align:'right'});
  doc.text(`IVA (${c.iva}%)`,110,y+18);doc.text(money(t.iva),189,y+18,{align:'right'});
  doc.setDrawColor(...brown);doc.setLineWidth(.5);doc.line(109,y+23,190,y+23);
  font(14,true);doc.text('TOTAL',110,y+32);doc.text(money(t.total),189,y+32,{align:'right'});y+=49;
  if(c.notas){ensure(12);block('CONDICIONES',178,9,true);block(c.notas,178,9);}
  if(c.fotoMontaje){
    const photo=c.fotoMontaje;
    const scale=Math.min(178/photo.ancho,150/photo.alto);
    const width=photo.ancho*scale,height=photo.alto*scale;
    ensure(height+15);block('FOTO DEL MONTAJE',178,11,true);y+=3;
    doc.addImage(photo.dataUrl,'JPEG',16,y,width,height);
    y+=height+7;
  }
  for(let i=1;i<=doc.getNumberOfPages();i++){
    doc.setPage(i);doc.setDrawColor(222,215,210);doc.setLineWidth(.25);doc.line(16,269,194,269);
    font(8);doc.text(`Presupuesto válido hasta ${c.validez}.`,105,275,{align:'center'});
    font(7);const contact=[marca.telefono,marca.email,marca.web].filter(Boolean).join(' · ');
    const lines=doc.splitTextToSize(contact,178) as string[];lines.slice(0,2).forEach((line,k)=>doc.text(line,105,280+k*3.5,{align:'center'}));
    font(7);doc.text(`${ref} · No es una factura`,16,291);doc.text(`${i} / ${doc.getNumberOfPages()}`,194,291,{align:'right'});
  }
  return doc;
}
