import { EXPENSE_CATEGORY_IDS } from '@moneyflow/shared';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Field, SelectInput, TextInput } from '@/components/ui/Field';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { RowCard } from '@/features/onboarding/steps/RowCard';
import { StepShell } from '@/features/onboarding/StepShell';
import { useWizard, type FixedCostDraft } from '@/features/onboarding/wizardStore';

interface Values {
  fixedCosts: FixedCostDraft[];
}

export function FixedCostsStep() {
  const { t } = useTranslation();
  const { data, update, goTo } = useWizard();
  const currency = data.currency ?? 'USD';
  const form = useForm<Values>({ defaultValues: { fixedCosts: data.fixedCosts } });
  const rows = useFieldArray({ control: form.control, name: 'fixedCosts' });
  const save = () => {
    update('fixedCosts', form.getValues().fixedCosts);
  };

  return (
    <StepShell
      step="fixedCosts"
      title={t('onboarding.fixedCosts.title')}
      hint={t('onboarding.fixedCosts.hint')}
      onBack={save}
      onSubmit={form.handleSubmit(() => {
        save();
        goTo('debts');
      })}
    >
      {rows.fields.map((row, i) => (
        <RowCard
          key={row.id}
          label={t(`categories.${row.categoryId}`)}
          onRemove={() => {
            rows.remove(i);
          }}
        >
          <Field label={t('onboarding.fixedCosts.category')}>
            {({ id }) => (
              <SelectInput id={id} {...form.register(`fixedCosts.${i}.categoryId`)}>
                {EXPENSE_CATEGORY_IDS.filter((c) => c !== 'savings').map((c) => (
                  <option key={c} value={c}>
                    {t(`categories.${c}`)}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
          <Field
            label={t('onboarding.fixedCosts.amount')}
            hint={t('onboarding.fixedCosts.amountHint')}
          >
            {({ id, describedBy }) => (
              <Controller
                control={form.control}
                name={`fixedCosts.${i}.amount`}
                render={({ field }) => (
                  <MoneyInput
                    id={id}
                    aria-describedby={describedBy}
                    currency={currency}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            )}
          </Field>
          <Field label={t('onboarding.fixedCosts.name')} className="sm:col-span-2">
            {({ id }) => (
              <TextInput
                id={id}
                maxLength={60}
                placeholder={t('onboarding.optional')}
                {...form.register(`fixedCosts.${i}.name`)}
              />
            )}
          </Field>
        </RowCard>
      ))}
      <Button
        variant="secondary"
        onClick={() => {
          rows.append({ name: '', categoryId: 'other', amount: null });
        }}
      >
        {t('onboarding.fixedCosts.add')}
      </Button>
    </StepShell>
  );
}
