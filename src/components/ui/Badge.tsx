import type { ReactNode } from 'react';
import { clsx } from 'clsx';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'gold';

interface Props {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}

const TONE_CLS: Record<Tone, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger:  'bg-red-50 text-red-600 border-red-200',
  info:    'bg-blue-50 text-blue-700 border-blue-200',
  neutral: 'bg-gray-100 text-gray-600 border-gray-200',
  gold:    'bg-gold-50 text-gold-700 border-gold-200',
};

// Badge de estado — mismo componente para "pendiente/pagado", garantías,
// tipos de gasto, etc. en todas las tablas y tarjetas.
export const Badge = ({ children, tone = 'neutral', className }: Props) => (
  <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-pill text-xs font-medium border', TONE_CLS[tone], className)}>
    {children}
  </span>
);
