import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/components/ui/cn';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** "sheet" docks to the bottom on small screens (quick entry), "center" is a modal. */
  variant?: 'center' | 'sheet';
  className?: string;
}

/**
 * Modal built on the native <dialog> element: focus trapping, Escape to
 * close and inert background come from the platform. Focus returns to the
 * element that opened it.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  variant = 'center',
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      if (opener.current instanceof HTMLElement) opener.current.focus();
    }
  }, [open]);

  return (
    // Clicking the backdrop is a mouse convenience; keyboard users close with Escape (native onCancel).
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        'bg-surface-raised text-ink m-auto w-full max-w-lg border-0 p-0 shadow-xl',
        variant === 'sheet'
          ? 'max-sm:mx-0 max-sm:mb-0 max-sm:mt-auto max-sm:max-w-none max-sm:rounded-t-2xl sm:rounded-2xl'
          : 'rounded-2xl',
        className,
      )}
    >
      {open && (
        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 id="dialog-title" className="text-lg font-semibold">
                {title}
              </h2>
              {description !== undefined && (
                <p className="text-ink-muted mt-1 text-sm">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-ink-muted hover:bg-surface-sunken -m-1 rounded-md p-1"
              aria-label={t('common.close')}
            >
              <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
                <path
                  d="M5 5l10 10M15 5L5 15"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
