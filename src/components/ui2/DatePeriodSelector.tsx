import { motion } from 'framer-motion';

interface Item<T extends string> { value: T; label: string }
interface Props<T extends string> {
  items: Item<T>[];
  value: T;
  onChange: (v: T) => void;
  layoutId: string;
}

// Selector segmentado Motoko: pista gris, píldora blanca deslizante sobre
// el elemento activo.
export function DatePeriodSelector<T extends string>({ items, value, onChange, layoutId }: Props<T>) {
  return (
    <div className="inline-flex items-center gap-0.5 bg-gray-100 rounded-full p-1">
      {items.map((item) => (
        <button
          key={item.value}
          onClick={() => onChange(item.value)}
          className="relative px-3.5 py-1.5 text-xs font-semibold rounded-full transition-colors duration-150"
        >
          {value === item.value && (
            <motion.span
              layoutId={layoutId}
              className="absolute inset-0 bg-white rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
            />
          )}
          <span className={value === item.value ? 'relative text-gray-900' : 'relative text-gray-500'}>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
