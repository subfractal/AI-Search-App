import { create } from 'zustand';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  createdAt: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

let nextId = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  addToast: (message, type = 'info') => {
    const id = `toast-${++nextId}`;
    const toast: Toast = { id, message, type, createdAt: Date.now() };
    set((s) => ({ toasts: [...s.toasts, toast] }));
    // Auto-remove after 4 seconds
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },

  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

// Convenience functions for use outside React
export const toast = {
  info: (msg: string) => useToastStore.getState().addToast(msg, 'info'),
  success: (msg: string) => useToastStore.getState().addToast(msg, 'success'),
  warning: (msg: string) => useToastStore.getState().addToast(msg, 'warning'),
  error: (msg: string) => useToastStore.getState().addToast(msg, 'error'),
};
