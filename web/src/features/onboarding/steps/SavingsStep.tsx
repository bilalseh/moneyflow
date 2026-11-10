import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/ui/Field';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { StepShell } from '@/features/onboarding/StepShell';
import { useWizard } from '@/features/onboarding/wizardStore';

export function SavingsStep() {
  const { t } = useTranslation();
  const { data, update, goTo } = useWizard();
  const currency = data.currency ?? 'USD';
  const [savings, setSavings] = useState(data.savings);

  return (
    <StepShell
      step="savings"
      title={t('onboarding.savings.title')}
      hint={t('onboarding.savings.hint')}
      onBack={() => {
        update('savings', savings);
      }}
      onSubmit={(e) => {
        e.preventDefault();
        update('savings', savings);
        goTo('goals');
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t('onboarding.savings.savingsBalance')}
          hint={t('onboarding.savings.savingsHint')}
        >
          {({ id, describedBy }) => (
            <MoneyInput
              id={id}
              aria-describedby={describedBy}
              currency={currency}
              value={savings.savingsBalance}
              onChange={(v) => {
                setSavings({ ...savings, savingsBalance: v });
              }}
            />
          )}
        </Field>
        <Field
          label={t('onboarding.savings.emergencyFund')}
          hint={t('onboarding.savings.emergencyHint')}
        >
          {({ id, describedBy }) => (
            <MoneyInput
              id={id}
              aria-describedby={describedBy}
              currency={currency}
              value={savings.emergencyFund}
              onChange={(v) => {
                setSavings({ ...savings, emergencyFund: v });
              }}
            />
          )}
        </Field>
      </div>
    </StepShell>
  );
}
