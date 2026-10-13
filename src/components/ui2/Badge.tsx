import type { ReactNode } from 'react';
import { clsx } from 'clsx';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'gold';

interface Props {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}

// Badges Motoko: sin borde, relleno pastel plano, texto en el mismo tono
// pero más oscuro para contraste. El dorado queda como un tono más, no el
// protagonista.
const TONE_CLS: Record<Tone, string> = {
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger:  'bg-red-50 text-red-600',
  info:    'bg-blue-50 text-blue-700',
  neutral: 'bg-gray-100 text-gray-600',
  gold:    'bg-gold-50 text-gold-700',
};

export const Badge2 = ({ children, tone = 'neutral', className }: Props) => (
  <span className={clsx('inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold', TONE_CLS[tone], className)}>
    {children}
  </span>
);
