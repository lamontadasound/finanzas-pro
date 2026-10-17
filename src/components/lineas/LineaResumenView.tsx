import type {ReactNode} from 'react';
import type {LineaFinanceResult} from '../../hooks/useLineaFinance';
import {PageHeader,YearStepper,Widget,Metric,Money,SplitBar} from '../kit';
import {MonthlyBars} from '../kit/MonthlyBars';
export function LineaResumenView({year,allYears,onYearChange,finance:m,months,ivaRecuperado,eventLabel,children}:{year:number;allYears:number[];onYearChange:(y:number)=>void;finance:LineaFinanceResult;months:{cobrado:number;pendiente:number}[];ivaRecuperado:number;eventLabel:string;children?:ReactNode}){
 return <div><PageHeader title="Resumen"><YearStepper year={year} years={allYears} onChange={onYearChange}/></PageHeader><div className="bento">
 <Widget className="span-2 lg-row-2 hero-card flex flex-col"><p className="text-[13px] opacity-75">Ingresos sin IVA · {year}</p><p className="hero-value mt-3"><Money value={m.ingresosOperativos}/></p><p className="mt-2"><Money value={m.facturacionConIva}/> con IVA</p><div className="mt-auto pt-8"><SplitBar parts={[{label:'Cobrado',value:m.cobrado,color:'var(--tint-ink)'},{label:'Pendiente',value:m.pendiente,color:'color-mix(in srgb, var(--tint-ink) 30%, transparent)'}]}/><div className="flex flex-wrap justify-between gap-3 mt-3 text-sm"><span>Cobrado <Money value={m.cobrado}/></span><span>Pendiente <Money value={m.pendiente}/></span></div></div></Widget>
 <Metric label="Beneficio operativo" value={m.beneficioOperativo} tone={m.beneficioOperativo>=0?'positive':'negative'}/><Metric label="Pendiente de cobro" value={m.pendiente} tone={m.pendiente>0?'warning':'neutral'}/><Metric label="Margen" value={Math.round(m.margen*100)} kind="percent"/><Metric label={eventLabel} value={m.numEventos} kind="count"/>
 <Metric label="Gastos" value={m.gastosOperativos}/><Metric label="Coste por evento" value={m.numEventos?m.gastosActuacion/m.numEventos:0}/><Metric label="IVA recuperado" value={ivaRecuperado}/><Metric label="Cobrado" value={m.cobrado} tone="positive"/>
 <Widget className="span-full" title="Evolución de ingresos"><MonthlyBars year={year} data={months} series={[{key:'cobrado',label:'Cobrado',color:'var(--tint-a)'},{key:'pendiente',label:'Por cobrar',color:'color-mix(in srgb, var(--tint-b) 38%, #fff)'}]}/></Widget>
 </div>{children}</div>;
}
