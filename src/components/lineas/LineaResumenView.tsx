import type { ReactNode } from 'react';
import type { LineaFinanceResult } from '../../hooks/useLineaFinance';
import type { Gasto, GastoEvento, Ingreso } from '../../types';
import { PageHeader, YearStepper, Widget, Metric, Money, Dot } from '../kit';
import { GlowCard, DotMatrix, StripedBars, TickGauge } from '../kit/dash';
import { dashListas } from '../kit/dashData';
import { DateGlyph } from '../ingresos/IngresosViews';
import { pendienteDe } from '../../lib/contabilidad';
import { fmtShort } from '../../utils/helpers';

export function LineaResumenView({
  year, allYears, onYearChange, finance: m, months, ivaRecuperado, eventLabel, ingresosTodos, ingresos, gastos, gastosEvento, children,
}: {
  year: number; allYears: number[]; onYearChange: (y: number) => void; finance: LineaFinanceResult;
  months: { cobrado: number; pendiente: number }[]; ivaRecuperado: number; eventLabel: string;
  ingresosTodos: Ingreso[]; ingresos: Ingreso[]; gastos: Gasto[]; gastosEvento: GastoEvento[]; children?: ReactNode;
}) {
  const { categorias, proximos, porCobrar } = dashListas(ingresosTodos, ingresos, gastos, gastosEvento);
  const pct = m.facturacionConIva > 0 ? Math.round((m.cobrado / m.facturacionConIva) * 100) : 0;
  return (
    <div>
      <PageHeader title="Resumen"><YearStepper year={year} years={allYears} onChange={onYearChange} /></PageHeader>
      <div className="dash-wrap"><div className="dash">
        <Widget className="d-6" title="Gastos por categoría" delay={0.02}>
          <p className="num text-[30px] font-semibold tracking-[-0.03em] -mt-2 mb-4"><Money value={m.gastosOperativos} /></p>
          {categorias.length ? <DotMatrix rows={categorias} /> : <p className="text-ink-3 text-[14px]">Sin gastos en {year}.</p>}
        </Widget>
        <GlowCard className="d-6" delay={0.05}>
          <p className="text-[13px] opacity-70">Ingresos sin IVA · {year}</p>
          <p className="hero-value mt-3"><Money value={m.ingresosOperativos} /></p>
          <p className="mt-2 text-[14px] opacity-70"><Money value={m.facturacionConIva} /> con IVA</p>
          <div className="mt-auto pt-6 flex gap-8 text-[13px]">
            <span><span className="opacity-60 block">Beneficio operativo</span><b className="num text-[19px]"><Money value={m.beneficioOperativo} /></b></span>
            <span><span className="opacity-60 block">Margen</span><b className="num text-[19px]">{Math.round(m.margen * 100)}%</b></span>
          </div>
        </GlowCard>
        <Widget className="d-9" title="Ingresos por mes" delay={0.08} action={
          <span className="flex gap-3 text-[12.5px] text-ink-2">
            <span className="flex items-center gap-1.5"><Dot color="#16171c" />Cobrado</span>
            <span className="flex items-center gap-1.5"><Dot color="color-mix(in srgb, var(--tint-b) 55%, #fff)" />Por cobrar</span>
          </span>
        }><StripedBars year={year} data={months} /></Widget>
        <Widget className="d-3 flex flex-col" title="Cobrado" delay={0.11}>
          <TickGauge percent={pct} label="del total" />
          <dl className="mt-auto pt-4 space-y-2 text-[13.5px]">
            <div className="flex justify-between"><dt className="text-ink-3">Cobrado</dt><dd className="num font-semibold"><Money value={m.cobrado} /></dd></div>
            <div className="flex justify-between"><dt className="text-ink-3">Pendiente</dt><dd className="num font-semibold text-[#c26a00]"><Money value={m.pendiente} /></dd></div>
          </dl>
        </Widget>
        <Metric className="d-half" label="Gastos" value={m.gastosOperativos} delay={0.14} />
        <Metric className="d-half" label="Coste por evento" value={m.numEventos ? m.gastosActuacion / m.numEventos : 0} delay={0.16} />
        <Metric className="d-half" label={eventLabel} value={m.numEventos} kind="count" delay={0.18} />
        <Metric className="d-half" label="IVA recuperado" value={ivaRecuperado} delay={0.2} />
        <Widget className="d-6" title="Próximos eventos" delay={0.22}>
          {proximos.length === 0 ? <p className="text-ink-3 text-[14px]">Sin eventos próximos.</p> : proximos.map((i) => (
            <div key={i.id} className="activity-row"><DateGlyph date={i.fechaEvento} /><span className="list-main"><b>{i.concepto}</b><small>{i.cliente}</small></span><span className="num font-semibold text-[14.5px]">{fmtShort(i.baseImponible)}</span></div>
          ))}
        </Widget>
        <Widget className="d-6" title="Por cobrar" delay={0.24}>
          {porCobrar.length === 0 ? <p className="text-ink-3 text-[14px]">Todo cobrado.</p> : porCobrar.map((i) => (
            <div key={i.id} className="activity-row"><DateGlyph date={i.fechaEvento} /><span className="list-main"><b>{i.cliente}</b><small>{i.concepto}</small></span><span className="num font-semibold text-[14.5px] text-[#c26a00]">{fmtShort(pendienteDe(i))}</span></div>
          ))}
        </Widget>
      </div></div>
      {children}
    </div>
  );
}
