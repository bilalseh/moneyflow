import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';
import { Button, ButtonLink } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/Page';
import { PageLoader } from '@/components/ui/PageLoader';
import { useProfile } from '@/data/hooks';
import { useFinanceView } from '@/data/useFinanceView';
import { BudgetVsActual } from '@/features/dashboard/BudgetVsActual';
import { CoachPrompt } from '@/features/dashboard/CoachPrompt';
import { KpiRow } from '@/features/dashboard/KpiRow';
import { MissingRatesNotice } from '@/features/dashboard/MissingRatesNotice';
import { RecentTransactions } from '@/features/dashboard/RecentTransactions';
import { SpendingByCategory } from '@/features/dashboard/SpendingByCategory';
import { NetWorthChart, SavingsRateChart, TrendChart } from '@/features/dashboard/TrendCharts';
import { useQuickAdd } from '@/features/transactions/quickAddStore';
import { useFormatters } from '@/lib/format';

export function DashboardPage() {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const profile = useProfile();
  const { view, isLoading, error, refetch } = useFinanceView();
  const showQuickAdd = useQuickAdd((s) => s.show);

  if (isLoading) return <PageLoader />;
  if (error || !view) return <ErrorState error={error} onRetry={refetch} />;

  const name = profile.data?.displayName;
  return (
    <>
      <PageHeader
        title={name ? t('dashboard.greetingName', { name }) : t('dashboard.greeting')}
        description={t('dashboard.subtitle', { month: fmt.month(view.month) })}
        actions={
          <>
            <ButtonLink to="/app/transactions/import" variant="secondary">
              <Icon name="upload" className="size-4" />
              {t('dashboard.import')}
            </ButtonLink>
            <Button
              onClick={() => {
                showQuickAdd();
              }}
            >
              <Icon name="plus" className="size-4" />
              {t('dashboard.addExpense')}
            </Button>
          </>
        }
      />
      {view.missingRates.length > 0 && <MissingRatesNotice currencies={view.missingRates} />}
      <KpiRow view={view} />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SpendingByCategory view={view} />
        <BudgetVsActual view={view} />
      </div>
      <div className="mt-6">
        <TrendChart view={view} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SavingsRateChart view={view} />
        <NetWorthChart view={view} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <RecentTransactions view={view} />
        <CoachPrompt />
      </div>
    </>
  );
}
