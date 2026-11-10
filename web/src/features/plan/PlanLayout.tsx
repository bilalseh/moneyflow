import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router';

import { cn } from '@/components/ui/cn';
import { ErrorState } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/Page';
import { PageLoader } from '@/components/ui/PageLoader';
import { useFinanceView } from '@/data/useFinanceView';
import type { FinanceView } from '@/data/financeView';

const TABS = [
  { to: '/app/plan', key: 'budget', end: true },
  { to: '/app/plan/goals', key: 'goals', end: false },
  { to: '/app/plan/debts', key: 'debts', end: false },
  { to: '/app/plan/simulator', key: 'simulator', end: false },
] as const;

export interface PlanContext {
  view: FinanceView;
}

export function PlanLayout() {
  const { t } = useTranslation();
  const { view, isLoading, error, refetch } = useFinanceView();

  return (
    <>
      <PageHeader title={t('plan.title')} description={t('plan.description')} />
      <nav
        aria-label={t('plan.tabsLabel')}
        className="border-line mb-6 flex gap-1 overflow-x-auto border-b"
      >
        {TABS.map((tab) => (
          <NavLink
            key={tab.key}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                '-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition',
                isActive
                  ? 'border-brand text-brand'
                  : 'text-ink-muted hover:text-ink border-transparent',
              )
            }
          >
            {t(`plan.tabs.${tab.key}`)}
          </NavLink>
        ))}
      </nav>
      {isLoading ? (
        <PageLoader />
      ) : error || !view ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <Outlet context={{ view } satisfies PlanContext} />
      )}
    </>
  );
}
