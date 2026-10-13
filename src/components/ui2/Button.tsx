import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
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

// Motoko-style: negro sólido en píldora para la acción primaria; el resto
// se apoya en blanco/gris. Sin dorado salvo acentos puntuales (focus ring).
const VARIANT_CLS: Record<Variant, string> = {
  primary:   'bg-accent-700 text-white hover:bg-accent-800 focus-visible:ring-accent-700/30',
  secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 focus-visible:ring-gray-300',
  ghost:     'bg-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100 focus-visible:ring-gray-300',
  danger:    'bg-white text-red-600 border border-red-200 hover:bg-red-50 focus-visible:ring-red-300',
};

const SIZE_CLS: Record<Size, string> = {
  sm: 'px-3.5 py-1.5 text-xs gap-1.5 rounded-full',
  md: 'px-5 py-2.5 text-sm gap-2 rounded-full',
};

export const Button2 = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'secondary', size = 'md', icon, loading, disabled, children, className, ...props }, ref) => (
    <motion.button
      ref={ref}
      data-variant={variant}
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
      disabled={disabled || loading}
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
      {loading ? (
        <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : icon}
      {children}
    </motion.button>
  ),
);
Button2.displayName = 'Button2';
