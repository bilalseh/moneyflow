import { statusFor } from '@moneyflow/shared';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';

import { ChartFrame } from '@/components/charts/ChartFrame';
import { TimeChart } from '@/components/charts/TimeChart';
import { Icon } from '@/components/Icon';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/Page';
import { PageLoader } from '@/components/ui/PageLoader';
import { useFinanceView } from '@/data/useFinanceView';
import { FactorCard } from '@/features/health/FactorCard';
import { useHealthTips } from '@/features/health/useHealthTips';
import { useScoreSnapshot } from '@/features/health/useScoreSnapshot';
import { useFormatters } from '@/lib/format';
import { getDirection } from '@/lib/i18n';

export function HealthPage() {
  const { t, i18n } = useTranslation();
  const fmt = useFormatters();
  const towards = getDirection(i18n.language) === 'rtl' ? 'left' : 'right';
  const location = useLocation();
  const welcome = (location.state as { welcome?: boolean } | null)?.welcome === true;
  const { view, isLoading, error, refetch } = useFinanceView();
  const { snapshot, history } = useScoreSnapshot(view);
  const tips = useHealthTips(view, snapshot, view?.health ?? null);

  if (isLoading) return <PageLoader />;
  if (error || !view) return <ErrorState error={error} onRetry={refetch} />;

  const score = view.health.score;
  const overall = statusFor(Math.round(score / 4));
  const points = [
    ...history.filter((s) => s.month < view.month).map((s) => ({ month: s.month, score: s.score })),
    { month: view.month, score },
  ].sort((a, b) => a.month.localeCompare(b.month));
  const aiLabel = tips.data?.source === 'ai' ? t('health.tipAi') : t('health.tipRules');

  return (
    <>
      <PageHeader title={t('health.title')} description={t('health.description')} />
      {welcome && (
        <div
          role="status"
          className="border-brand/30 bg-brand-soft mb-6 flex items-start gap-3 rounded-lg border p-4"
        >
          <Icon name="sparkles" className="text-brand-strong mt-0.5" />
          <div>
            <p className="text-brand-strong font-semibold">{t('health.welcomeTitle')}</p>
            <p className="text-ink-muted text-sm">{t('health.welcomeBody')}</p>
          </div>
        </div>
      )}

      <Card className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-ink-muted text-sm">{t('health.scoreLabel')}</p>
          <p className="tabular text-5xl font-bold tracking-tight">
            {score}
            <span className="text-ink-muted text-2xl font-semibold"> / 100</span>
          </p>
          <p className="mt-1 font-medium">{t(`health.overall.${overall}`)}</p>
          <p className="text-ink-muted mt-1 text-xs">
            {view.basisMonths.length > 0
              ? t('health.basisHistory', { count: view.basisMonths.length })
              : t('health.basisPlan')}
          </p>
        </div>
        <div className="w-full max-w-md">
          <div
            role="meter"
            aria-label={t('health.scoreLabel')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={score}
            className="relative h-3 rounded-full"
            style={{
              background: `linear-gradient(to ${towards}, var(--color-negative), var(--color-warning) 50%, var(--color-positive))`,
            }}
          >
            <span
              className="border-surface-raised bg-ink absolute top-1/2 size-5 -translate-y-1/2 rounded-full border-4 shadow"
              style={{ insetInlineStart: `calc(${String(score)}% - 10px)` }}
              aria-hidden="true"
            />
          </div>
          <div className="text-ink-subtle mt-1 flex justify-between text-xs" aria-hidden="true">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <ButtonLink to="/app/plan/simulator" size="sm" variant="secondary">
              {t('health.trySimulator')}
            </ButtonLink>
            <ButtonLink to="/app/coach" size="sm" variant="ghost">
              {t('health.askCoach')}
            </ButtonLink>
          </div>
        </div>
      </Card>

      <h2 className="mb-3 text-lg font-semibold">{t('health.factorsTitle')}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {view.health.factors.map((f) => (
          <FactorCard
            key={f.id}
            factor={f}
            tip={tips.data?.items[f.id]}
            tipLoading={tips.isLoading}
            aiLabel={aiLabel}
          />
        ))}
      </div>

      <div className="mt-6">
        <ChartFrame
          title={t('health.historyTitle')}
          description={t('health.historyDescription')}
          table={{
            headers: [t('common.month'), t('health.scoreLabel')],
            rows: points.map((p) => [fmt.month(p.month), p.score]),
          }}
        >
          <TimeChart
            kind="line"
            data={points}
            xKey="month"
            series={[
              { key: 'score', label: t('health.scoreLabel'), color: 'var(--color-chart-1)' },
            ]}
            formatX={(m) => fmt.month(m, 'short')}
            formatY={(v) => fmt.number(v)}
            height={220}
          />
        </ChartFrame>
      </div>
      <p className="text-ink-muted mt-4 text-xs">{t('health.rulesNote')}</p>
    </>
  );
}
