import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { Card } from './Card';
import { AnimatedNumber } from './AnimatedNumber';

interface Props {
  label: string;
  value: number;
  format?: (n: number) => string;
  icon?: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'gold';
  sub?: string;
  padding?: 'sm' | 'md';
}

const TONE_CLS: Record<NonNullable<Props['tone']>, string> = {
  default: 'text-gray-900',
  success: 'text-emerald-700',
  warning: 'text-amber-600',
  danger: 'text-red-600',
  gold: 'text-gold-600',
};

const ICON_TONE_CLS: Record<NonNullable<Props['tone']>, string> = {
  default: 'bg-gray-100 text-gray-500',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  danger: 'bg-red-50 text-red-600',
  gold: 'bg-gold-50 text-gold-600',
};

// Tarjeta de estadística financiera con cifra animada — pieza base de todos
// los resúmenes (Dashboard, Beneficio, Informes, Impuestos...).
export const StatCard = ({ label, value, format, icon, tone = 'default', sub, padding = 'md' }: Props) => (
  <Card padding={padding} className="finance-stat-widget" data-tone={tone}>
    <div className="flex items-start justify-between gap-2 mb-2">
      <p className="text-sm font-medium text-gray-600">{label}</p>
      {icon && (
        <div className={clsx('w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0', ICON_TONE_CLS[tone])}>
          {icon}
        </div>
      )}
    </div>
    <p className={clsx('text-[clamp(1.5rem,2.3vw,1.9rem)] leading-tight tracking-tight font-semibold tabular-nums break-words', TONE_CLS[tone])}>
      <AnimatedNumber value={value} format={format} />
    </p>
    {sub && <p className="text-xs text-gray-500 mt-2 leading-relaxed">{sub}</p>}
  </Card>
);
