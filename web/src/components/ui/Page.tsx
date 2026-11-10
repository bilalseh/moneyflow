import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/components/ui/cn';

/** Page title, document title and an optional action area. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  const { t } = useTranslation();
  useEffect(() => {
    document.title = `${title} · ${t('app.name')}`;
  }, [title, t]);
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description !== undefined && (
          <p className="text-ink-muted mt-1 max-w-2xl">{description}</p>
        )}
      </div>
      {actions !== undefined && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Stat({
  label,
  value,
  detail,
  tone,
  className,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: 'positive' | 'negative' | 'warning';
  className?: string;
}) {
  const toneClass =
    tone === undefined
      ? ''
      : { positive: 'text-positive', negative: 'text-negative', warning: 'text-warning' }[tone];
  return (
    <div
      className={cn('rounded-card border-line bg-surface-raised border p-4 shadow-sm', className)}
    >
      <p className="text-ink-muted text-sm">{label}</p>
      <p className={cn('tabular mt-1 text-2xl font-bold tracking-tight', toneClass)}>{value}</p>
      {detail !== undefined && <p className="text-ink-muted mt-1 text-xs">{detail}</p>}
    </div>
  );
}
