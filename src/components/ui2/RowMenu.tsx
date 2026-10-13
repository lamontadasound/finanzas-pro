import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export interface RowMenuAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
}

// Menú de tres puntos por fila, estilo Motoko — portal para no quedar
// recortado por overflow-x-auto de las tablas.
export const RowMenu2 = ({ actions }: { actions: RowMenuAction[] }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.right - 176 });
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
      >
        <MoreHorizontal size={16} />
      </button>
      {createPortal(
        <AnimatePresence>
          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -4 }}
                transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                style={{ position: 'fixed', top: pos.top, left: pos.left, width: 176 }}
                className="z-50 bg-white rounded-2xl shadow-[0_12px_32px_-8px_rgba(0,0,0,0.16)] border border-gray-100 py-1.5 overflow-hidden"
              >
                {actions.map((a, i) => (
                  <button
                    key={i}
                    onClick={() => { a.onClick(); setOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium text-left transition-colors ${a.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    {a.icon}
                    {a.label}
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
};
