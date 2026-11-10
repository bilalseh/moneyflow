import { create } from 'zustand';

interface QuickAddState {
  open: boolean;
  type: 'expense' | 'income';
  show: (type?: 'expense' | 'income') => void;
  hide: () => void;
}

export const useQuickAdd = create<QuickAddState>((set) => ({
  open: false,
  type: 'expense',
  show: (type = 'expense') => {
    set({ open: true, type });
  },
  hide: () => {
    set({ open: false });
  },
}));
