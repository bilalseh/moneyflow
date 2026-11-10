import { type CurrencyCode, type Debt } from '@moneyflow/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, TextInput } from '@/components/ui/Field';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { toast } from '@/components/ui/toast';
import { useSaveDoc } from '@/data/hooks';
import { newId } from '@/lib/ids';
import { bpsToInput, parsePercentToBps } from '@/lib/numberInput';

export function DebtDialog({
  debt,
  currency,
  onClose,
}: {
  debt: Debt | null;
  currency: CurrencyCode;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const save = useSaveDoc('debts', (d) => d.id);
  const [name, setName] = useState(debt?.name ?? '');
  const [balance, setBalance] = useState<number | null>(debt?.balance ?? null);
  const [apr, setApr] = useState(bpsToInput(debt?.aprBps ?? null));
  const [minPayment, setMinPayment] = useState<number | null>(debt?.minPayment ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const debtCurrency = debt?.currency ?? currency;

  const submit = () => {
    const aprBps = parsePercentToBps(apr);
    const next: Record<string, string> = {};
    if (name.trim() === '') next.name = t('onboarding.errors.nameRequired');
    if (balance === null || balance < 0) next.balance = t('onboarding.errors.amountRequired');
    if (aprBps === null) next.apr = t('onboarding.errors.rateInvalid');
    if (minPayment === null || minPayment <= 0)
      next.minPayment = t('onboarding.errors.amountRequired');
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    save.mutate(
      {
        id: debt?.id ?? newId('debt'),
        name: name.trim(),
        balance: balance ?? 0,
        aprBps: aprBps ?? 0,
        minPayment: minPayment ?? 0,
        currency: debtCurrency,
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
    <Dialog open onClose={onClose} title={debt ? t('plan.debts.edit') : t('plan.debts.add')}>
      <form
        noValidate
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label={t('onboarding.debts.name')} error={errors.name} className="sm:col-span-2">
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
        <Field label={t('onboarding.debts.balance')} error={errors.balance}>
          {({ id, describedBy, invalid }) => (
            <MoneyInput
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              currency={debtCurrency}
              value={balance}
              onChange={setBalance}
            />
          )}
        </Field>
        <Field label={t('onboarding.debts.apr')} error={errors.apr}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              inputMode="decimal"
              dir="ltr"
              className="text-end"
              value={apr}
              onChange={(e) => {
                setApr(e.target.value);
              }}
            />
          )}
        </Field>
        <Field
          label={t('onboarding.debts.minPayment')}
          error={errors.minPayment}
          className="sm:col-span-2"
        >
          {({ id, describedBy, invalid }) => (
            <MoneyInput
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              currency={debtCurrency}
              value={minPayment}
              onChange={setMinPayment}
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
