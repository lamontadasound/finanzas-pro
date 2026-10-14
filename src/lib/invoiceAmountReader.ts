export type InvoiceAmounts = {base:number|null;iva:number|null;total:number|null;retencion:number;estado:'leido'|'pendiente';nota:string;evidencia:string};
const round=(n:number)=>Math.round(n*100)/100;
export function parseMoney(raw:string):number|null{
 let s=raw.replace(/[€\s]/g,'');
 if(!/^-?\d[\d.,]*$/.test(s))return null;
 if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
 else if(/[,\.]\d{2}$/.test(s))s=s.replace(',','.');
 else if(/[,.]/.test(s))return null; // Ambiguous grouping is not a decimal amount.
 const n=Number(s);return Number.isFinite(n)&&Math.abs(n)<1e10?round(n):null;
}
export function readInvoiceAmounts(text:string):InvoiceAmounts{
 const values:{base:number[];iva:number[];total:number[];retencion:number[]}={base:[],iva:[],total:[],retencion:[]};
 const evidence:string[]=[];
 const lines=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').split(/\r?\n/);
 let uncertain=/\b(recargo|suplidos|anticipo|portes)\b/i.test(text);
 for(let i=0;i<lines.length;i++){
  const line=lines[i].trim();
  let key:keyof typeof values|null=null;
  if(/\b(base imponible|total (?:sin iva|neto)|taxable (?:base|amount)|net amount)\b/i.test(line))key='base';
  else if(/\b(retencion|irpf|withholding)\b/i.test(line))key='retencion';
  else if(/\b(total (?:iva|impuestos)|cuota (?:iva|tributaria)|iva|vat|tax amount)\b/i.test(line)&&!/(incluid|incl\.|included|sin iva|exclu)/i.test(line))key='iva';
  else if(/^(?:importe\s+)?total\b|\b(total (?:factura|a pagar)|importe total|grand total|amount due)\b/i.test(line)&&!/(subtotal|sin iva|neto)/i.test(line))key='total';
  if(!key)continue;
  // Never treat VAT percentages, dates or invoice numbers as amounts.
  let candidate=line.replace(/-?\d+(?:[.,]\d+)?\s*%/g,'');
  if(!/\d/.test(candidate)&&i+1<lines.length&&/^\s*-?[\d.,]+\s*(?:€|EUR)?\s*$/i.test(lines[i+1]))candidate+=' '+lines[i+1];
  const numbers=[...candidate.matchAll(/(?<![\w/])-?\d[\d.,]*(?![\w/])/g)].map(m=>parseMoney(m[0])).filter((n):n is number=>n!==null);
  if(candidate.includes('?')){uncertain=true;continue;}
  if(numbers.length===1){values[key].push(numbers[0]);evidence.push(line);}
  else if(numbers.length>1)uncertain=true;
 }
 const unique=(key:keyof typeof values)=>{const ns=[...new Set(values[key])];if(ns.length>1)uncertain=true;return ns.length===1?ns[0]:null;};
 let base=unique('base'),iva=unique('iva'),total=unique('total');const retention=unique('retencion');
 const hasRetention=/\b(retencion|irpf|withholding)\b/i.test(text.normalize('NFD').replace(/[\u0300-\u036f]/g,''));
 const retencion=retention===null?0:Math.abs(retention);
 if(hasRetention&&retention===null)uncertain=true;
 // Derive only from two explicit amounts, never by assuming a tax rate.
 if(!uncertain){
  if(base===null&&iva!==null&&total!==null)base=round(total+retencion-iva);
  if(iva===null&&base!==null&&total!==null&&/\b(iva|vat)\b/i.test(text))iva=round(total+retencion-base);
  if(total===null&&base!==null&&iva!==null)total=round(base+iva-retencion);
 }
 const complete=!uncertain&&base!==null&&iva!==null&&total!==null&&Math.abs(base+iva-retencion-total)<=0.05;
 const missing=[base===null?'total sin IVA':'',iva===null?'IVA':'',total===null?'total a pagar':''].filter(Boolean);
 return {base,iva,total,retencion,estado:complete?'leido':'pendiente',nota:complete?'':uncertain?'Hay cifras ambiguas o varios importes: revisa el desglose.':missing.length?`No se ha podido identificar: ${missing.join(', ')}.`:'Los importes no cuadran: revisa el desglose.',evidencia:evidence.join('\n').slice(0,4000)};
}
