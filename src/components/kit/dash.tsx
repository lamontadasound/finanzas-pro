import { useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { fmtShort } from '../../utils/helpers';

const spring = { type: 'spring' as const, bounce: 0, duration: 0.8 };
const MESES = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MESES_LARGOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** Tarjeta oscura con un halo del color del espacio activo. */
export const GlowCard = ({ children, className = '', delay = 0, label }: { children: ReactNode; className?: string; delay?: number; label?: string }) => (
  <motion.section
    aria-label={label}
    className={`glow-card ${className}`}
    initial={{ opacity: 0, y: 14, filter: 'blur(10px)' }}
    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
    whileHover={{ y: -3 }}
    transition={{ type: 'spring', bounce: 0, duration: 0.6, delay }}
  >
    <span className="glow-card-halo" aria-hidden />
    <div className="relative h-full flex flex-col">{children}</div>
  </motion.section>
);

export interface DotRow { label: string; values: number[] }

/** Matriz de puntos: filas por categoría, columnas por mes, tono según importe. */
export const DotMatrix = ({ rows }: { rows: DotRow[] }) => {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...rows.flatMap((r) => r.values));
  const nivel = (v: number) => (v <= 0 ? 0 : v < max * 0.2 ? 1 : v < max * 0.55 ? 2 : 3);
  return (
    <div>
      <div className="dots" role="table" aria-label="Gastos por categoría y mes">
        {rows.map((r, ri) => (
          <div key={r.label} className="dots-row" role="row">
            <span className="dots-label" role="rowheader">{r.label}</span>
            {r.values.map((v, i) => (
              <motion.span
                key={i} role="cell" className="dot" data-level={nivel(v)}
                aria-label={`${r.label}, ${MESES_LARGOS[i]}: ${fmtShort(v)}`}
                initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.25 }}
                transition={{ type: 'spring', bounce: 0.3, duration: 0.5, delay: 0.1 + ri * 0.04 + i * 0.015 }}
                onMouseEnter={() => setHover(`${r.label} · ${MESES_LARGOS[i]} · ${fmtShort(v)}`)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
          </div>
        ))}
        <div className="dots-row dots-foot" aria-hidden>
          <span className="dots-label" />
          {MESES.map((m, i) => <span key={i} className="dots-month">{m}</span>)}
        </div>
      </div>
      <p className="mt-2 h-4 text-[12px] text-ink-3 num">{hover}</p>
    </div>
  );
};

/** Barras anchas rayadas: cobrado abajo y por cobrar arriba, con tooltip por mes. */
export const StripedBars = ({ data, year, height = 210, labels = ['Cobrado', 'Por cobrar'], selected, onSelect }: {
  data: { cobrado: number; pendiente: number }[]; year: number; height?: number;
  labels?: [string, string]; selected?: number; onSelect?: (mes: number) => void;
}) => {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.cobrado + d.pendiente));
  const now = new Date();
  const actual = now.getFullYear() === year ? now.getMonth() : -1;
  return (
    <div>
      <div className="sbars" style={{ height }} onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => {
          const total = d.cobrado + d.pendiente;
          return (
            <div key={i} className="sbar-col" onMouseEnter={() => setHover(i)} onClick={() => { setHover(i); onSelect?.(i); }}>
              {hover === i && total > 0 && (
                <motion.div className="chart-tip sbar-tip" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  style={{ bottom: `calc(${(total / max) * 100}% + 10px)`, ...(i < 2 ? { left: 0 } : i > 9 ? { right: 0 } : { left: '50%', translateX: '-50%' }) }}>
                  <p className="font-semibold">{MESES_LARGOS[i]} {year}</p>
                  <p className="flex justify-between gap-3"><span className="text-ink-3">{labels[0]}</span><b className="num">{fmtShort(d.cobrado)}</b></p>
                  {d.pendiente > 0 && <p className="flex justify-between gap-3"><span className="text-ink-3">{labels[1]}</span><b className="num">{fmtShort(d.pendiente)}</b></p>}
                </motion.div>
              )}
              {hover == null && total > 0 && (selected != null ? i === selected : i === actual) && (
                <motion.span className="sbar-tag num" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
                  style={{ bottom: `calc(${(total / max) * 100}% + 8px)`, ...(i < 1 ? { left: 0 } : i > 10 ? { right: 0 } : { left: '50%', translateX: '-50%' }) }}>
                  {fmtShort(total)}
                </motion.span>
              )}
              <motion.div
                className="sbar" data-current={selected != null ? i === selected : i === actual}
                initial={{ height: 0 }}
                animate={{ height: `${(total / max) * 100}%`, opacity: hover != null && hover !== i ? 0.45 : 1 }}
                transition={{ ...spring, delay: 0.1 + i * 0.03 }}
              >
                {d.pendiente > 0 && <span className="sbar-pend" style={{ height: `${(d.pendiente / total) * 100}%` }} />}
                <span className="sbar-cob" />
              </motion.div>
            </div>
          );
        })}
      </div>
      <div className="flex mt-2">
        {MESES_LARGOS.map((m, i) => <span key={m} className={`flex-1 text-center text-[11px] ${i === actual ? 'font-semibold text-ink' : 'text-ink-3'}`}>{m}</span>)}
      </div>
    </div>
  );
};

/** Medidor semicircular de marcas: se rellena hasta el porcentaje indicado. */
export const TickGauge = ({ percent, label }: { percent: number; label: string }) => {
  const TICKS = 36;
  const on = Math.round((Math.min(100, Math.max(0, percent)) / 100) * TICKS);
  return (
    <div className="gauge" role="img" aria-label={`${label}: ${percent}%`}>
      <svg viewBox="0 0 200 112" className="w-full">
        {Array.from({ length: TICKS }, (_, i) => {
          const a = Math.PI - (i / (TICKS - 1)) * Math.PI;
          const x1 = 100 + Math.cos(a) * 66, y1 = 104 - Math.sin(a) * 66;
          const x2 = 100 + Math.cos(a) * 92, y2 = 104 - Math.sin(a) * 92;
          return (
            <motion.line
              key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={5} strokeLinecap="round"
              stroke={i < on ? 'var(--tint-a)' : 'rgb(0 0 0 / .08)'}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 + i * 0.018 }}
            />
          );
        })}
      </svg>
      <div className="gauge-center">
        <b className="num">{percent}%</b>
        <small>{label}</small>
      </div>
    </div>
  );
};
