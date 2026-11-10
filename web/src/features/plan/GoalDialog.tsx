import {
  GOAL_PRIORITIES,
  todayIso,
  type CurrencyCode,
  type Goal,
  type GoalPriority,
} from '@moneyflow/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, SelectInput, TextInput } from '@/components/ui/Field';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { toast } from '@/components/ui/toast';
import { useSaveDoc } from '@/data/hooks';
import { newId, nowIso } from '@/lib/ids';

interface GoalDialogProps {
  open: boolean;
  onClose: () => void;
  goal: Goal | null;
  currency: CurrencyCode;
}

export function GoalDialog({ open, onClose, goal, currency }: GoalDialogProps) {
  const { t } = useTranslation();
  const save = useSaveDoc('goals', (g) => g.id);
  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState<number | null>(goal?.targetAmount ?? null);
  const [saved, setSaved] = useState<number | null>(goal?.savedAmount ?? 0);
  const [date, setDate] = useState(goal?.targetDate ?? '');
  const [priority, setPriority] = useState<GoalPriority>(goal?.priority ?? 'medium');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const goalCurrency = goal?.currency ?? currency;

  const submit = () => {
    const next: Record<string, string> = {};
    if (name.trim() === '') next.name = t('onboarding.errors.nameRequired');
    if (target === null || target <= 0) next.target = t('onboarding.errors.amountRequired');
    if ((saved ?? 0) > (target ?? 0)) next.saved = t('onboarding.errors.savedTooHigh');
    if (date !== '' && date <= todayIso()) next.date = t('onboarding.errors.dateFuture');
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    save.mutate(
      {
        id: goal?.id ?? newId('goal'),
        name: name.trim(),
        targetAmount: target ?? 0,
        savedAmount: saved ?? 0,
        currency: goalCurrency,
        targetDate: date === '' ? null : date,
        priority,
        createdAt: goal?.createdAt ?? nowIso(),
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
    <Dialog open={open} onClose={onClose} title={goal ? t('plan.goals.edit') : t('plan.goals.add')}>
      <form
        noValidate
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label={t('onboarding.goals.name')} error={errors.name} className="sm:col-span-2">
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              maxLength={60}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
            />
          )}
        </Field>
        <Field label={t('onboarding.goals.target')} error={errors.target}>
          {({ id, describedBy, invalid }) => (
            <MoneyInput
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              currency={goalCurrency}
              value={target}
              onChange={setTarget}
            />
          )}
        </Field>
        <Field label={t('onboarding.goals.saved')} error={errors.saved}>
          {({ id, describedBy, invalid }) => (
            <MoneyInput
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              currency={goalCurrency}
              value={saved}
              onChange={setSaved}
            />
          )}
        </Field>
        <Field
          label={t('onboarding.goals.date')}
          hint={t('onboarding.optional')}
          error={errors.date}
        >
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              type="date"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
              }}
            />
          )}
        </Field>
        <Field label={t('onboarding.goals.priority')}>
          {({ id }) => (
            <SelectInput
              id={id}
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value as GoalPriority);
              }}
            >
              {GOAL_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {t(`priority.${p}`)}
                </option>
              ))}
            </SelectInput>
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
