import { create } from 'zustand';

import { cn } from '@/components/ui/cn';

interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, tone?: Toast['tone']) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, tone = 'info') => {
    const id = nextId++;
    set({ toasts: [...get().toasts, { id, message, tone }] });
    window.setTimeout(() => {
      get().dismiss(id);
    }, 4500);
  },
  dismiss: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

export const toast = {
  info: (m: string) => {
    useToasts.getState().push(m, 'info');
  },
  success: (m: string) => {
    useToasts.getState().push(m, 'success');
  },
  error: (m: string) => {
    useToasts.getState().push(m, 'error');
  },
};

/** Polite live region so screen readers hear every toast. */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div
      aria-live="polite"
      className="no-print pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto flex max-w-md items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium shadow-lg',
            t.tone === 'error' ? 'bg-negative text-white' : 'bg-ink text-surface',
          )}
        >
          <span>{t.message}</span>
          <button
            type="button"
            className="opacity-70 hover:opacity-100"
            onClick={() => {
              dismiss(t.id);
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
