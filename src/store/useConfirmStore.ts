import { create } from 'zustand';

interface ConfirmState {
  open: boolean;
  message: string;
  onConfirm: (() => void) | null;
  show: (message: string, onConfirm: () => void) => void;
  confirm: () => void;
  cancel: () => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  message: '',
  onConfirm: null,
  show: (message, onConfirm) => set({ open: true, message, onConfirm }),
  confirm: () => { get().onConfirm?.(); set({ open: false, onConfirm: null }); },
  cancel: () => set({ open: false, onConfirm: null }),
}));
