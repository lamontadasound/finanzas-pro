import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fmtShort } from '../../utils/helpers';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export interface BarSeries { key: string; label: string; color: string }

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toLocaleString('es-ES', { maximumFractionDigits: n >= 10000 ? 0 : 1 })}k` : `${Math.round(n)}`;

/** Escala "bonita": 1, 2, 2.5 o 5 × 10^n por encima del máximo. */
const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
};

/**
 * Barras mensuales apiladas, dibujadas a mano: eje con importes, barras con
 * el color del espacio y tooltip flotante sobre el mes señalado.
 */
export const MonthlyBars = ({
  data, series, year, height = 240,
}: {
  data: Record<string, number>[];
  series: BarSeries[];
  year: number;
  height?: number;
}) => {
  const [hover, setHover] = useState<number | null>(null);
  const totals = data.map((d) => series.reduce((s, x) => s + Math.max(0, d[x.key] ?? 0), 0));
  const max = niceMax(Math.max(...totals, 0));
  const now = new Date();
  const currentMonth = now.getFullYear() === year ? now.getMonth() : -1;
  const ticks = [max, max / 2, 0];

  return (
    <div>
      <div className="flex items-center gap-4 mb-5 flex-wrap">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-[13px] text-ink-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
            {s.label}
            <b className="num text-ink ml-1">{fmtShort(data.reduce((a, d) => a + (d[s.key] ?? 0), 0))}</b>
          </span>
        ))}
      </div>

      <div className="flex gap-3">
        <div className="flex flex-col justify-between text-[11px] text-ink-3 num text-right w-8 shrink-0 -my-[7px]" style={{ height: height + 14 }}>
          {ticks.map((t) => <span key={t}>{compact(t)}</span>)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="relative" style={{ height }} onMouseLeave={() => setHover(null)}>
            {ticks.map((t) => (
              <div key={t} className={`absolute inset-x-0 border-t ${t === 0 ? 'border-black/10' : 'border-dashed border-black/[.06]'}`} style={{ bottom: `${(t / max) * 100}%` }} />
            ))}
            <div className="absolute inset-0 flex items-end">
              {data.map((d, i) => {
                const active = hover === i;
                const dim = hover != null && !active;
                const total = totals[i];
                return (
                  <div
                    key={i}
                    className="relative flex-1 h-full flex justify-center items-end cursor-default"
                    onMouseEnter={() => setHover(i)}
                    onClick={() => setHover(active ? null : i)}
                  >
                    <motion.div
                      className="w-[58%] max-w-[34px] flex flex-col-reverse overflow-hidden"
                      style={{ borderRadius: '9px 9px 4px 4px' }}
                      initial={{ height: 0 }}
                      animate={{ height: `${(total / max) * 100}%`, opacity: dim ? 0.4 : 1 }}
                      transition={{ type: 'spring', bounce: 0.1, duration: 0.8, delay: 0.08 + i * 0.03 }}
                    >
                      {series.map((s) => {
                        const v = Math.max(0, d[s.key] ?? 0);
                        return <div key={s.key} style={{ height: total ? `${(v / total) * 100}%` : 0, background: s.color }} />;
                      })}
                    </motion.div>

                    <AnimatePresence>
                      {active && total > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 6, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 4, scale: 0.98 }}
                          transition={{ type: 'spring', bounce: 0, duration: 0.25 }}
                          className="chart-tip"
                          style={{
                            bottom: `calc(${(total / max) * 100}% + 10px)`,
                            ...(i < 2 ? { left: 0 } : i > 9 ? { right: 0 } : { left: '50%', translateX: '-50%' }),
                          }}
                        >
                          <p className="font-semibold mb-1">{MESES[i]} {year}</p>
                          {series.map((s) => (
                            <p key={s.key} className="flex items-center gap-2 justify-between">
                              <span className="flex items-center gap-1.5 text-ink-3"><span className="w-2 h-2 rounded-full" style={{ background: s.color }} />{s.label}</span>
                              <b className="num">{fmtShort(d[s.key] ?? 0)}</b>
                            </p>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex mt-2">
            {MESES.map((m, i) => (
              <span key={m} className={`flex-1 text-center text-[11px] ${i === currentMonth ? 'text-ink font-semibold' : 'text-ink-3'}`}>{m}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
