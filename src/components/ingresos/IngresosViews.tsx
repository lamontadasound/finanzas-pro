import { motion } from 'framer-motion';
import { ChevronRight, Plus } from 'lucide-react';
import type { GastoEvento, Ingreso, PaymentStatus } from '../../types';
import { ingresoRentabilidad } from '../../lib/ingresoRentabilidad';
import { fmt, fmtShort } from '../../utils/helpers';
import { Pill, type Tone } from '../kit';
import { RowMenu2, type RowMenuAction } from '../ui2/RowMenu';

export const MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const ESTADO_LABEL: Record<PaymentStatus, string> = {
  presupuesto: 'Presupuesto', pendiente: 'Pendiente', parcial: 'Parcial', pagado: 'Cobrado', cancelado: 'Cancelado',
};
export const ESTADO_TONE: Record<PaymentStatus, Tone> = {
  presupuesto: 'neutral', pendiente: 'negative', parcial: 'warning', pagado: 'positive', cancelado: 'neutral',
};

const spring = { type: 'spring' as const, bounce: 0, duration: 0.5 };

/* ── Nivel 1: años ──────────────────────────────────────────────────────── */
export const YearGrid = ({
  years, onOpen, unit = ['ingreso', 'ingresos'],
}: { years: { year: number; count: number; total: number; months: number[] }[]; onOpen: (y: number) => void; unit?: [string, string] }) => {
  const current = new Date().getFullYear();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {years.map((y, idx) => {
        const max = Math.max(...y.months, 1);
        return (
          <motion.button
            key={y.year}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: idx * 0.04 }}
            onClick={() => onOpen(y.year)}
            className="widget tile text-left p-5 flex flex-col gap-5"
            data-current={y.year === current}
          >
            <div className="flex items-start justify-between">
              <span className="num text-[34px] font-semibold tracking-[-0.04em] leading-none">{y.year}</span>
              <ChevronRight size={18} className="text-ink-4 mt-1" />
            </div>
            <div className="flex items-end gap-[3px] h-9" aria-hidden>
              {y.months.map((v, i) => (
                <motion.span
                  key={i}
                  className="flex-1 rounded-[3px]"
                  style={{ background: v > 0 ? 'var(--tint-a)' : 'rgb(0 0 0 / .06)' }}
                  initial={{ height: 3 }}
                  animate={{ height: v > 0 ? `${Math.max(12, (v / max) * 100)}%` : 3 }}
                  transition={{ ...spring, delay: 0.1 + i * 0.02 }}
                />
              ))}
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="num text-[19px] font-semibold tracking-[-0.02em]">{fmtShort(y.total)}</span>
              <span className="text-[13px] text-ink-3">{y.count} {y.count === 1 ? unit[0] : unit[1]}</span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
};

/* ── Nivel 2: meses ─────────────────────────────────────────────────────── */
export const MonthGrid = ({
  year, months, onOpen, unit = ['evento', 'eventos'], pendingLabel = 'por cobrar', emptyLabel = 'Sin ingresos',
}: {
  year: number; months: { count: number; total: number; pendiente: number }[]; onOpen: (m: number) => void;
  unit?: [string, string]; pendingLabel?: string; emptyLabel?: string;
}) => {
  const now = new Date();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {months.map((m, i) => {
        const empty = m.count === 0;
        const current = now.getFullYear() === year && now.getMonth() === i;
        return (
          <motion.button
            key={i}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.025 }}
            onClick={() => !empty && onOpen(i)}
            disabled={empty}
            className="widget tile text-left p-4 sm:p-5 flex flex-col min-h-[132px]"
            data-current={current}
            data-empty={empty}
          >
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold">{MESES_FULL[i]}</span>
              {current && <span className="now-dot" aria-label="Mes actual" />}
            </div>
            {empty ? (
              <span className="mt-auto text-[13px] text-ink-4">{emptyLabel}</span>
            ) : (
              <>
                <span className="mt-auto num text-[22px] font-semibold tracking-[-0.03em]">{fmtShort(m.total)}</span>
                <span className="mt-1 flex items-center gap-2 text-[12.5px] text-ink-3">
                  {m.count} {m.count === 1 ? unit[0] : unit[1]}
                  {m.pendiente > 0 && <span className="text-[#c26a00]">· {fmtShort(m.pendiente)} {pendingLabel}</span>}
                </span>
              </>
            )}
          </motion.button>
        );
      })}
    </div>
  );
};

