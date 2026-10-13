import type {GastoEvento,PaymentMethod} from '../types';
export const EXPENSE_PAYMENT_METHODS: [PaymentMethod,string][]=[['transferencia','Transferencia'],['efectivo','Efectivo'],['bizum','Bizum'],['tarjeta','Tarjeta'],['cheque','Cheque'],['otro','Otro']];
export function expensePaymentLabel(g:Partial<GastoEvento>){return `${g.estadoPago==='pagado'?'Pagado':g.estadoPago==='pendiente'?'Pendiente':'Pago sin indicar'}${g.metodoPago?' · '+(EXPENSE_PAYMENT_METHODS.find(([id])=>id===g.metodoPago)?.[1]??g.metodoPago):''}`;}

export function eventExpenseVat(base:number,rate:number){const iva=Math.round((base*rate/100+Number.EPSILON)*100)/100;const total=Math.round((base+iva)*100)/100;return {baseImponible:base,porcentajeIVA:rate,importeIVA:iva,totalConIva:total,importe:total};}
