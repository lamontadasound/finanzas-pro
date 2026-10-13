import {useStore} from '../../store/useStore';
import { useEffect, useId } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { lockPageScroll } from '../../lib/scrollLock';

interface Props {
  isOpen?: boolean;
  open?: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  width?: string;
}

// Misma API que antes (isOpen/open, onClose, title, size) — solo cambia la
// implementación interna para animar entrada/salida con framer-motion.
export const Modal = ({ isOpen, open, onClose, title, subtitle, children, size = 'md', width }: Props) => {
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const saveError=useStore(s=>s._saveError);
  const visible = isOpen ?? open ?? false;
  const widthClass = width ?? {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }[size];

  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    const unlock = lockPageScroll();
    return () => { document.removeEventListener('keydown', handler); unlock(); };
  }, [visible, onClose]);

  return createPortal(
    <AnimatePresence>
      {visible && (
        <div className="finance-modal fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 finance-scrim"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.96, y: reduceMotion ? 0 : 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.96, y: reduceMotion ? 0 : 28 }}
            transition={reduceMotion ? {duration: 0.12} : {type: 'spring', bounce: 0, duration: 0.45}}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`finance-modal-panel relative w-full ${widthClass} finance-glass finance-sheet rounded-[28px] shadow-popover max-h-[90svh] overflow-y-auto`}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 finance-sheet-heading z-10">
              <div>
                <h2 id={titleId} className="text-base font-semibold text-gray-900">{title}</h2>
                {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                aria-label="Cerrar"
                className="text-gray-400 hover:text-gray-700 transition-colors p-1.5 rounded-lg hover:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>
            <div className="finance-modal-body p-6">{typeof saveError==='string' && saveError && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{saveError}</p>}{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
