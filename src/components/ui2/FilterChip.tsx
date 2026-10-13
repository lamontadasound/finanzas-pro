import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';

interface Props {
  label: string;
  icon?: ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export const FilterChip2 = ({ label, icon, active, onClick, className }: Props) => (
  <button
    onClick={onClick}
    className={clsx(
      'inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-full border transition-colors',
      active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50',
      className,
    )}
  >
    {icon}
    {label}
    <ChevronDown size={12} className={active ? 'text-white/70' : 'text-gray-400'} />
  </button>
);
