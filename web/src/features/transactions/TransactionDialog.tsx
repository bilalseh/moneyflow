import {
  EXPENSE_CATEGORY_IDS,
  todayIso,
  type CategoryId,
  type Transaction,
} from '@moneyflow/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, SelectInput, TextInput } from '@/components/ui/Field';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { Segmented } from '@/components/ui/Tabs';
import { toast } from '@/components/ui/toast';
import { useDeleteDoc, useSaveDoc } from '@/data/hooks';

/** Edit or delete one transaction. */
export function TransactionDialog({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const { t } = useTranslation();
  const save = useSaveDoc('transactions', (x) => x.id);
  const remove = useDeleteDoc('transactions');
  const [type, setType] = useState(tx.type);
  const [amount, setAmount] = useState<number | null>(tx.amount);
  const [categoryId, setCategoryId] = useState<CategoryId>(tx.categoryId);
  const [note, setNote] = useState(tx.note);
  const [date, setDate] = useState(tx.date);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (amount === null || amount <= 0) {
      setError(t('quickAdd.amountRequired'));
      return;
    }
    save.mutate(
      {
        ...tx,
        type,
        amount,
        categoryId: type === 'income' ? 'income' : categoryId,
        note: note.trim(),
        date,
      },
      {
        onSuccess: () => {
          toast.success(t('common.saved'));
          onClose();
        },
        onError: () => {
          toast.error(t('common.saveFailed'));
        },
      },
    );
  };

  return (
    <Dialog open onClose={onClose} title={t('transactions.edit')} variant="sheet">
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
          onChange={setType}
          options={[
            { value: 'expense', label: t('quickAdd.expense') },
            { value: 'income', label: t('quickAdd.income') },
          ]}
        />
        <Field label={t('quickAdd.amount')} error={error ?? undefined}>
          {({ id, describedBy, invalid }) => (
            <MoneyInput
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              currency={tx.currency}
              value={amount}
              onChange={setAmount}
            />
          )}
        </Field>
        {type === 'expense' && (
          <Field label={t('quickAdd.category')}>
            {({ id }) => (
              <SelectInput
                id={id}
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value as CategoryId);
                }}
              >
                {EXPENSE_CATEGORY_IDS.map((c) => (
                  <option key={c} value={c}>
                    {t(`categories.${c}`)}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
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
              />
            )}
          </Field>
          <Field label={t('quickAdd.date')}>
            {({ id }) => (
              <TextInput
                id={id}
                type="date"
                max={todayIso()}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value || tx.date);
                }}
              />
            )}
          </Field>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <Button
            variant="ghost"
            className="text-negative"
            onClick={() => {
              if (!window.confirm(t('transactions.confirmDelete'))) return;
              remove.mutate(tx.id, { onSuccess: onClose });
            }}
          >
            {t('common.delete')}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={save.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
