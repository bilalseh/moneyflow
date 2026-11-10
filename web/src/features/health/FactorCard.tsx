import type { HealthFactor } from '@moneyflow/shared';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';
import { Card } from '@/components/ui/Card';
import { Badge, ProgressBar } from '@/components/ui/Feedback';
import { Skeleton } from '@/components/ui/PageLoader';
import { formatFactorValue, healthyLabel, STATUS_TONE } from '@/features/health/factors';
import { useFormatters } from '@/lib/format';

export function FactorCard({
  factor,
  tip,
  tipLoading,
  aiLabel,
}: {
  factor: HealthFactor;
  tip: string | undefined;
  tipLoading: boolean;
  aiLabel: string;
}) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const tone = STATUS_TONE[factor.status];
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{t(`health.factors.${factor.id}.title`)}</h3>
          <p className="text-ink-muted text-xs">{t(`health.factors.${factor.id}.definition`)}</p>
        </div>
        <Badge tone={tone}>
          {factor.status !== 'unknown' && (
            <Icon name={factor.status === 'good' ? 'check' : 'alert'} className="size-3.5" />
          )}
          {t(`health.status.${factor.status}`)}
        </Badge>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="tabular text-2xl font-bold">{formatFactorValue(factor, fmt, t)}</p>
        <p className="text-ink-muted text-sm">
          {t('health.points', { points: factor.points, max: factor.maxPoints })}
        </p>
      </div>
      <ProgressBar
        value={factor.points}
        max={factor.maxPoints}
        label={t('health.pointsLabel', { factor: t(`health.factors.${factor.id}.title`) })}
        tone={tone === 'neutral' ? 'brand' : tone}
      />
      <p className="text-ink-muted text-sm">
        <span className="font-medium">{t('health.healthy')}</span> {healthyLabel(factor.id, fmt, t)}
      </p>
      <div className="bg-surface-sunken mt-auto rounded-lg p-3 text-sm">
        <p className="text-ink-subtle mb-1 flex items-center gap-1 text-xs font-semibold">
          <Icon name="sparkles" className="size-3.5" />
          {aiLabel}
        </p>
        {tipLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <p>{tip ?? t(`health.offlineTips.${factor.id}.${factor.status}`)}</p>
        )}
      </div>
    </Card>
  );
}
