import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';

export function EmptyState({
  title,
  body,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-4 py-10 text-center', className)}>
      {icon !== undefined && (
        <div className="text-brand bg-brand-soft rounded-full p-3">{icon}</div>
      )}
      <h3 className="font-semibold">{title}</h3>
      {body !== undefined && <p className="text-ink-muted max-w-sm text-sm">{body}</p>}
      {action}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const detail = error instanceof Error ? error.message : undefined;
  return (
    <div
      role="alert"
      className={cn(
        'border-negative/30 bg-negative-soft flex flex-col items-start gap-2 rounded-lg border p-4',
        className,
      )}
    >
      <p className="text-negative font-semibold">{t('common.errorTitle')}</p>
      <p className="text-ink-muted text-sm">{t('common.errorBody')}</p>
      {detail !== undefined && (
        <p className="text-ink-subtle break-all font-mono text-xs">{detail}</p>
      )}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}

const tones = {
  neutral: 'bg-surface-sunken text-ink-muted',
  brand: 'bg-brand-soft text-brand-strong',
  positive: 'bg-positive-soft text-positive',
  warning: 'bg-warning-soft text-warning',
  negative: 'bg-negative-soft text-negative',
} as const;

export type Tone = keyof typeof tones;

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  max = 1,
  label,
  tone = 'brand',
  className,
}: {
  value: number;
  max?: number;
  label: string;
  tone?: 'brand' | 'positive' | 'warning' | 'negative';
  className?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const fill = {
    brand: 'bg-brand',
    positive: 'bg-positive',
    warning: 'bg-warning',
    negative: 'bg-negative',
  }[tone];
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn('bg-surface-sunken h-2 w-full overflow-hidden rounded-full', className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-300', fill)}
        style={{ width: `${String(pct)}%` }}
      />
    </div>
  );
}
