import { isSpendingCategory, type CategoryId } from '@moneyflow/shared';
import { useTranslation } from 'react-i18next';

import { BarList } from '@/components/charts/BarList';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { EmptyState } from '@/components/ui/Feedback';
import type { FinanceView } from '@/data/financeView';
import { useFormatters } from '@/lib/format';

/** Top categories; the rest fold into "Other" so the list stays readable. */
const MAX_ROWS = 7;

export function SpendingByCategory({ view }: { view: FinanceView }) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const entries = (Object.entries(view.current.byCategory) as [CategoryId, number][])
    .filter(([id, v]) => isSpendingCategory(id) && v > 0)
    .sort((a, b) => b[1] - a[1]);
  const head = entries.slice(0, MAX_ROWS);
  const tail = entries.slice(MAX_ROWS).reduce((a, [, v]) => a + v, 0);
  const rows = [
    ...head.map(([id, value]) => ({ key: id, label: t(`categories.${id}`), value })),
    ...(tail > 0 ? [{ key: 'rest', label: t('dashboard.otherCategories'), value: tail }] : []),
  ];
  const total = view.current.spending;

  return (
    <ChartFrame
      title={t('dashboard.byCategory.title')}
      description={t('dashboard.byCategory.description', { total: fmt.money(total, view.main) })}
      table={{
        headers: [t('common.category'), t('common.amount'), t('dashboard.byCategory.share')],
        rows: rows.map((r) => [
          r.label,
          fmt.money(r.value, view.main),
          fmt.percent(total > 0 ? r.value / total : null),
        ]),
      }}
    >
      {rows.length === 0 ? (
        <EmptyState
          title={t('dashboard.byCategory.empty')}
          body={t('dashboard.byCategory.emptyBody')}
        />
      ) : (
        <BarList
          items={rows.map((r) => ({
            key: r.key,
            label: r.label,
            value: r.value,
            display: fmt.money(r.value, view.main),
            detail: fmt.percent(total > 0 ? r.value / total : null),
          }))}
        />
      )}
    </ChartFrame>
  );
}
