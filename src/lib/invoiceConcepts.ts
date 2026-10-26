export type InvoiceConcept={id:string;descripcion:string;detalle?:string;cantidad:number;precio:number;descuento:number;suplido?:boolean};
export const roundMoney=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
export const conceptAmount=(c:InvoiceConcept)=>roundMoney(c.cantidad*(c.precio-c.descuento));
export const newInvoiceConcept=():InvoiceConcept=>({id:crypto.randomUUID(),descripcion:'',cantidad:1,precio:0,descuento:0});
// Human-readable detail is stored in the existing immutable concepto field,
// so exports, server snapshots and Drive retain all quantities and prices.
export function serializeConcepts(rows:InvoiceConcept[]):string{return rows.map(c=>`${c.descripcion.trim()}${c.detalle?.trim()?`\nDescripción: ${c.detalle.trim()}`:''}\n[${c.cantidad} x ${c.precio.toFixed(2)} EUR; descuento/u ${c.descuento.toFixed(2)} EUR; total ${conceptAmount(c).toFixed(2)} EUR${c.suplido?'; suplido':''}]`).join('\n\n');}
export function parseConcepts(text:string):InvoiceConcept[]|null{
 const re=/([\s\S]*?)\n\[([\d.]+) x ([\d.]+) EUR; descuento\/u ([\d.]+) EUR; total ([\d.]+) EUR(; suplido)?\](?:\n\n|$)/g;const rows:InvoiceConcept[]=[];let end=0;
 for(const match of text.matchAll(re)){if(match.index!==end)return null;const parts=match[1].trim().split('\nDescripción: ');const c={id:`line-${rows.length}`,descripcion:parts[0],...(parts.length>1?{detalle:parts.slice(1).join('\nDescripción: ')}:{}),cantidad:Number(match[2]),precio:Number(match[3]),descuento:Number(match[4]),...(match[6]?{suplido:true}:{})};if(!c.descripcion||!Number.isFinite(conceptAmount(c))||Math.abs(conceptAmount(c)-Number(match[5]))>.001)return null;rows.push(c);end=match.index+match[0].length;}
 return rows.length&&end===text.length?rows:null;
}

export function invoiceAmounts(rows:InvoiceConcept[],iva:number){const base=roundMoney(rows.filter(c=>!c.suplido).reduce((s,c)=>s+conceptAmount(c),0)),suplidos=roundMoney(rows.filter(c=>c.suplido).reduce((s,c)=>s+conceptAmount(c),0)),tax=roundMoney(base*iva/100);return {base,suplidos,tax,total:roundMoney(base+tax+suplidos)};}
