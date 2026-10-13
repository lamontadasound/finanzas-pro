import { useMemo, useState } from 'react';
import { useStore } from '../../store/useStore';
import { getAvailableYears } from '../../utils/helpers';
import { cobradoDe, pendienteDe } from '../../lib/contabilidad';
import { gastoEventoSinIVA } from '../../lib/ingresoRentabilidad';
import { PageHeader, YearStepper, Widget, Metric, Money, SplitBar, Dot } from '../../components/kit';
import { defaultYear } from '../../components/kit/utils';
import { MonthlyBars } from '../../components/kit/MonthlyBars';

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

    return {
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

      <div className="bento">
        <Widget className="span-2 lg-row-2 hero-card flex flex-col">
          <p className="text-[13px] font-medium opacity-75">Ingresos sin IVA · {year}</p>
          <p className="hero-value mt-3"><Money value={m.sinIva} /></p>
          <p className="mt-2 text-[15px] opacity-80">
            <Money value={m.conIva} /> con IVA
          </p>
          <div className="mt-auto pt-8">
            <SplitBar parts={[
              { label: 'Cobrado', value: m.cobrado, color: '#ffffff' },
              { label: 'Pendiente', value: m.pendiente, color: 'rgb(255 255 255 / .35)' },
            ]} />
            <div className="flex justify-between mt-3 text-[13px]">
              <span className="flex items-center gap-1.5"><Dot color="#fff" />Cobrado <b className="num ml-1"><Money value={m.cobrado} /></b></span>
              <span className="flex items-center gap-1.5 opacity-80"><Dot color="rgb(255 255 255 / .45)" />Pendiente <b className="num ml-1"><Money value={m.pendiente} /></b></span>
            </div>
          </div>
        </Widget>

        <Metric
          label="Beneficio operativo" value={m.beneficio} delay={0.04}
          tone={m.beneficio >= 0 ? 'positive' : 'negative'}
        />
        <Metric label="Pendiente de cobro" value={m.pendiente} delay={0.06} tone={m.pendiente > 0 ? 'warning' : 'neutral'} />
        <Metric label="Margen" value={m.margen} kind="percent" delay={0.08} tone={m.margen >= 0 ? 'neutral' : 'negative'} />
        <Metric label="Eventos" value={m.eventos} kind="count" delay={0.1} foot={m.eventos ? <>Ticket medio <Money value={m.ticket} /></> : null} />

        <Metric label="Gastos" value={m.generales + m.costeEventos} delay={0.12} foot={<>Generales <Money value={m.generales} /></>} />
        <Metric label="Coste de eventos" value={m.costeEventos} delay={0.14} />
        <Metric label="IVA recuperado" value={m.ivaRecuperado} delay={0.16} />
        <Metric label="Cobrado" value={m.cobrado} delay={0.18} tone="positive" />

        <Widget className="span-full" title="Evolución de ingresos" delay={0.2}>
          <MonthlyBars
            year={year}
            data={m.meses}
            series={[
              { key: 'cobrado', label: 'Cobrado', color: 'var(--tint-a)' },
              { key: 'pendiente', label: 'Por cobrar', color: '#c26a00', pattern: true },
            ]}
          />
        </Widget>
      </div>
    </div>
  );
};
