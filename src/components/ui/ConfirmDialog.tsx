import { AlertTriangle } from 'lucide-react';
import { useConfirmStore } from '../../store/useConfirmStore';

export const ConfirmDialog = () => {
  const { open, message, confirm, cancel } = useConfirmStore();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={cancel} />
      <div className="relative bg-surface-700 border border-surface-400/30 rounded-2xl shadow-2xl p-6 max-w-sm w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} className="text-red-400" />
          </div>
          <h3 className="text-base font-semibold text-white">Confirmar eliminación</h3>
        </div>
        <p className="text-sm text-zinc-400 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={cancel}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors rounded-lg hover:bg-surface-600"
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
      </div>
    </div>
  );
};
