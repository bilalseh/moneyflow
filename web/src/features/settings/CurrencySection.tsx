import {
  CURRENCIES,
  rateSchema,
  type CurrencyCode,
  type Profile,
  type Rates,
} from '@moneyflow/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Field, SelectInput, TextInput } from '@/components/ui/Field';
import { toast } from '@/components/ui/toast';
import { useSaveProfile } from '@/data/hooks';
import { useFinanceView } from '@/data/useFinanceView';
import { normalizeDigits } from '@/lib/numberInput';

/** Main currency and manual exchange rates. No live rates: the person sets what they want to use. */
export function CurrencySection({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const save = useSaveProfile();
  const { view } = useFinanceView();
  const [main, setMain] = useState<CurrencyCode>(profile.mainCurrency);
  const [rates, setRates] = useState<Record<string, string>>({ ...profile.rates });
  const [adding, setAdding] = useState<CurrencyCode | ''>('');
  const [error, setError] = useState<string | null>(null);
  const listed = new Set<string>([...Object.keys(rates), ...(view?.missingRates ?? [])]);
  listed.delete(main);

  const submit = () => {
    const clean: Rates = {};
    for (const code of listed) {
      const value = normalizeDigits(rates[code] ?? '').trim();
      if (value === '') continue;
      if (!rateSchema.safeParse(value).success) {
        setError(t('settings.currency.invalidRate', { code }));
        return;
      }
      clean[code as CurrencyCode] = value;
    }
    setError(null);
    save.mutate(
      { ...profile, mainCurrency: main, rates: clean },
      {
        onSuccess: () => {
          toast.success(t('common.saved'));
        },
        onError: () => {
          toast.error(t('common.saveFailed'));
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader
        title={t('settings.currency.title')}
        description={t('settings.currency.description')}
      />
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label={t('settings.currency.main')} hint={t('settings.currency.mainHint')}>
          {({ id, describedBy }) => (
            <SelectInput
              id={id}
              aria-describedby={describedBy}
              value={main}
              onChange={(e) => {
                setMain(e.target.value as CurrencyCode);
              }}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {c.nameEn}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
        {[...listed].sort().map((code) => (
          <Field
            key={code}
            label={t('settings.currency.rateLabel', { code, main })}
            hint={
              view?.missingRates.includes(code as CurrencyCode)
                ? t('settings.currency.needed')
                : undefined
            }
          >
            {({ id, describedBy }) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                inputMode="decimal"
                dir="ltr"
                className="text-end"
                placeholder="1.00"
                value={rates[code] ?? ''}
                onChange={(e) => {
                  setRates({ ...rates, [code]: e.target.value });
                }}
              />
            )}
          </Field>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="add-rate" className="sr-only">
            {t('settings.currency.addRate')}
          </label>
          <SelectInput
            id="add-rate"
            className="w-auto"
            value={adding}
            onChange={(e) => {
              setAdding(e.target.value as CurrencyCode | '');
            }}
          >
            <option value="">{t('settings.currency.addRate')}</option>
            {CURRENCIES.filter((c) => c.code !== main && !listed.has(c.code)).map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </SelectInput>
          <Button
            variant="secondary"
            size="sm"
            disabled={adding === ''}
            onClick={() => {
              if (adding) {
                setRates({ ...rates, [adding]: '' });
                setAdding('');
              }
            }}
          >
            {t('common.add')}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-negative text-sm">
            {error}
          </p>
        )}
        <Button type="submit" loading={save.isPending}>
          {t('common.save')}
        </Button>
      </form>
    </Card>
  );
}
