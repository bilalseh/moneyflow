import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button } from '@/components/ui/Button';
import { Field, SelectInput, TextInput } from '@/components/ui/Field';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { RowCard } from '@/features/onboarding/steps/RowCard';
import { StepShell } from '@/features/onboarding/StepShell';
import { useWizard } from '@/features/onboarding/wizardStore';

const schema = z.object({
  incomes: z
    .array(
      z.object({
        name: z.string().max(60, 'tooLong'),
        amount: z.number().int().positive('amountRequired').nullable(),
        kind: z.enum(['fixed', 'variable']),
      }),
    )
    .refine((rows) => rows.some((r) => r.amount !== null && r.amount > 0), 'atLeastOne'),
});
type Values = z.infer<typeof schema>;

export function IncomeStep() {
  const { t } = useTranslation();
  const { data, update, goTo } = useWizard();
  const currency = data.currency ?? 'USD';
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { incomes: data.incomes },
  });
  const rows = useFieldArray({ control: form.control, name: 'incomes' });
  const errors = form.formState.errors.incomes;
  const message = (key?: string) => (key ? t(`onboarding.errors.${key}`) : undefined);

  return (
    <StepShell
      step="income"
      title={t('onboarding.income.title')}
      hint={t('onboarding.income.hint')}
      onBack={() => {
        update('incomes', form.getValues().incomes);
      }}
      onSubmit={form.handleSubmit((values) => {
        update('incomes', values.incomes);
        goTo('fixedCosts');
      })}
    >
      {rows.fields.map((row, i) => (
        <RowCard
          key={row.id}
          label={t('onboarding.income.row', { n: i + 1 })}
          onRemove={
            rows.fields.length > 1
              ? () => {
                  rows.remove(i);
                }
              : undefined
          }
        >
          <Field label={t('onboarding.income.name')} error={message(errors?.[i]?.name?.message)}>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                placeholder={t('onboarding.income.namePlaceholder')}
                {...form.register(`incomes.${i}.name`)}
              />
            )}
          </Field>
          <Field
            label={t('onboarding.income.amount')}
            error={message(errors?.[i]?.amount?.message)}
          >
            {({ id, describedBy, invalid }) => (
              <Controller
                control={form.control}
                name={`incomes.${i}.amount`}
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
          <Field label={t('onboarding.income.kind')} hint={t('onboarding.income.kindHint')}>
            {({ id, describedBy }) => (
              <SelectInput
                id={id}
                aria-describedby={describedBy}
                {...form.register(`incomes.${i}.kind`)}
              >
                <option value="fixed">{t('onboarding.income.fixed')}</option>
                <option value="variable">{t('onboarding.income.variable')}</option>
              </SelectInput>
            )}
          </Field>
        </RowCard>
      ))}
      {errors?.root?.message !== undefined && (
        <p role="alert" className="text-negative text-sm font-medium">
          {message(errors.root.message)}
        </p>
      )}
      <Button
        variant="secondary"
        onClick={() => {
          rows.append({ name: '', amount: null, kind: 'variable' });
        }}
      >
        {t('onboarding.income.add')}
      </Button>
    </StepShell>
  );
}
