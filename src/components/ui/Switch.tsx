import { motion, useReducedMotion } from 'framer-motion';
import { clsx } from 'clsx';

interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

// Apple Switch — sustituye a los checkboxes usados como sí/no en toda la app.
export const Switch = ({ checked, onChange, label, description, disabled }: Props) => {
  const reduceMotion=useReducedMotion();
  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'apple-toggle relative inline-flex h-[31px] w-[51px] items-center rounded-full transition-colors flex-shrink-0',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/40 focus-visible:ring-offset-1',
        disabled && 'opacity-50 cursor-not-allowed',
        checked ? 'is-on' : 'is-off',
      )}
    >
      <motion.span
        initial={false}
        animate={{x:checked?20:0}}
        transition={reduceMotion?{duration:0}:{type:'spring',stiffness:500,damping:32}}
        className="absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow"
      />
    </button>
  );

  if (!label) return control;

  return (
    <label className="flex items-center justify-between gap-3 py-1 cursor-pointer select-none">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      {control}
    </label>
  );
};
