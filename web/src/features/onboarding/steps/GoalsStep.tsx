import { zodResolver } from '@hookform/resolvers/zod';
import { GOAL_PRIORITIES, todayIso } from '@moneyflow/shared';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button } from '@/components/ui/Button';
import { Field, SelectInput, TextInput } from '@/components/ui/Field';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { RowCard } from '@/features/onboarding/steps/RowCard';
import { StepShell } from '@/features/onboarding/StepShell';
import { useWizard, type GoalDraft } from '@/features/onboarding/wizardStore';

const schema = z.object({
  goals: z.array(
    z
      .object({
        name: z.string().trim().min(1, 'nameRequired').max(60, 'tooLong'),
        targetAmount: z.number({ error: 'amountRequired' }).int().positive('amountRequired'),
        savedAmount: z.number().int().min(0).nullable(),
        targetDate: z.string().refine((d) => d === '' || d > todayIso(), 'dateFuture'),
        priority: z.enum(GOAL_PRIORITIES),
      })
      .refine((g) => (g.savedAmount ?? 0) <= g.targetAmount, {
        message: 'savedTooHigh',
        path: ['savedAmount'],
      }),
  ),
});

export function GoalsStep() {
  const { t } = useTranslation();
  const { data, update, goTo } = useWizard();
  const currency = data.currency ?? 'USD';
  const form = useForm<{ goals: GoalDraft[] }>({
    resolver: zodResolver(schema) as never,
    defaultValues: { goals: data.goals },
  });
  const rows = useFieldArray({ control: form.control, name: 'goals' });
  const errors = form.formState.errors.goals;
  const message = (key?: string) => (key ? t(`onboarding.errors.${key}`) : undefined);

  return (
    <StepShell
      step="goals"
      title={t('onboarding.goals.title')}
      hint={t('onboarding.goals.hint')}
      onBack={() => {
        update('goals', form.getValues().goals);
      }}
      onSubmit={form.handleSubmit((values) => {
        update('goals', values.goals);
        goTo('review');
      })}
    >
      {rows.fields.length === 0 && <p className="text-ink-muted">{t('onboarding.goals.none')}</p>}
      {rows.fields.map((row, i) => (
        <RowCard
          key={row.id}
          label={t('onboarding.goals.row', { n: i + 1 })}
          onRemove={() => {
            rows.remove(i);
          }}
        >
          <Field
            label={t('onboarding.goals.name')}
            error={message(errors?.[i]?.name?.message)}
            className="sm:col-span-2"
          >
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                placeholder={t('onboarding.goals.namePlaceholder')}
                {...form.register(`goals.${i}.name`)}
              />
            )}
          </Field>
          <Field
            label={t('onboarding.goals.target')}
            error={message(errors?.[i]?.targetAmount?.message)}
          >
            {({ id, describedBy, invalid }) => (
              <Controller
                control={form.control}
                name={`goals.${i}.targetAmount`}
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
            label={t('onboarding.goals.saved')}
            error={message(errors?.[i]?.savedAmount?.message)}
          >
            {({ id, describedBy, invalid }) => (
              <Controller
                control={form.control}
                name={`goals.${i}.savedAmount`}
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
            label={t('onboarding.goals.date')}
            hint={t('onboarding.optional')}
            error={message(errors?.[i]?.targetDate?.message)}
          >
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                type="date"
                aria-describedby={describedBy}
                aria-invalid={invalid}
                {...form.register(`goals.${i}.targetDate`)}
              />
            )}
          </Field>
          <Field label={t('onboarding.goals.priority')}>
            {({ id }) => (
              <SelectInput id={id} {...form.register(`goals.${i}.priority`)}>
                {GOAL_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {t(`priority.${p}`)}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
        </RowCard>
      ))}
      <Button
        variant="secondary"
        onClick={() => {
          rows.append({
            name: '',
            targetAmount: null,
            savedAmount: null,
            targetDate: '',
            priority: 'medium',
          });
        }}
      >
        {t('onboarding.goals.add')}
      </Button>
    </StepShell>
  );
}
