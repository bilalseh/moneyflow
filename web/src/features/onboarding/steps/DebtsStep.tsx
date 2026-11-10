import { zodResolver } from '@hookform/resolvers/zod';
import { monthlyInterest } from '@moneyflow/shared';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { RowCard } from '@/features/onboarding/steps/RowCard';
import { StepShell } from '@/features/onboarding/StepShell';
import { useWizard } from '@/features/onboarding/wizardStore';
import { useFormatters } from '@/lib/format';
import { bpsToInput, parsePercentToBps } from '@/lib/numberInput';

const schema = z.object({
  debts: z.array(
    z.object({
      name: z.string().trim().min(1, 'nameRequired').max(60, 'tooLong'),
      balance: z.number({ error: 'amountRequired' }).int().positive('amountRequired'),
      aprBps: z.number({ error: 'rateInvalid' }).int().min(0).max(10_000, 'rateInvalid'),
      minPayment: z.number({ error: 'amountRequired' }).int().positive('amountRequired'),
    }),
  ),
});
interface Values {
  debts: {
    name: string;
    balance: number | null;
    aprBps: number | null;
    minPayment: number | null;
  }[];
}

export function DebtsStep() {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const { data, update, goTo } = useWizard();
  const currency = data.currency ?? 'USD';
  const form = useForm<Values>({
    resolver: zodResolver(schema) as never,
    defaultValues: { debts: data.debts },
  });
  const rows = useFieldArray({ control: form.control, name: 'debts' });
  const watched = useWatch({ control: form.control, name: 'debts' });
  const errors = form.formState.errors.debts;
  const message = (key?: string) => (key ? t(`onboarding.errors.${key}`) : undefined);

  return (
    <StepShell
      step="debts"
      title={t('onboarding.debts.title')}
      hint={t('onboarding.debts.hint')}
      onBack={() => {
        update('debts', form.getValues().debts);
      }}
      onSubmit={form.handleSubmit((values) => {
        update('debts', values.debts);
        goTo('savings');
      })}
    >
      {rows.fields.length === 0 && <p className="text-ink-muted">{t('onboarding.debts.none')}</p>}
      {rows.fields.map((row, i) => {
        const current = watched[i];
        const interest =
          current?.balance && current.aprBps !== null
            ? monthlyInterest(current.balance, current.aprBps)
            : 0;
        const tooLow =
          current?.minPayment != null && current.minPayment > 0 && current.minPayment <= interest;
        return (
          <RowCard
            key={row.id}
            label={t('onboarding.debts.row', { n: i + 1 })}
            onRemove={() => {
              rows.remove(i);
            }}
          >
            <Field
              label={t('onboarding.debts.name')}
              error={message(errors?.[i]?.name?.message)}
              className="sm:col-span-2"
            >
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  placeholder={t('onboarding.debts.namePlaceholder')}
                  {...form.register(`debts.${i}.name`)}
                />
              )}
            </Field>
            <Field
              label={t('onboarding.debts.balance')}
              error={message(errors?.[i]?.balance?.message)}
            >
              {({ id, describedBy, invalid }) => (
                <Controller
                  control={form.control}
                  name={`debts.${i}.balance`}
                  render={({ field }) => (
                    <MoneyInput
                      id={id}
                      aria-describedby={describedBy}
                      aria-invalid={invalid}
                      currency={currency}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  )}
                />
              )}
            </Field>
            <Field
              label={t('onboarding.debts.apr')}
              hint={t('onboarding.debts.aprHint')}
              error={message(errors?.[i]?.aprBps?.message)}
            >
              {({ id, describedBy, invalid }) => (
                <Controller
                  control={form.control}
                  name={`debts.${i}.aprBps`}
                  render={({ field }) => (
                    <TextInput
                      id={id}
                      aria-describedby={describedBy}
                      aria-invalid={invalid}
                      inputMode="decimal"
                      dir="ltr"
                      className="text-end"
                      defaultValue={bpsToInput(field.value)}
                      onChange={(e) => {
                        field.onChange(parsePercentToBps(e.target.value));
                      }}
                      onBlur={field.onBlur}
                    />
                  )}
                />
              )}
            </Field>
            <Field
              label={t('onboarding.debts.minPayment')}
              error={message(errors?.[i]?.minPayment?.message)}
              hint={
                tooLow
                  ? t('onboarding.debts.tooLow', { interest: fmt.money(interest, currency) })
                  : undefined
              }
              className="sm:col-span-2"
            >
              {({ id, describedBy, invalid }) => (
                <Controller
                  control={form.control}
                  name={`debts.${i}.minPayment`}
                  render={({ field }) => (
                    <MoneyInput
                      id={id}
                      aria-describedby={describedBy}
                      aria-invalid={invalid}
                      currency={currency}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  )}
                />
              )}
            </Field>
          </RowCard>
        );
      })}
      <Button
        variant="secondary"
        onClick={() => {
          rows.append({ name: '', balance: null, aprBps: null, minPayment: null });
        }}
      >
        {t('onboarding.debts.add')}
      </Button>
    </StepShell>
  );
}
