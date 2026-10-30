import { create } from 'zustand';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

interface ConfirmState {
  isOpen: boolean;
  options: ConfirmDialogOptions;
  resolvePromise: ((value: boolean) => void) | null;
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  handleConfirm: () => void;
  handleCancel: () => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  isOpen: false,
  options: {
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'danger',
  },
  resolvePromise: null,
  confirm: (options: ConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      set({
        isOpen: true,
        options: {
          confirmText: 'Confirm',
          cancelText: 'Cancel',
          type: 'danger',
          ...options,
        },
        resolvePromise: resolve,
      });
    });
  },
  handleConfirm: () => {
    const { resolvePromise } = get();
    if (resolvePromise) resolvePromise(true);
    set({ isOpen: false, resolvePromise: null });
  },
  handleCancel: () => {
    const { resolvePromise } = get();
    if (resolvePromise) resolvePromise(false);
    set({ isOpen: false, resolvePromise: null });
  },
}));

export const confirmDialog = (options: ConfirmDialogOptions): Promise<boolean> => {
  return useConfirmStore.getState().confirm(options);
};
