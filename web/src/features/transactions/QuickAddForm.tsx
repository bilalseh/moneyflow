import { EXPENSE_CATEGORY_IDS, todayIso, type CategoryId } from '@moneyflow/shared';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { Field, TextInput } from '@/components/ui/Field';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { Segmented } from '@/components/ui/Tabs';
import { toast } from '@/components/ui/toast';
import { useCollection, useProfile, useSaveDoc } from '@/data/hooks';
import { useQuickAdd } from '@/features/transactions/quickAddStore';
import { newId, nowIso } from '@/lib/ids';

const DEFAULT_CHIPS: CategoryId[] = [
  'groceries',
  'dining',
  'transport',
  'shopping',
  'entertainment',
  'health',
  'subscriptions',
  'other',
];

/** Categories ordered by how often the person used them in the last 200 expenses. */
function useTopCategories(): CategoryId[] {
  const transactions = useCollection('transactions');
  return useMemo(() => {
    const counts = new Map<CategoryId, number>();
    const recent = [...(transactions.data ?? [])]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 200);
    for (const tx of recent)
      if (tx.type === 'expense') counts.set(tx.categoryId, (counts.get(tx.categoryId) ?? 0) + 1);
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    return [...new Set([...ranked, ...DEFAULT_CHIPS])].slice(0, 8);
  }, [transactions.data]);
}

export function QuickAddForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const profile = useProfile();
  const initialType = useQuickAdd((s) => s.type);
  const currency = profile.data?.mainCurrency ?? 'USD';
  const chips = useTopCategories();
  const save = useSaveDoc('transactions', (tx) => tx.id);

  const [type, setType] = useState<'expense' | 'income'>(initialType);
  const [amount, setAmount] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<CategoryId>(
    initialType === 'income' ? 'income' : (chips[0] ?? 'other'),
  );
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (amount === null || amount <= 0) {
      setError(t('quickAdd.amountRequired'));
      return;
    }
    save.mutate(
      {
        id: newId('tx'),
        date,
        amount,
        currency,
        type,
        categoryId: type === 'income' ? 'income' : categoryId,
        note: note.trim(),
        source: 'manual',
        recurringId: null,
        importHash: null,
        createdAt: nowIso(),
      },
      {
        onError: () => {
          toast.error(t('common.saveFailed'));
        },
      },
    );
    toast.success(t('quickAdd.saved'));
    onDone();
  };

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Segmented
        label={t('quickAdd.type')}
        value={type}
        onChange={(v) => {
          setType(v);
          setCategoryId(v === 'income' ? 'income' : (chips[0] ?? 'other'));
        }}
        options={[
          { value: 'expense', label: t('quickAdd.expense') },
          { value: 'income', label: t('quickAdd.income') },
        ]}
      />
      <Field label={t('quickAdd.amount')} error={error ?? undefined}>
        {({ id, describedBy, invalid }) => (
          <MoneyInput
            id={id}
            data-autofocus
            aria-describedby={describedBy}
            aria-invalid={invalid}
            className="h-14 text-2xl font-semibold"
            currency={currency}
            value={amount}
            onChange={(v) => {
              setAmount(v);
              setError(null);
            }}
          />
        )}
      </Field>
      {type === 'expense' && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t('quickAdd.category')}</legend>
          <div className="flex flex-wrap gap-2">
            {chips.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={categoryId === id}
                onClick={() => {
                  setCategoryId(id);
                }}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm font-medium transition',
                  categoryId === id
                    ? 'border-brand bg-brand-soft text-brand-strong'
                    : 'border-line text-ink-muted hover:text-ink',
                )}
              >
                {t(`categories.${id}`)}
              </button>
            ))}
            <label className="sr-only" htmlFor="quick-more">
              {t('quickAdd.moreCategories')}
            </label>
            <select
              id="quick-more"
              value={chips.includes(categoryId) ? '' : categoryId}
              onChange={(e) => {
                if (e.target.value) setCategoryId(e.target.value as CategoryId);
              }}
              className="border-line text-ink-muted rounded-full border bg-transparent px-3 py-1.5 text-sm"
            >
              <option value="">{t('quickAdd.moreCategories')}</option>
              {EXPENSE_CATEGORY_IDS.filter((c) => !chips.includes(c)).map((c) => (
                <option key={c} value={c}>
                  {t(`categories.${c}`)}
                </option>
              ))}
            </select>
          </div>
        </fieldset>
      )}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Field label={t('quickAdd.note')}>
          {({ id }) => (
            <TextInput
              id={id}
              maxLength={200}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
              }}
              placeholder={t('quickAdd.notePlaceholder')}
            />
          )}
        </Field>
        <Field label={t('quickAdd.date')}>
          {({ id }) => (
            <TextInput
              id={id}
              type="date"
              value={date}
              max={todayIso()}
              onChange={(e) => {
                setDate(e.target.value || todayIso());
              }}
            />
          )}
        </Field>
      </div>
      <Button type="submit" size="lg" className="w-full">
        {t('quickAdd.save')}
      </Button>
    </form>
  );
}
