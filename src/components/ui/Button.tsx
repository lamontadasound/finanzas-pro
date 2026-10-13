import { forwardRef, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { clsx } from 'clsx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';
type Size = 'sm' | 'md';

type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'ref' | 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration'
>;

interface Props extends NativeButtonProps {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
}

const VARIANT_CLS: Record<Variant, string> = {
  primary:   'bg-gold-500 text-white hover:bg-gold-400 focus-visible:ring-gold-500/40',
  secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 focus-visible:ring-gray-300',
  ghost:     'bg-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100 focus-visible:ring-gray-300',
  danger:    'bg-white text-red-600 border border-red-200 hover:bg-red-50 focus-visible:ring-red-300',
  dark:      'bg-gray-900 text-white hover:bg-gray-700 focus-visible:ring-gray-500',
};

const SIZE_CLS: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg',
  md: 'px-4 py-2 text-sm gap-2 rounded-xl',
};

// Botón base compartido: mismos radios/duraciones/foco en toda la app.
// Microinteracción sutil (escala 0.98 al pulsar) — nunca rebote.
export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'secondary', size = 'md', icon, loading, disabled, children, className, onClick, ...props }, ref) => {
    const reduceMotion = useReducedMotion();
    const busy = useRef(false);
    const [pending, setPending] = useState(false);
    const handleClick: typeof onClick = async event => {
      if (busy.current || disabled || loading) return;
      busy.current = true; setPending(true);
      try { await onClick?.(event); } finally { busy.current = false; setPending(false); }
    };
    return (
    <motion.button
      ref={ref}
      data-variant={variant}
      whileTap={{ scale: disabled || loading || pending || reduceMotion ? 1 : 0.97 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.28 }}
      disabled={disabled || loading || pending}
      aria-busy={loading || pending || undefined}
      onClick={handleClick}
      className={clsx(
        'finance-button inline-flex items-center justify-center font-semibold transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANT_CLS[variant],
        SIZE_CLS[size],
        className,
      )}
      {...props}
    >
      {loading || pending ? (
        <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : icon}
      {children}
    </motion.button>
  );
  },
);
Button.displayName = 'Button';
