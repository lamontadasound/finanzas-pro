import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

// Estado vacío consistente para tablas/listados sin datos aún.
export const EmptyState = ({ icon, title, description, action }: Props) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.22 }}
    className="flex flex-col items-center justify-center text-center py-16 px-4"
  >
    {icon && <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-3">{icon}</div>}
    <p className="text-sm font-medium text-gray-600">{title}</p>
    {description && <p className="text-xs text-gray-400 mt-1 max-w-xs">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </motion.div>
);
