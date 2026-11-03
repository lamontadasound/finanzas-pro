import { useMemo, useState } from 'react';
import { useStore } from '../../store/useStore';
import { getAvailableYears, fmtShort } from '../../utils/helpers';
import { cobradoDe, pendienteDe } from '../../lib/contabilidad';
import { gastoEventoSinIVA } from '../../lib/ingresoRentabilidad';
import { PageHeader, YearStepper, Widget, Metric, Money, Dot } from '../../components/kit';
import { GlowCard, DotMatrix, StripedBars, TickGauge } from '../../components/kit/dash';
import { dashListas } from '../../components/kit/dashData';
import { DateGlyph } from '../../components/ingresos/IngresosViews';
import { defaultYear } from '../../components/kit/utils';

const yearOf = (d?: string) => (d ? new Date(d).getFullYear() : NaN);
const monthOf = (d?: string) => (d ? new Date(d).getMonth() : -1);

// Resumen de La Montada Sound. Mismos criterios que Contabilidad:
// beneficio operativo = ingresos sin IVA − gastos generales − coste de eventos.
export const MontadaSoundResumen = () => {
  const allIngresos = useStore((s) => s.ingresos);
  const allGastos = useStore((s) => s.gastos);
  const allGastosEvento = useStore((s) => s.gastosEvento);
  const ingresos = useMemo(() => allIngresos.filter((i) => i.area === 'montada'), [allIngresos]);
  const gastos = useMemo(() => allGastos.filter((g) => g.area === 'montada'), [allGastos]);
  const gastosEvento = useMemo(() => allGastosEvento.filter((g) => g.area === 'montada'), [allGastosEvento]);

  const years = useMemo(() => getAvailableYears([...ingresos, ...gastos]), [ingresos, gastos]);
  const [year, setYear] = useState(() => defaultYear(years));

  const m = useMemo(() => {
    const ing = ingresos.filter((i) => yearOf(i.fechaEvento) === year);
    const gas = gastos.filter((g) => yearOf(g.fecha) === year);
    const ids = new Set(ing.map((i) => i.id));
    const gev = gastosEvento.filter((g) => ids.has(g.ingresoId));

    const sinIva = ing.reduce((s, i) => s + i.baseImponible, 0);
    const conIva = ing.reduce((s, i) => s + i.total, 0);
    const generales = gas.reduce((s, g) => s + g.baseImponible, 0);
    const costeEventos = gev.reduce((s, g) => s + gastoEventoSinIVA(g), 0);
    const beneficio = sinIva - generales - costeEventos;
    const cobrado = ing.reduce((s, i) => s + cobradoDe(i), 0);
    const pendiente = ing.reduce((s, i) => s + pendienteDe(i), 0);
    const ivaRecuperado = gas.reduce((s, g) => s + (g.importeIVA ?? 0), 0) + gev.reduce((s, g) => s + (g.importeIVA ?? 0), 0);

    const meses = Array.from({ length: 12 }, () => ({ cobrado: 0, pendiente: 0 }));
    for (const i of ing) {
      const mo = monthOf(i.fechaEvento);
      if (mo < 0) continue;
      meses[mo].cobrado += cobradoDe(i);
      meses[mo].pendiente += pendienteDe(i);
    }

    const { categorias, proximos, porCobrar } = dashListas(ingresos, ing, gas, gev);

    return {
      categorias, proximos, porCobrar,
      sinIva, conIva, generales, costeEventos, beneficio, cobrado, pendiente, ivaRecuperado, meses,
      eventos: ing.length,
      margen: sinIva > 0 ? Math.round((beneficio / sinIva) * 100) : 0,
      ticket: ing.length ? sinIva / ing.length : 0,
    };
  }, [ingresos, gastos, gastosEvento, year]);

  return (
    <div>
      <PageHeader title="Resumen">
        <YearStepper year={year} years={years} onChange={setYear} />
      </PageHeader>

      <div className="dash-wrap"><div className="dash">
        <Widget className="d-6" title="Gastos por categoría" delay={0.02}>
          <p className="num text-[30px] font-semibold tracking-[-0.03em] -mt-2 mb-4"><Money value={m.generales + m.costeEventos} /></p>
          <DotMatrix rows={m.categorias} />
        </Widget>

        <GlowCard className="d-6" delay={0.05}>
          <p className="text-[13px] opacity-70">Ingresos sin IVA · {year}</p>
          <p className="hero-value mt-3"><Money value={m.sinIva} /></p>
          <p className="mt-2 text-[14px] opacity-70"><Money value={m.conIva} /> con IVA</p>
          <div className="mt-auto pt-6 flex gap-8 text-[13px]">
            <span><span className="opacity-60 block">Beneficio operativo</span><b className="num text-[19px]"><Money value={m.beneficio} /></b></span>
            <span><span className="opacity-60 block">Margen</span><b className="num text-[19px]">{m.margen}%</b></span>
          </div>
        </GlowCard>

        <Widget className="d-9" title="Ingresos por mes" delay={0.08} action={
          <span className="flex gap-3 text-[12.5px] text-ink-2">
            <span className="flex items-center gap-1.5"><Dot color="#16171c" />Cobrado</span>
            <span className="flex items-center gap-1.5"><Dot color="color-mix(in srgb, var(--tint-b) 55%, #fff)" />Por cobrar</span>
          </span>
        }>
          <StripedBars year={year} data={m.meses} />
        </Widget>

        <Widget className="d-3 flex flex-col" title="Cobrado" delay={0.11}>
          <TickGauge percent={m.conIva > 0 ? Math.round((m.cobrado / m.conIva) * 100) : 0} label="del total" />
          <dl className="mt-auto pt-4 space-y-2 text-[13.5px]">
            <div className="flex justify-between"><dt className="text-ink-3">Cobrado</dt><dd className="num font-semibold"><Money value={m.cobrado} /></dd></div>
            <div className="flex justify-between"><dt className="text-ink-3">Pendiente</dt><dd className="num font-semibold text-[#c26a00]"><Money value={m.pendiente} /></dd></div>
          </dl>
        </Widget>

        <Metric className="d-half" label="Gastos" value={m.generales + m.costeEventos} delay={0.14} foot={<>Generales <Money value={m.generales} /></>} />
        <Metric className="d-half" label="Coste de eventos" value={m.costeEventos} delay={0.16} />
        <Metric className="d-half" label="Eventos" value={m.eventos} kind="count" delay={0.18} foot={m.eventos ? <>Ticket medio <Money value={m.ticket} /></> : null} />
        <Metric className="d-half" label="IVA recuperado" value={m.ivaRecuperado} delay={0.2} />

        <Widget className="d-6" title="Próximos eventos" delay={0.22}>
          {m.proximos.length === 0 ? <p className="text-ink-3 text-[14px]">Sin eventos próximos.</p> : m.proximos.map((i) => (
            <div key={i.id} className="activity-row">
              <DateGlyph date={i.fechaEvento} />
              <span className="list-main"><b>{i.concepto}</b><small>{i.cliente}</small></span>
              <span className="num font-semibold text-[14.5px]">{fmtShort(i.baseImponible)}</span>
            </div>
          ))}
        </Widget>

        <Widget className="d-6" title="Por cobrar" delay={0.24}>
          {m.porCobrar.length === 0 ? <p className="text-ink-3 text-[14px]">Todo cobrado.</p> : m.porCobrar.map((i) => (
            <div key={i.id} className="activity-row">
              <DateGlyph date={i.fechaEvento} />
              <span className="list-main"><b>{i.cliente}</b><small>{i.concepto}</small></span>
              <span className="num font-semibold text-[14.5px] text-[#c26a00]">{fmtShort(pendienteDe(i))}</span>
            </div>
          ))}
        </Widget>
      </div></div>
    </div>
  );
};
