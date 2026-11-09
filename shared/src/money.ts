import { z } from 'zod';

import { currencyCodeSchema, getCurrency, type CurrencyCode } from './currency';

/**
 * Money is always stored as an integer count of minor units (cents, fils, ...).
 * Floats never enter persistence. Formatting happens at the UI boundary only.
 */
export const minorUnitsSchema = z.number().int();

export const moneySchema = z.object({
  amount: minorUnitsSchema,
  currency: currencyCodeSchema,
});

export type Money = z.infer<typeof moneySchema>;

export function money(amount: number, currency: CurrencyCode): Money {
  return moneySchema.parse({ amount, currency });
}

/** Convert a decimal major-unit value (e.g. 12.34) to minor units (1234). */
export function toMinorUnits(major: number, currency: CurrencyCode): number {
  const { minorUnits } = getCurrency(currency);
  return Math.round(major * 10 ** minorUnits);
}

/** Convert minor units back to a decimal major-unit number for display only. */
export function toMajorUnits(amount: number, currency: CurrencyCode): number {
  const { minorUnits } = getCurrency(currency);
  return amount / 10 ** minorUnits;
}

export function formatMoney(
  value: Money,
  locale: string,
  options: { signDisplay?: 'auto' | 'always' | 'never' | 'exceptZero' } = {},
): string {
  const { minorUnits } = getCurrency(value.currency);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: value.currency,
    minimumFractionDigits: minorUnits,
    maximumFractionDigits: minorUnits,
    ...options,
  }).format(toMajorUnits(value.amount, value.currency));
}
