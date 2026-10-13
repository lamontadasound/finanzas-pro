import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { AnimatedNumber } from '../ui/AnimatedNumber';

interface Props {
  label: string;
  value: number;
  format?: (n: number) => string;
  icon?: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'gold';
  sub?: string;
}

const ICON_TONE_CLS: Record<NonNullable<Props['tone']>, string> = {
  default: 'bg-gray-100 text-gray-500',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  danger:  'bg-red-50 text-red-600',
  gold:    'bg-gold-50 text-gold-600',
};

const SUB_TONE_CLS: Record<NonNullable<Props['tone']>, string> = {
  default: 'text-gray-400',
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  danger:  'text-red-500',
  gold:    'text-gold-700',
};

// Tarjeta Motoko: icono en círculo, número grande en negro (no en el tono),
// y una línea de contexto pequeña debajo en el color de estado.
export const StatCard2 = ({ label, value, format, icon, tone = 'default', sub }: Props) => (
  <div className="finance-card finance-stat-widget p-5 animate-fade-in-up" data-tone={tone}>
    <div className="flex items-start gap-3 mb-3">
      {icon && (
        <div className={clsx('w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0', ICON_TONE_CLS[tone])}>
          {icon}
        </div>
      )}
      {/* Antes truncaba a una línea con `truncate` — en la rejilla de 2
          columnas de móvil eso cortaba etiquetas legibles a mitad de
          palabra ("Benef. rea…"). Ahora permite hasta 2 líneas completas. */}
      <p className="text-[13px] font-medium text-gray-500 leading-snug line-clamp-2">{label}</p>
    </div>
    <p className="text-[28px] font-semibold tracking-tight tabular-nums text-gray-900 leading-none">
      <AnimatedNumber value={value} format={format} />
    </p>
    {sub && <p className={clsx('text-xs mt-1.5 font-medium', SUB_TONE_CLS[tone])}>{sub}</p>}
  </div>
);
