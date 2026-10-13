import { Search } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export const SearchInput2 = ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) => (
  <div className={clsx('relative', className)}>
    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
    <input
      {...props}
      className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-full outline-none focus:bg-white focus:border-gray-300 transition-colors placeholder:text-gray-400"
    />
  </div>
);
