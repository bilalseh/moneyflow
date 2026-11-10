import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Stat } from '@/components/ui/Page';
import type { FinanceView } from '@/data/financeView';
import { useFormatters } from '@/lib/format';

export function KpiRow({ view }: { view: FinanceView }) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const plannedSpending = (view.budget?.lines ?? [])
    .filter((l) => l.categoryId !== 'savings')
    .reduce((a, l) => a + l.planned, 0);
  const spentShare = plannedSpending > 0 ? view.current.spending / plannedSpending : null;
  const rate = view.health.factors.find((f) => f.id === 'savingsRate')?.value ?? null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
      <Stat
        label={t('dashboard.kpi.spent')}
        value={fmt.money(view.current.spending, view.main)}
        detail={
          spentShare === null
            ? undefined
            : t('dashboard.kpi.ofPlan', { percent: fmt.percent(spentShare) })
        }
        {...(spentShare !== null && spentShare > 1 ? { tone: 'negative' as const } : {})}
      />
      <Stat
        label={t('dashboard.kpi.income')}
        value={fmt.money(view.current.income, view.main)}
        detail={t('dashboard.kpi.thisMonth')}
      />
      <Stat
        label={t('dashboard.kpi.savingsRate')}
        value={fmt.percent(rate)}
        detail={t('dashboard.kpi.basis')}
        {...(rate !== null && rate < 0 ? { tone: 'negative' as const } : {})}
      />
      <Link to="/app/health" className="rounded-card focus-visible:outline-2">
        <Stat
          className="hover:border-brand h-full transition"
          label={t('dashboard.kpi.health')}
          value={`${String(view.health.score)} / 100`}
          detail={t('dashboard.kpi.healthLink')}
        />
      </Link>
      <Stat
        className="col-span-2 lg:col-span-1"
        label={t('dashboard.kpi.netWorth')}
        value={fmt.money(view.netWorth, view.main)}
        detail={t('dashboard.kpi.netWorthDetail')}
        {...(view.netWorth < 0 ? { tone: 'negative' as const } : {})}
      />
    </div>
  );
}