/* ── Nivel 3: lista del mes ─────────────────────────────────────────────── */
export const DateGlyph = ({ date }: { date: string }) => {
  const d = new Date(date);
  const valid = !Number.isNaN(d.getTime());
  return (
    <span className="date-glyph" aria-label={date}>
      <span>{valid ? MESES_CORTO[d.getMonth()] : '—'}</span>
      <b className="num">{valid ? d.getDate() : ''}</b>
    </span>
  );
};

const pct = (n: number | null) => (n == null ? '—' : `${n.toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`);

export const IngresoRows = ({
  items, gastosEvento, onOpen, onAddGasto, actionsFor,
}: {
  items: Ingreso[];
  gastosEvento: GastoEvento[];
  onOpen: (i: Ingreso) => void;
  onAddGasto?: (i: Ingreso) => void;
  actionsFor: (i: Ingreso) => RowMenuAction[];
}) => (
  <div className="widget overflow-hidden" style={{ padding: 0 }}>
    <div className="ing-grid ing-head" aria-hidden>
      <span>Fecha</span><span>Concepto · Cliente</span>
      <span className="r">Sin IVA</span><span className="r">Con IVA</span>
      <span className="r">Gastos s/IVA</span><span className="r">Gastos c/IVA</span>
      <span className="r">Beneficio</span><span className="r">Margen</span>
      <span>Estado</span><span>Factura</span><span />
    </div>
    {items.map((i, idx) => {
      const r = ingresoRentabilidad(i, gastosEvento);
      return (
        <motion.div
          key={i.id}
          layout
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: idx * 0.025 }}
          className="ing-grid ing-row"
          onClick={() => onOpen(i)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') onOpen(i); }}
        >
          <DateGlyph date={i.fechaEvento} />
          <span className="ing-concepto">
            <b>{i.concepto}</b>
            <small>{i.cliente}</small>
          </span>
          <span className="r num" data-label="Sin IVA">{fmt(i.baseImponible)}</span>
          <span className="r num ing-strong" data-label="Con IVA">{fmt(i.total)}</span>
          <span className="r num" data-label="Gastos s/IVA">{r.coste ? fmt(r.coste) : '—'}</span>
          <span className="r num" data-label="Gastos c/IVA">{r.costeConIVA ? fmt(r.costeConIVA) : '—'}</span>
          <span className={`r num ing-strong ${r.beneficio >= 0 ? 'text-[#1f9d55]' : 'text-[#d70015]'}`} data-label="Beneficio">{fmt(r.beneficio)}</span>
          <span className="r num" data-label="Margen">{pct(r.margen)}</span>
          <span className="ing-estado"><Pill tone={ESTADO_TONE[i.estadoPago]}>{ESTADO_LABEL[i.estadoPago] ?? i.estadoPago}</Pill></span>
          <span className="ing-factura num">{i.numeroFactura || <span className="text-ink-4">—</span>}</span>
          <span className="ing-actions" onClick={(e) => e.stopPropagation()}>
            {onAddGasto && (
              <button className="chip-btn" onClick={() => onAddGasto(i)}><Plus size={13} strokeWidth={2.4} />Gasto</button>
            )}
            <RowMenu2 actions={actionsFor(i)} />
          </span>
          <dl className="ing-figs">
            <div><dt>Sin IVA</dt><dd className="num">{fmt(i.baseImponible)}</dd></div>
            <div><dt>Con IVA</dt><dd className="num">{fmt(i.total)}</dd></div>
            <div><dt>Gastos s/IVA</dt><dd className="num">{r.coste ? fmt(r.coste) : '—'}</dd></div>
            <div><dt>Gastos c/IVA</dt><dd className="num">{r.costeConIVA ? fmt(r.costeConIVA) : '—'}</dd></div>
            <div><dt>Beneficio</dt><dd className={`num ${r.beneficio >= 0 ? 'text-[#1f9d55]' : 'text-[#d70015]'}`}>{fmt(r.beneficio)}</dd></div>
            <div><dt>Margen</dt><dd className="num">{pct(r.margen)}</dd></div>
          </dl>
        </motion.div>
      );
    })}
  </div>
);
