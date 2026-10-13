import { AlertTriangle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useConfirmStore } from '../../store/useConfirmStore';

export const ConfirmDialog = () => {
  const { open, message, confirm, cancel } = useConfirmStore();
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={cancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            role="alertdialog"
            aria-modal="true"
            className="relative bg-white border border-gray-200 rounded-card shadow-popover p-6 max-w-sm w-full"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">Confirmar eliminación</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">{message}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={cancel}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirm}
                className="px-4 py-2 bg-red-500 text-white text-sm font-semibold rounded-lg hover:bg-red-600 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
