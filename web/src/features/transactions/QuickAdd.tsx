import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';
import { cn } from '@/components/ui/cn';
import { Dialog } from '@/components/ui/Dialog';
import { QuickAddForm } from '@/features/transactions/QuickAddForm';
import { useQuickAdd } from '@/features/transactions/quickAddStore';

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/** Floating "+" on phones, a full-width button in the desktop sidebar. */
export function QuickAddButton({ variant }: { variant: 'fab' | 'sidebar' }) {
  const { t } = useTranslation();
  const show = useQuickAdd((s) => s.show);
  return (
    <button
      type="button"
      onClick={() => {
        show();
      }}
      aria-keyshortcuts="N"
      aria-label={variant === 'fab' ? t('quickAdd.open') : undefined}
      className={cn(
        'bg-brand text-on-brand hover:bg-brand-strong flex items-center justify-center font-semibold shadow-md transition',
        variant === 'fab'
          ? '-mt-6 size-14 rounded-full'
          : 'h-10 w-full gap-2 rounded-lg px-3 text-sm',
      )}
    >
      <Icon name="plus" className={variant === 'fab' ? 'size-7' : 'size-5'} />
      {variant === 'sidebar' && (
        <>
          {t('quickAdd.open')}
          <kbd className="ms-auto rounded bg-black/15 px-1.5 text-xs">N</kbd>
        </>
      )}
    </button>
  );
}

/** The quick-entry dialog, mounted once per app shell. Press N anywhere to open it. */
export function QuickAddHost() {
  const { t } = useTranslation();
  const { open, show, hide } = useQuickAdd();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === 'n' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isTyping(e.target)
      ) {
        e.preventDefault();
        show();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [show]);

  return (
    <Dialog open={open} onClose={hide} title={t('quickAdd.title')} variant="sheet">
      <QuickAddForm onDone={hide} />
    </Dialog>
  );
}
