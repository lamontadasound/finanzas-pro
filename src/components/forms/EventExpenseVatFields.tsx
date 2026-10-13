import {eventExpenseVat} from '../../lib/eventExpensePayment';
import type {GastoEvento} from '../../types';
const money=(n:number)=>n.toLocaleString('es-ES',{style:'currency',currency:'EUR',useGrouping:'always'} as Intl.NumberFormatOptions);

/** Base + IVA + total. Los gastos antiguos sin desglose se muestran con su
 *  importe como base al 0 % (mismo criterio que los cálculos de beneficio). */
export function EventExpenseVatFields({value,onChange}:{value:Partial<GastoEvento>;onChange:(p:Partial<GastoEvento>)=>void}){
 const base=value.baseImponible??((value.importe??0)-(value.importeIVA??0));
 const rate=value.porcentajeIVA??0;
 return <div className="col-span-2 field-wide grid sm:grid-cols-3 gap-3">
  <label className="field"><span className="field-label">Total sin IVA</span><input aria-label="Total sin IVA del gasto" className="input-form num" type="number" inputMode="decimal" min="0" step="0.01" value={base||''} onChange={e=>onChange(eventExpenseVat(Number(e.target.value),rate))}/></label>
  <label className="field"><span className="field-label">IVA</span><select aria-label="IVA del gasto" className="input-form" value={rate} onChange={e=>onChange(eventExpenseVat(base,Number(e.target.value)))}>{[0,4,10,21].map(n=><option key={n} value={n}>{n}%</option>)}</select></label>
  <div className="field"><span className="field-label">Total con IVA</span><div className="readout">{money(value.totalConIva??value.importe??0)}</div></div>
 </div>;
}
