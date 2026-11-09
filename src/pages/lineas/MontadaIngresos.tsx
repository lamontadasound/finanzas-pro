import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../../store/useStore';
import { cobrosDe, type Cobro } from '../../lib/cobros';
import { PageHeader, YearStepper, Widget, Metric, Money, Pill } from '../../components/kit';
import { StripedBars } from '../../components/kit/dash';
import { DateGlyph } from '../../components/ingresos/IngresosViews';
import { EmptyState } from '../../components/ui/EmptyState';
import { fmt } from '../../utils/helpers';
import { Wallet } from 'lucide-react';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fechaCorta = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
const anio = (d: string) => Number(d.slice(0, 4));
const mes = (d: string) => Number(d.slice(5, 7)) - 1;

/** La Montada · Ingresos: dinero recibido, en el mes en que se cobró. */
export const MontadaIngresos = () => {
  const allIngresos = useStore((s) => s.ingresos);
  const cobros = useMemo(() => cobrosDe(allIngresos.filter((i) => i.area === 'montada')), [allIngresos]);
  const nowYear = new Date().getFullYear();
  const nowMonth = new Date().getMonth();
  const years = useMemo(() => [...new Set([nowYear, ...cobros.map((c) => anio(c.fecha))])].filter(Number.isFinite), [cobros, nowYear]);
  const [year, setYear] = useState(nowYear);
  const [month, setMonth] = useState(nowMonth);
  const [verRevisar, setVerRevisar] = useState(false);
  const hoy = new Date().toISOString().slice(0, 10);
  const revisar = cobros.filter((c) => c.sinFecha || c.fecha > hoy);

  const delAnio = cobros.filter((c) => anio(c.fecha) === year);
  const meses = Array.from({ length: 12 }, (_, m) => ({ cobrado: delAnio.filter((c) => mes(c.fecha) === m).reduce((a, c) => a + c.importe, 0), pendiente: 0 }));
  const delMes = delAnio.filter((c) => mes(c.fecha) === month);
  const total = delAnio.reduce((a, c) => a + c.importe, 0);
  const anticipos = delAnio.filter((c) => anio(c.ingreso.fechaEvento) > year).reduce((a, c) => a + c.importe, 0);
  const reservas = delAnio.filter((c) => c.tipo === 'Reserva' || c.tipo === 'Segunda reserva').reduce((a, c) => a + c.importe, 0);

  return (
    <div>
      <PageHeader title="Ingresos">
        <YearStepper year={year} years={years} onChange={(y) => { setYear(y); setMonth(y === nowYear ? nowMonth : 11); }} />
      </PageHeader>
      <div className="bento mb-4">
        <Metric label={`Ingresado en ${year}`} value={total} />
        <Metric label="Cobros" value={delAnio.length} kind="count" delay={0.03} />
        <Metric label="Reservas cobradas" value={reservas} delay={0.06} />
        <Metric label="De eventos de años siguientes" value={anticipos} delay={0.09} />
      </div>

      {revisar.length > 0 && (
        <Widget className="mb-4" delay={0.1}>
          <button className="w-full flex items-center justify-between gap-3 text-left" onClick={() => setVerRevisar((v) => !v)} aria-expanded={verRevisar}>
            <span>
              <b className="text-[15px]">{revisar.length} cobros por revisar</b>
              <span className="block text-[13px] text-ink-3">Sin fecha de cobro o con una fecha que aún no ha llegado. Corrígelos en Eventos.</span>
            </span>
            <Pill tone="warning">{verRevisar ? 'Ocultar' : 'Ver'}</Pill>
          </button>
          {verRevisar && (
            <ul className="mt-3 divide-y divide-black/[.06]">
              {revisar.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-[14px]">
                  <span className="min-w-0"><b className="block truncate">{c.ingreso.cliente || c.ingreso.concepto}</b>
                    <small className="text-ink-3">{c.tipo} · evento {fechaCorta(c.ingreso.fechaEvento)}</small></span>
                  <span className="text-right shrink-0"><span className="num font-semibold block">{fmt(c.importe)}</span>
                    <small className="text-[#c26a00]">{c.sinFecha ? 'Sin fecha de cobro' : `Cobro el ${fechaCorta(c.fecha)}`}</small></span>
                </li>
              ))}
            </ul>
          )}
        </Widget>
      )}

      <Widget title="Ingresado por mes" className="mb-4" delay={0.12}>
        <StripedBars year={year} data={meses} labels={['Ingresado', '']} selected={month} onSelect={setMonth} />
      </Widget>

      <Widget pad={false} delay={0.15} aria-label={`Cobros de ${MESES[month]}`}>
        <header className="flex items-center justify-between gap-3 px-5 sm:px-6 pt-5 pb-3">
          <h2 className="widget-title capitalize">{MESES[month]} {year}</h2>
          <span className="num font-semibold"><Money value={meses[month].cobrado} /></span>
        </header>
        {delMes.length === 0 ? (
          <div className="px-6 pb-6"><EmptyState icon={<Wallet size={22} />} title="Sin cobros este mes" /></div>
        ) : delMes.map((c: Cobro, idx) => {
          const otroAnio = anio(c.ingreso.fechaEvento) !== year;
          return (
            <motion.div key={c.id} className="list-row" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.45, delay: Math.min(idx, 12) * 0.025 }}>
              <DateGlyph date={c.fecha} />
              <span className="list-main">
                <b>{c.ingreso.cliente || c.ingreso.concepto}</b>
                <small>{c.ingreso.concepto} · evento {fechaCorta(c.ingreso.fechaEvento)}{c.sinFecha ? ' · sin fecha de cobro' : ''}</small>
              </span>
              <span className="hidden sm:flex gap-1.5">
                <Pill tone={c.tipo.includes('Reserva') || c.tipo === 'Segunda reserva' ? 'info' : 'positive'}>{c.tipo}</Pill>
                {otroAnio && <Pill tone="warning">Evento {anio(c.ingreso.fechaEvento)}</Pill>}
              </span>
              <span className="list-amount num">{fmt(c.importe)}</span>
            </motion.div>
          );
        })}
      </Widget>
    </div>
  );
};
