import type { HTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

// Contenedor blanco de radio muy generoso — la unidad base de todas las
// superficies Motoko (tablas, gráficos, formularios).
export const ContentCard2 = ({ children, title, description, action, padding = 'lg', className, ...props }: Props) => (
  <div className={clsx('finance-content-card bg-white border border-gray-100 rounded-[28px] shadow-[0_1px_2px_rgba(0,0,0,0.04)]', className)} {...props}>
    {(title || action) && (
      <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
        <div>
          {title && <h3 className="text-[15px] font-semibold text-gray-900">{title}</h3>}
          {description && <p className="text-[13px] text-gray-400 mt-0.5">{description}</p>}
        </div>
        {action}
      </div>
    )}
    <div className={clsx(
      padding === 'none' && '',
      padding === 'sm' && 'p-4',
      padding === 'md' && 'p-5',
      padding === 'lg' && ((title || action) ? 'px-6 pb-6' : 'p-6'),
    )}>
      {children}
    </div>
  </div>
);
