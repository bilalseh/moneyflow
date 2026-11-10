import { useTranslation } from 'react-i18next';

import { Spinner } from '@/components/ui/Spinner';

export function PageLoader({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className="text-ink-muted flex flex-1 items-center justify-center gap-3 py-24"
    >
      <Spinner />
      <span>{label ?? t('common.loading')}</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`bg-surface-sunken animate-pulse rounded-md ${className ?? 'h-4 w-full'}`}
    />
  );
}
