import { create } from 'zustand';

interface ConfirmState {
  open: boolean;
  title: string;
  confirmLabel: string;
  message: string;
  onConfirm: (() => void) | null;
  show: (message: string, onConfirm: () => void, options?: {title:string;confirmLabel:string}) => void;
  confirm: () => void;
  cancel: () => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  title: 'Confirmar eliminación',
  confirmLabel: 'Eliminar',
  message: '',
  onConfirm: null,
  show: (message, onConfirm, options) => set({ open: true, message, onConfirm, title:options?.title??'Confirmar eliminación',confirmLabel:options?.confirmLabel??'Eliminar' }),
  confirm: () => { get().onConfirm?.(); set({ open: false, onConfirm: null }); },
  cancel: () => set({ open: false, onConfirm: null }),
}));
