import { CURRENCIES, type CurrencyCode } from '@moneyflow/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/components/ui/cn';
import { StepShell } from '@/features/onboarding/StepShell';
import { useWizard } from '@/features/onboarding/wizardStore';

export function CurrencyStep() {
  const { t, i18n } = useTranslation();
  const saved = useWizard((s) => s.data.currency);
  const update = useWizard((s) => s.update);
  const goTo = useWizard((s) => s.goTo);
  const [value, setValue] = useState<CurrencyCode | null>(saved);
  const [error, setError] = useState<string | null>(null);
  const arabic = i18n.language.startsWith('ar');

  return (
    <StepShell
      step="currency"
      title={t('onboarding.currency.title')}
      hint={t('onboarding.currency.hint')}
      onSubmit={(e) => {
        e.preventDefault();
        if (value === null) {
          setError(t('onboarding.currency.required'));
          return;
        }
        update('currency', value);
        goTo('income');
      }}
    >
      <fieldset aria-describedby={error ? 'currency-error' : undefined}>
        <legend className="sr-only">{t('onboarding.currency.title')}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CURRENCIES.map((c) => (
            <label
              key={c.code}
              className={cn(
                'border-line bg-surface-raised flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition',
                'has-[:checked]:border-brand has-[:checked]:ring-brand/30 has-[:checked]:ring-2',
                'has-[:focus-visible]:outline-brand has-[:focus-visible]:outline-2',
              )}
            >
              <input
                type="radio"
                name="currency"
                value={c.code}
                checked={value === c.code}
                onChange={() => {
                  setValue(c.code);
                  setError(null);
                }}
                className="sr-only"
              />
              <span className="bg-surface-sunken rounded-md px-2 py-1 font-mono text-xs font-bold">
                {c.code}
              </span>
              <span className="text-sm">{arabic ? c.nameAr : c.nameEn}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {error !== null && (
        <p id="currency-error" role="alert" className="text-negative text-sm font-medium">
          {error}
        </p>
      )}
    </StepShell>
  );
}
