import type { HTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  interactive?: boolean;
  padding?: 'none' | 'sm' | 'md';
}

// Tarjeta base: usada por StatCard, listados en formato tarjeta y contenedores
// generales. Sombra contenida (shadow-card), sin degradados ni glow.
export const Card = ({ children, interactive, padding = 'md', className, ...props }: CardProps) => (
  <div
    className={clsx(
      'finance-card',
      padding === 'md' && 'p-5',
      padding === 'sm' && 'p-4',
      interactive && 'transition-all duration-220 ease-smooth hover:border-gold-400/60 hover:shadow-raised cursor-pointer',
      className,
    )}
    {...props}
  >
    {children}
  </div>
);
