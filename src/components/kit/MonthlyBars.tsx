import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fmtShort } from '../../utils/helpers';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export interface BarSeries { key: string; label: string; color: string; pattern?: boolean }

/**
 * Barras mensuales apiladas, hechas a mano (sin librería de gráficos) para
 * controlar el detalle: crecen con muelle, el mes en curso se resalta y al
 * pasar el dedo/ratón aparece la cifra de cada serie.
 */
export const MonthlyBars = ({
  data, series, year, height = 220,
}: {
  data: Record<string, number>[];
  series: BarSeries[];
  year: number;
  height?: number;
}) => {
  const [hover, setHover] = useState<number | null>(null);
  const totals = data.map((d) => series.reduce((s, x) => s + Math.max(0, d[x.key] ?? 0), 0));
  const max = Math.max(...totals, 1);
  const now = new Date();
  const currentMonth = now.getFullYear() === year ? now.getMonth() : -1;
  const shown = hover ?? (currentMonth >= 0 ? currentMonth : null);

  return (
    <div>
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-[13px] text-ink-2">
            <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: s.color, opacity: s.pattern ? 0.45 : 1 }} />
            {s.label}
          </span>
        ))}
        <AnimatePresence mode="wait">
          {shown != null && (
            <motion.span
              key={shown}
              initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.16 }}
              className="ml-auto text-[13px] text-ink-2 num"
            >
              <span className="font-semibold text-ink">{MESES[shown]}</span>
              {series.map((s) => (
                <span key={s.key} className="ml-3">{fmtShort(data[shown]?.[s.key] ?? 0)}</span>
              ))}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="relative" style={{ height }} onMouseLeave={() => setHover(null)}>
        {[0.25, 0.5, 0.75].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-dashed border-black/[.06]" style={{ bottom: `${f * 100}%` }} />
        ))}
        <div className="absolute inset-0 flex items-end gap-[6px] sm:gap-[10px]">
          {data.map((d, i) => {
            const active = shown === i;
            const dim = shown != null && !active;
            return (
              <button
                key={i}
                className="flex-1 h-full flex flex-col justify-end items-stretch group outline-none"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onClick={() => setHover(i)}
                aria-label={`${MESES[i]}: ${series.map((s) => `${s.label} ${fmtShort(d[s.key] ?? 0)}`).join(', ')}`}
              >
                <div className="flex flex-col-reverse justify-start w-full h-full">
                  {series.map((s, si) => {
                    const v = Math.max(0, d[s.key] ?? 0);
                    return (
                      <motion.div
                        key={s.key}
                        initial={{ height: 0 }}
                        animate={{ height: `${(v / max) * 100}%`, opacity: dim ? 0.35 : 1 }}
                        transition={{ type: 'spring', bounce: 0.12, duration: 0.8, delay: 0.1 + i * 0.03 }}
                        className="w-full"
                        style={{
                          background: s.pattern
                            ? `repeating-linear-gradient(135deg, ${s.color}66 0 4px, ${s.color}33 4px 8px)`
                            : s.color,
                          borderRadius: si === series.length - 1 || v === 0 ? '7px 7px 3px 3px' : 3,
                          marginTop: v > 0 && si > 0 ? 2 : 0,
                        }}
                      />
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex gap-[6px] sm:gap-[10px] mt-2">
        {MESES.map((m, i) => (
          <span key={m} className={`flex-1 text-center text-[11px] ${i === currentMonth ? 'text-ink font-semibold' : 'text-ink-3'}`}>{m}</span>
        ))}
      </div>
    </div>
  );
};
