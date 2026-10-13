import type { ReactNode, HTMLAttributes } from 'react';
import { clsx } from 'clsx';
import NumberFlow from '@number-flow/react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/* ── Cabecera de página: título grande, sin subtítulo ───────────────────── */
export const PageHeader = ({ title, children }: { title: ReactNode; children?: ReactNode }) => (
  <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
    <h1 className="page-title">{title}</h1>
    {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
  </div>
);

/* ── Selector de año tipo stepper ───────────────────────────────────────── */
export const YearStepper = ({ year, years, onChange }: { year: number; years: number[]; onChange: (y: number) => void }) => {
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  const idx = sorted.indexOf(year);
  const prev = idx > 0 ? sorted[idx - 1] : null;
  const next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;
  return (
    <div className="stepper" role="group" aria-label="Año">
      <button onClick={() => prev && onChange(prev)} disabled={!prev} aria-label="Año anterior"><ChevronLeft size={16} /></button>
      <span className="num">{year}</span>
      <button onClick={() => next && onChange(next)} disabled={!next} aria-label="Año siguiente"><ChevronRight size={16} /></button>
    </div>
  );
};

/** Año por defecto: el actual si hay datos de él; si no, el más reciente ≤ actual. */
export const defaultYear = (years: number[]) => {
  const now = new Date().getFullYear();
  if (years.includes(now)) return now;
  const past = years.filter((y) => y <= now).sort((a, b) => b - a);
  return past[0] ?? years[0] ?? now;
};

/* ── Widget ─────────────────────────────────────────────────────────────── */
interface WidgetProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  children: ReactNode;
  title?: ReactNode;
  action?: ReactNode;
  pad?: boolean;
  delay?: number;
}
export const Widget = ({ children, title, action, pad = true, className, delay = 0, ...rest }: WidgetProps) => (
  <motion.section
    initial={{ opacity: 0, y: 12, scale: 0.985 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ type: 'spring', bounce: 0, duration: 0.55, delay }}
    className={clsx('widget', pad && 'p-5 sm:p-6', className)}
    {...(rest as object)}
  >
    {(title || action) && (
      <header className="flex items-center justify-between gap-3 mb-4">
        {title && <h2 className="widget-title">{title}</h2>}
        {action}
      </header>
    )}
    {children}
  </motion.section>
);

/* ── Cifras ─────────────────────────────────────────────────────────────── */
const EUR = { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' } as const;
const EUR2 = { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' } as const;

export const Money = ({ value, cents = false, className }: { value: number; cents?: boolean; className?: string }) => (
  <NumberFlow value={Number.isFinite(value) ? value : 0} locales="es-ES" format={cents ? EUR2 : EUR} className={clsx('num', className)} willChange />
);

export const Count = ({ value, suffix, className }: { value: number; suffix?: string; className?: string }) => (
  <NumberFlow value={Number.isFinite(value) ? value : 0} locales="es-ES" suffix={suffix} className={clsx('num', className)} willChange />
);

export type Tone = 'neutral' | 'positive' | 'negative' | 'warning' | 'info';

/** Métrica compacta: etiqueta + cifra grande. Sin iconos decorativos. */
export const Metric = ({
  label, value, kind = 'money', tone = 'neutral', foot, delay, className,
}: {
  label: string; value: number; kind?: 'money' | 'count' | 'percent';
  tone?: Tone; foot?: ReactNode; delay?: number; className?: string;
}) => (
  <Widget delay={delay} className={clsx('metric', className)} data-tone={tone}>
    <p className="metric-label">{label}</p>
    <p className="metric-value">
      {kind === 'money' && <Money value={value} />}
      {kind === 'count' && <Count value={value} />}
      {kind === 'percent' && <Count value={value} suffix="%" />}
    </p>
    {foot && <div className="metric-foot">{foot}</div>}
  </Widget>
);

/* ── Barra de progreso partida (cobrado / pendiente…) ───────────────────── */
export const SplitBar = ({ parts }: { parts: { value: number; color: string; label: string }[] }) => {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0) || 1;
  return (
    <div className="splitbar" role="img" aria-label={parts.map((p) => `${p.label} ${Math.round((p.value / total) * 100)}%`).join(', ')}>
      {parts.map((p, i) => (
        <motion.span
          key={p.label}
          style={{ background: p.color }}
          initial={{ width: 0 }}
          animate={{ width: `${(Math.max(0, p.value) / total) * 100}%` }}
          transition={{ type: 'spring', bounce: 0, duration: 0.9, delay: 0.15 + i * 0.05 }}
        />
      ))}
    </div>
  );
};

export const Dot = ({ color }: { color: string }) => (
  <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
);

/* ── Píldoras de estado ─────────────────────────────────────────────────── */
export const Pill = ({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) => (
  <span className="pill" data-tone={tone}>{children}</span>
);

/* ── Control segmentado ─────────────────────────────────────────────────── */
export function Segmented<T extends string>({
  value, options, onChange, id,
}: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; id: string }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} role="tab" aria-selected={on} className="segmented-item" onClick={() => onChange(o.value)}>
            {on && <motion.span layoutId={`segm-${id}`} className="seg-pill" transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }} />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Botones ────────────────────────────────────────────────────────────── */
export const Btn = ({
  variant = 'secondary', size = 'md', className, children, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'md' | 'lg' }) => (
  <button className={clsx('btn', `btn-${variant}`, size === 'lg' && 'btn-lg', className)} {...rest}>{children}</button>
);
