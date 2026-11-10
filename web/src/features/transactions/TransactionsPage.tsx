import {
  addMonths,
  CATEGORY_IDS,
  currentMonth,
  monthOf,
  type CategoryId,
  type Transaction,
} from '@moneyflow/shared';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/Feedback';
import { SelectInput, TextInput } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Page';
import { PageLoader } from '@/components/ui/PageLoader';
import { Segmented } from '@/components/ui/Tabs';
import { useCollection } from '@/data/hooks';
import { useQuickAdd } from '@/features/transactions/quickAddStore';
import { TransactionDialog } from '@/features/transactions/TransactionDialog';
import { useFormatters } from '@/lib/format';

type TypeFilter = 'all' | 'expense' | 'income';

export function TransactionsPage() {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const transactions = useCollection('transactions');
  const showQuickAdd = useQuickAdd((s) => s.show);
  const [month, setMonth] = useState(currentMonth());
  const [type, setType] = useState<TypeFilter>('all');
  const [category, setCategory] = useState<CategoryId | ''>('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Transaction | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (transactions.data ?? [])
      .filter((tx) => monthOf(tx.date) === month)
      .filter((tx) => type === 'all' || tx.type === type)
      .filter((tx) => category === '' || tx.categoryId === category)
      .filter((tx) => q === '' || tx.note.toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [transactions.data, month, type, category, query]);

  const byDay = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    for (const tx of filtered) groups.set(tx.date, [...(groups.get(tx.date) ?? []), tx]);
    return [...groups.entries()];
  }, [filtered]);

  return (
    <>
      <PageHeader
        title={t('transactions.title')}
        description={t('transactions.description')}
        actions={
          <>
            <ButtonLink to="/app/transactions/recurring" variant="ghost">
              <Icon name="repeat" className="size-4" />
              {t('transactions.recurring')}
            </ButtonLink>
            <ButtonLink to="/app/transactions/import" variant="secondary">
              <Icon name="upload" className="size-4" />
              {t('transactions.import')}
            </ButtonLink>
            <Button
              onClick={() => {
                showQuickAdd();
              }}
            >
              <Icon name="plus" className="size-4" />
              {t('quickAdd.open')}
            </Button>
          </>
        }
      />
      <Card className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label={t('transactions.previousMonth')}
            onClick={() => {
              setMonth(addMonths(month, -1));
            }}
          >
            <Icon name="chevronStart" className="size-4 rtl:-scale-x-100" />
          </Button>
          <span className="min-w-36 text-center font-semibold" aria-live="polite">
            {fmt.month(month)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            aria-label={t('transactions.nextMonth')}
            disabled={month >= currentMonth()}
            onClick={() => {
              setMonth(addMonths(month, 1));
            }}
          >
            <Icon name="chevronEnd" className="size-4 rtl:-scale-x-100" />
          </Button>
        </div>
        <Segmented
          label={t('transactions.typeFilter')}
          value={type}
          onChange={setType}
          options={[
            { value: 'all', label: t('transactions.all') },
            { value: 'expense', label: t('quickAdd.expense') },
            { value: 'income', label: t('quickAdd.income') },
          ]}
        />
        <label className="sr-only" htmlFor="tx-category">
          {t('common.category')}
        </label>
        <SelectInput
          id="tx-category"
          className="w-auto"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value as CategoryId | '');
          }}
        >
          <option value="">{t('transactions.allCategories')}</option>
          {CATEGORY_IDS.map((c) => (
            <option key={c} value={c}>
              {t(`categories.${c}`)}
            </option>
          ))}
        </SelectInput>
        <label className="sr-only" htmlFor="tx-search">
          {t('transactions.search')}
        </label>
        <TextInput
          id="tx-search"
          type="search"
          className="w-auto min-w-40 flex-1"
          placeholder={t('transactions.search')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
        />
      </Card>

      {transactions.isLoading ? (
        <PageLoader />
      ) : transactions.error ? (
        <ErrorState error={transactions.error} onRetry={() => void transactions.refetch()} />
      ) : byDay.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icon name="list" />}
            title={t('transactions.empty')}
            body={t('transactions.emptyBody')}
            action={
              <Button
                onClick={() => {
                  showQuickAdd();
                }}
              >
                {t('quickAdd.open')}
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {byDay.map(([date, items]) => (
            <section key={date} aria-labelledby={`day-${date}`}>
              <h2
                id={`day-${date}`}
                className="text-ink-muted mb-1.5 text-xs font-semibold uppercase tracking-wide"
              >
                {fmt.date(date)}
              </h2>
              <Card className="p-0 sm:p-0">
                <ul className="divide-line divide-y">
                  {items.map((tx) => (
                    <li key={tx.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(tx);
                        }}
                        className="hover:bg-surface-sunken flex w-full items-center justify-between gap-3 px-4 py-3 text-start"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {tx.note || t(`categories.${tx.categoryId}`)}
                          </span>
                          <span className="text-ink-muted flex items-center gap-1.5 text-xs">
                            {t(`categories.${tx.categoryId}`)}
                            {tx.source !== 'manual' && tx.source !== 'demo' && (
                              <span>· {t(`transactions.source.${tx.source}`)}</span>
                            )}
                          </span>
                        </span>
                        <span
                          className={`tabular whitespace-nowrap text-sm font-semibold ${tx.type === 'income' ? 'text-positive' : ''}`}
                        >
                          {fmt.money(tx.type === 'income' ? tx.amount : -tx.amount, tx.currency, {
                            signed: true,
                          })}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
      {editing && (
        <TransactionDialog
          tx={editing}
          onClose={() => {
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
