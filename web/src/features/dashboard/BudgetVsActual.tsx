import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { ChartFrame } from '@/components/charts/ChartFrame';
import { Icon } from '@/components/Icon';
import { EmptyState, ProgressBar } from '@/components/ui/Feedback';
import type { FinanceView } from '@/data/financeView';
import { useFormatters } from '@/lib/format';

/** Each planned line against what was actually spent this month. Over-budget lines get an icon, not just color. */
export function BudgetVsActual({ view }: { view: FinanceView }) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const lines = (view.budget?.lines ?? [])
    .filter((l) => l.categoryId !== 'savings')
    .map((l) => ({ ...l, actual: view.current.byCategory[l.categoryId] ?? 0 }))
    .sort((a, b) => b.actual / Math.max(1, b.planned) - a.actual / Math.max(1, a.planned));

  return (
    <ChartFrame
      title={t('dashboard.budget.title')}
      description={t('dashboard.budget.description')}
      action={
        <Link to="/app/plan" className="text-brand text-xs font-medium hover:underline">
          {t('dashboard.budget.edit')}
        </Link>
      }
      table={{
        headers: [
          t('common.category'),
          t('dashboard.budget.planned'),
          t('dashboard.budget.actual'),
        ],
        rows: lines.map((l) => [
          t(`categories.${l.categoryId}`),
          fmt.money(l.planned, view.main),
          fmt.money(l.actual, view.main),
        ]),
      }}
    >
      {lines.length === 0 ? (
        <EmptyState title={t('dashboard.budget.empty')} />
      ) : (
        <ul className="space-y-3">
          {lines.slice(0, 7).map((l) => {
            const over = l.actual > l.planned;
            const ratio = l.planned > 0 ? l.actual / l.planned : l.actual > 0 ? 2 : 0;
            return (
              <li key={l.categoryId}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className="flex items-center gap-1.5 truncate">
                    {over && (
                      <Icon
                        name="alert"
                        className="text-negative size-4"
                        label={t('dashboard.budget.over')}
                      />
                    )}
                    {t(`categories.${l.categoryId}`)}
                  </span>
                  <span className="tabular text-ink-muted whitespace-nowrap">
                    <span
                      className={over ? 'text-negative font-semibold' : 'text-ink font-semibold'}
                    >
                      {fmt.money(l.actual, view.main)}
                    </span>
                    {' / '}
                    {fmt.money(l.planned, view.main)}
                  </span>
                </div>
                <ProgressBar
                  value={Math.min(ratio, 1)}
                  label={t('dashboard.budget.progress', {
                    category: t(`categories.${l.categoryId}`),
                  })}
                  tone={over ? 'negative' : ratio > 0.85 ? 'warning' : 'brand'}
                />
              </li>
            );
          })}
        </ul>
      )}
    </ChartFrame>
  );
}
