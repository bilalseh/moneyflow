import { detectRecurring, type CategoryId, type RecurringCandidate } from '@moneyflow/shared';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';
import { Card } from '@/components/ui/Card';
import { Badge, EmptyState, ErrorState } from '@/components/ui/Feedback';
import { PageHeader, Stat } from '@/components/ui/Page';
import { PageLoader } from '@/components/ui/PageLoader';
import { useCollection, useSaveDoc } from '@/data/hooks';
import { useFinanceView } from '@/data/useFinanceView';
import { useFormatters } from '@/lib/format';
import { nowIso } from '@/lib/ids';

/** Bills that recur by nature (rent, utilities, loan payments) are listed separately and never flagged. */
const BILL_CATEGORIES: ReadonlySet<CategoryId> = new Set([
  'housing',
  'utilities',
  'insurance',
  'debt',
  'savings',
  'transport',
  'education',
]);

export function SubscriptionsPage() {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const { view, isLoading, error, refetch } = useFinanceView();
  const prefs = useCollection('subscriptionPrefs');
  const save = useSaveDoc('subscriptionPrefs', (p) => p.key);

  const detected = useMemo(() => (view ? detectRecurring(view.ledger) : []), [view]);
  if (isLoading || prefs.isLoading) return <PageLoader />;
  if (error || !view) return <ErrorState error={error} onRetry={refetch} />;

  const used = new Map((prefs.data ?? []).map((p) => [p.key, p.used]));
  const subscriptions = detected.filter((c) => !BILL_CATEGORIES.has(c.categoryId));
  const bills = detected.filter((c) => BILL_CATEGORIES.has(c.categoryId));
  const flagged = subscriptions.filter((c) => used.get(c.key) !== true);
  const yearly = subscriptions.reduce((a, c) => a + c.yearlyTotal, 0);
  const flaggedYearly = flagged.reduce((a, c) => a + c.yearlyTotal, 0);

  const row = (c: RecurringCandidate, flaggable: boolean) => {
    const isUsed = used.get(c.key) === true;
    return (
      <li key={c.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium">
            <span className="truncate">{c.label}</span>
            {flaggable && !isUsed && (
              <Badge tone="warning">
                <Icon name="alert" className="size-3.5" />
                {t('subscriptions.notMarked')}
              </Badge>
            )}
          </p>
          <p className="text-ink-muted text-xs">
            {t(`recurring.cadences.${c.cadence}`)} · {t(`categories.${c.categoryId}`)} ·{' '}
            {t('subscriptions.nextExpected', { date: fmt.date(c.nextDate) })}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="tabular text-end">
            <p className="font-semibold">{fmt.money(c.averageAmount, view.main)}</p>
            <p className="text-ink-muted text-xs">
              {t('common.perYear', { amount: fmt.money(c.yearlyTotal, view.main) })}
            </p>
          </div>
          {flaggable && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-brand size-4"
                checked={isUsed}
                onChange={(e) => {
                  save.mutate({ key: c.key, used: e.target.checked, updatedAt: nowIso() });
                }}
              />
              {t('subscriptions.iUseThis')}
            </label>
          )}
        </div>
      </li>
    );
  };

  return (
    <>
      <PageHeader title={t('subscriptions.title')} description={t('subscriptions.description')} />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label={t('subscriptions.count')} value={fmt.number(subscriptions.length)} />
        <Stat
          label={t('subscriptions.yearly')}
          value={fmt.money(yearly, view.main)}
          detail={t('common.perMonth', { amount: fmt.money(Math.round(yearly / 12), view.main) })}
        />
        <Stat
          label={t('subscriptions.flaggedYearly')}
          value={fmt.money(flaggedYearly, view.main)}
          detail={t('subscriptions.flaggedDetail', { count: flagged.length })}
          {...(flaggedYearly > 0 ? { tone: 'warning' as const } : {})}
        />
      </div>
      <Card className="mb-6 p-0 sm:p-0">
        <h2 className="border-line border-b px-4 py-3 font-semibold">
          {t('subscriptions.listTitle')}
        </h2>
        {subscriptions.length === 0 ? (
          <EmptyState
            icon={<Icon name="repeat" />}
            title={t('subscriptions.empty')}
            body={t('subscriptions.emptyBody')}
          />
        ) : (
          <ul className="divide-line divide-y">{subscriptions.map((c) => row(c, true))}</ul>
        )}
      </Card>
      {bills.length > 0 && (
        <Card className="p-0 sm:p-0">
          <h2 className="border-line border-b px-4 py-3 font-semibold">
            {t('subscriptions.billsTitle')}
          </h2>
          <ul className="divide-line divide-y">{bills.map((c) => row(c, false))}</ul>
        </Card>
      )}
      <p className="text-ink-muted mt-4 text-xs">{t('subscriptions.howDetected')}</p>
    </>
  );
}
