import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import type { FinanceView } from '@/data/financeView';
import { useFormatters } from '@/lib/format';

export function RecentTransactions({ view }: { view: FinanceView }) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const recent = view.ledger.slice(0, 6);
  return (
    <Card>
      <CardHeader
        title={t('dashboard.recent.title')}
        action={
          <Link to="/app/transactions" className="text-brand text-sm font-medium hover:underline">
            {t('common.seeAll')}
          </Link>
        }
      />
      {recent.length === 0 ? (
        <EmptyState title={t('dashboard.recent.empty')} body={t('dashboard.recent.emptyBody')} />
      ) : (
        <ul className="divide-line divide-y">
          {recent.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {e.note || t(`categories.${e.categoryId}`)}
                </p>
                <p className="text-ink-muted text-xs">
                  {t(`categories.${e.categoryId}`)} · {fmt.date(e.date)}
                </p>
              </div>
              <span
                className={`tabular whitespace-nowrap text-sm font-semibold ${e.type === 'income' ? 'text-positive' : ''}`}
              >
                {fmt.money(e.type === 'income' ? e.amount : -e.amount, view.main, { signed: true })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
