import { motion, useReducedMotion } from 'framer-motion';
import { clsx } from 'clsx';

export interface TabItem<T extends string = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface Props<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  layoutId: string;
  className?: string;
  size?: 'sm' | 'md';
}

// Tabs animadas: el fondo activo se desliza entre pestañas con framer-motion
// (layoutId compartido). Usado para año/mes/trimestre, categorías, vistas.
export function MotionTabs<T extends string>({ items, value, onChange, layoutId, className, size = 'md' }: Props<T>) {
  const reduceMotion = useReducedMotion();
  return (
    <div className={clsx('finance-segmented inline-flex items-center gap-1 rounded-2xl p-1', className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            aria-pressed={active}
            onClick={() => onChange(item.value)}
            className={clsx(
              'relative flex items-center gap-1.5 font-medium rounded-lg transition-colors duration-150',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
              active ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {active && (
              <motion.span
                layoutId={reduceMotion ? undefined : layoutId}
                className="absolute inset-0 bg-white rounded-lg shadow-xs"
                transition={{ type: 'spring', bounce: 0, duration: 0.32 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">{item.icon}{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
