import {
  CADENCES,
  EXPENSE_CATEGORY_IDS,
  todayIso,
  type Cadence,
  type CategoryId,
  type RecurringRule,
} from '@moneyflow/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Badge, EmptyState } from '@/components/ui/Feedback';
import { Field, SelectInput, TextInput } from '@/components/ui/Field';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { PageHeader } from '@/components/ui/Page';
import { Segmented } from '@/components/ui/Tabs';
import { toast } from '@/components/ui/toast';
import { useCollection, useDeleteDoc, useProfile, useSaveDoc } from '@/data/hooks';
import { useFormatters } from '@/lib/format';
import { newId } from '@/lib/ids';

function RuleDialog({ rule, onClose }: { rule: RecurringRule; onClose: () => void }) {
  const { t } = useTranslation();
  const save = useSaveDoc('recurring', (r) => r.id);
  const [draft, setDraft] = useState(rule);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof RecurringRule>(k: K, v: RecurringRule[K]) => {
    setDraft({ ...draft, [k]: v });
  };

  return (
    <Dialog open onClose={onClose} title={t('recurring.editTitle')}>
      <form
        noValidate
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.amount <= 0) {
            setError(t('quickAdd.amountRequired'));
            return;
          }
          save.mutate(
            {
              ...draft,
              note: draft.note.trim(),
              categoryId: draft.type === 'income' ? 'income' : draft.categoryId,
            },
            {
              onSuccess: () => {
                toast.success(t('common.saved'));
                onClose();
              },
            },
          );
        }}
      >
        <div className="sm:col-span-2">
          <Segmented
            label={t('quickAdd.type')}
            value={draft.type}
            onChange={(v) => {
              set('type', v);
            }}
            options={[
              { value: 'expense', label: t('quickAdd.expense') },
              { value: 'income', label: t('quickAdd.income') },
            ]}
          />
        </div>
        <Field label={t('quickAdd.note')} className="sm:col-span-2">
          {({ id }) => (
            <TextInput
              id={id}
              maxLength={200}
              value={draft.note}
              onChange={(e) => {
                set('note', e.target.value);
              }}
            />
          )}
        </Field>
        <Field label={t('quickAdd.amount')} error={error ?? undefined}>
          {({ id, describedBy, invalid }) => (
            <MoneyInput
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              currency={draft.currency}
              value={draft.amount}
              onChange={(v) => {
                set('amount', v ?? 0);
              }}
            />
          )}
        </Field>
        <Field label={t('recurring.cadence')}>
          {({ id }) => (
            <SelectInput
              id={id}
              value={draft.cadence}
              onChange={(e) => {
                set('cadence', e.target.value as Cadence);
              }}
            >
              {CADENCES.map((c) => (
                <option key={c} value={c}>
                  {t(`recurring.cadences.${c}`)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
        {draft.type === 'expense' && (
          <Field label={t('quickAdd.category')}>
            {({ id }) => (
              <SelectInput
                id={id}
                value={draft.categoryId}
                onChange={(e) => {
                  set('categoryId', e.target.value as CategoryId);
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
        <Field label={t('recurring.nextDate')} hint={t('recurring.nextDateHint')}>
          {({ id, describedBy }) => (
            <TextInput
              id={id}
              type="date"
              aria-describedby={describedBy}
              min={todayIso()}
              value={draft.nextDate}
              onChange={(e) => {
                set('nextDate', e.target.value || draft.nextDate);
              }}
            />
          )}
        </Field>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={save.isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function RecurringPage() {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const profile = useProfile();
  const rules = useCollection('recurring');
  const save = useSaveDoc('recurring', (r) => r.id);
  const remove = useDeleteDoc('recurring');
  const [editing, setEditing] = useState<RecurringRule | null>(null);
  const currency = profile.data?.mainCurrency ?? 'USD';
  const blank = (): RecurringRule => ({
    id: newId('rec'),
    type: 'expense',
    amount: 0,
    currency,
    categoryId: 'subscriptions',
    note: '',
    cadence: 'monthly',
    nextDate: todayIso(),
    active: true,
  });
  const sorted = [...(rules.data ?? [])].sort((a, b) => a.nextDate.localeCompare(b.nextDate));

  return (
    <>
      <PageHeader
        title={t('recurring.title')}
        description={t('recurring.description')}
        actions={
          <Button
            onClick={() => {
              setEditing(blank());
            }}
          >
            <Icon name="plus" className="size-4" />
            {t('recurring.add')}
          </Button>
        }
      />
      <Card className="p-0 sm:p-0">
        {sorted.length === 0 ? (
          <EmptyState
            icon={<Icon name="repeat" />}
            title={t('recurring.empty')}
            body={t('recurring.emptyBody')}
          />
        ) : (
          <ul className="divide-line divide-y">
            {sorted.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {r.note || t(`categories.${r.categoryId}`)}
                  </p>
                  <p className="text-ink-muted text-xs">
                    {t(`recurring.cadences.${r.cadence}`)} ·{' '}
                    {t('recurring.next', { date: fmt.date(r.nextDate) })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!r.active && <Badge>{t('recurring.paused')}</Badge>}
                  <span
                    className={`tabular font-semibold ${r.type === 'income' ? 'text-positive' : ''}`}
                  >
                    {fmt.money(r.amount, r.currency)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      save.mutate({ ...r, active: !r.active });
                    }}
                  >
                    {r.active ? t('recurring.pause') : t('recurring.resume')}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEditing(r);
                    }}
                  >
                    {t('common.edit')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t('recurring.delete', { name: r.note })}
                    onClick={() => {
                      if (window.confirm(t('recurring.confirmDelete'))) remove.mutate(r.id);
                    }}
                  >
                    <Icon name="trash" className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {editing && (
        <RuleDialog
          rule={editing}
          onClose={() => {
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
