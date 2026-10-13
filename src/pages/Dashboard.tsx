import { BalanceTrend } from '../components/studio/BalanceTrend';
import { SpotlightSurface } from '../components/studio/SpotlightSurface';
import { FinancialDigits } from '../components/ui/FinancialDigits';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, ChevronRight, CalendarDays, Music2, Building2, Trophy, HardHat } from 'lucide-react';
import { AnimatedNumber } from '../components/ui/AnimatedNumber';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import { BUSINESS_LINES, LINEA_IDS } from '../config/businessLines';
import { juliaSummary } from '../lib/juliaSummary';

const euro = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const monthName = (month: number) => new Date(2026, month, 1).toLocaleDateString('es-ES', { month: 'long' });
const icons = { montada_sound: Building2, dj: Music2, real_madrid: Trophy, montada_installations: HardHat };

export function Dashboard() {
  const reduceMotion = useReducedMotion();
  const { ingresos, gastos, gastosEvento, socios, movimientosSocios } = useStore();
  const profile = useAuthStore(s => s.profile);
  const allowed = useAuthStore(s => s.lineasVisibles());
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const today = new Date();
  const years = [...new Set([
    today.getFullYear(), year,
    ...ingresos.map(i => Number(i.fechaEvento.slice(0, 4))),
    ...gastos.map(g => Number(g.fecha.slice(0, 4))),
    ...gastosEvento.map(g => Number(g.fecha.slice(0, 4))),
    ...movimientosSocios.map(m => Number(m.fecha.slice(0, 4))),
  ])].filter(Number.isFinite).sort((a, b) => b - a);

  if (profile?.rol !== 'admin') return (
    <div className="premium-dashboard">
      <header className="premium-heading"><div><p className="premium-eyebrow">Mi espacio</p><h1>Mis proyectos</h1></div></header>
      <div className="premium-panel premium-projects">
        {allowed.map(line => {
          const Icon = icons[line];
          return <Link className="premium-project-row" data-line={line} key={line} to={BUSINESS_LINES[line].routeBase + '/resumen'}>
            <Icon size={18} strokeWidth={1.5} /><span>{BUSINESS_LINES[line].label}</span><ChevronRight size={16} />
          </Link>;
        })}
      </div>
    </div>
  );

  const months = juliaSummary(year, ingresos, gastos, gastosEvento, socios, movimientosSocios);
  const annual = months.reduce((sum, m) => sum + m.total, 0);
  const partnerTotal = months.reduce((sum, m) => sum + (m.amounts.montada_sound ?? 0) + (m.amounts.montada_installations ?? 0), 0);
  const directTotal = months.reduce((sum, m) => sum + (m.amounts.dj ?? 0) + (m.amounts.real_madrid ?? 0), 0);
  const selected = months.find(m => m.month === selectedMonth)!;
  const largest = Math.max(1, ...months.map(m => Math.abs(m.total)));

  return (
    <div className="premium-dashboard">
      <header className="premium-heading">
        <div><h1>Tu Resumen Julia: {year}</h1></div>
        <label className="premium-year-control">
          <CalendarDays size={16} strokeWidth={1.5} aria-hidden="true" />
          <span className="sr-only">Año del resumen</span>
          <select aria-label="Año del resumen" value={year} onChange={e => setYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </header>

      <div className="premium-overview">
        <SpotlightSurface className="studio-balance-wrap"><section className="premium-statement" aria-label="Resumen anual">
          <p className="premium-eyebrow">Tu total · {year}</p>
          <p className="premium-annual"><AnimatedNumber value={annual} format={euro} /></p>
          
          <BalanceTrend values={months.map(m=>m.total)}/>
          <dl className="premium-subtotals">
            <div><dt>DJ y Real Madrid</dt><dd><AnimatedNumber value={directTotal} format={euro} /></dd></div>
            <div><dt>Sound e Installations</dt><dd><AnimatedNumber value={partnerTotal} format={euro} /></dd></div>
          </dl>
          <div className="premium-actions">
            <Link to="/contabilidad/informes">Ver informes <ArrowUpRight size={15} /></Link>
            <Link to="/contabilidad/pagos">Gestionar pagos <ArrowUpRight size={15} /></Link>
          </div>
        </section></SpotlightSurface>

        <section className="premium-panel premium-projects" aria-label="Proyectos">
          <div className="premium-panel-heading"><h2>Proyectos</h2><span>{year}</span></div>
          {LINEA_IDS.map(line => {
            const Icon = icons[line];
            const total = months.reduce((sum, m) => sum + (m.amounts[line] ?? 0), 0);
            return <Link key={line} to={BUSINESS_LINES[line].routeBase + '/resumen'} className="premium-project-row" data-line={line}>
              <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
              <span>{BUSINESS_LINES[line].shortLabel}<small>{line === 'dj' || line === 'real_madrid' ? 'Tu beneficio' : 'Tu reparto'}</small></span>
              <strong>{euro(total)}</strong><ChevronRight size={14} aria-hidden="true" />
            </Link>;
          })}
        </section>
      </div>


      <section aria-labelledby="monthly-heading" className="premium-month-section">
        <div className="premium-section-heading"><h2 id="monthly-heading">Mes a mes</h2></div>
        <div className="premium-month-layout">
          <div className="premium-panel premium-month-list" role="group" aria-label="Seleccionar mes">
            {months.map(m => (
              <button key={m.month} type="button" className="premium-month-row" aria-pressed={selectedMonth === m.month} aria-controls="month-detail" onClick={() => setSelectedMonth(m.month)}>
                <span className="premium-month-index" aria-hidden="true">{String(m.month + 1).padStart(2, '0')}</span>
                <span className="premium-month-name">{monthName(m.month)}{year === today.getFullYear() && m.month === today.getMonth() && <span className="premium-month-dot" title="Mes actual"><span className="sr-only"> · Mes actual</span></span>}</span>
                <span className="premium-month-track" aria-hidden="true"><span className={m.total < 0 ? 'is-negative' : ''} style={{ width: `${Math.abs(m.total) / largest * 100}%` }} /></span>
                <strong className={m.total < 0 ? 'premium-negative' : ''}>{euro(m.total)}</strong>
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            ))}
          </div>
          <section id="month-detail" className="premium-panel premium-month-detail" aria-label="Detalle del mes">
            <p className="premium-eyebrow">Detalle · {year}</p>
            <label className="premium-month-picker">Mes del resumen
              <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
                {months.map(m => <option key={m.month} value={m.month}>{monthName(m.month)} · {euro(m.total)}</option>)}
              </select>
            </label>
            <motion.div key={`${year}-${selectedMonth}`} initial={reduceMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : .38, ease: [0.22, 1, 0.36, 1] }}>
              <h3>{monthName(selectedMonth)}</h3>
              <p className="premium-month-total" aria-live="polite" aria-atomic="true"><span className="sr-only">Total de {monthName(selectedMonth)}: </span><FinancialDigits value={euro(selected.total)}/></p>
              <dl className="premium-month-breakdown">
                {LINEA_IDS.map(line => <div key={line}><dt>{BUSINESS_LINES[line].shortLabel}</dt><dd>{euro(selected.amounts[line] ?? 0)}</dd></div>)}
              </dl>
              
            </motion.div>
          </section>
        </div>
      </section>
      
    </div>
  );
}
