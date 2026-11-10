import { formatMoney, getCurrency, type CurrencyCode } from '@moneyflow/shared';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/** BCP 47 locale used by Intl for each UI language. */
export function intlLocale(language: string): string {
  return language.startsWith('ar') ? 'ar' : 'en-US';
}

export interface Formatters {
  locale: string;
  money: (
    amount: number,
    currency: CurrencyCode,
    opts?: { signed?: boolean; compact?: boolean },
  ) => string;
  percent: (ratio: number | null, digits?: number) => string;
  number: (value: number, digits?: number) => string;
  month: (month: string, style?: 'long' | 'short') => string;
  date: (date: string) => string;
}

export function createFormatters(language: string): Formatters {
  const locale = intlLocale(language);
  const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
  return {
    locale,
    money: (amount, currency, opts = {}) => {
      if (opts.compact === true) {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency,
          notation: 'compact',
          maximumFractionDigits: 1,
        }).format(amount / 10 ** getCurrency(currency).minorUnits);
      }
      return formatMoney(
        { amount, currency },
        locale,
        opts.signed === true ? { signDisplay: 'exceptZero' } : {},
      );
    },
    percent: (ratio, digits = 0) =>
      ratio === null
        ? '-'
        : new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: digits }).format(
            ratio,
          ),
    number: (value, digits = 0) =>
      new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value),
    month: (month, style = 'long') =>
      new Intl.DateTimeFormat(locale, { month: style, year: 'numeric', timeZone: 'UTC' }).format(
        utc(`${month}-01`),
      ),
    date: (date) =>
      new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(utc(date)),
  };
}

export function useFormatters(): Formatters {
  const { i18n } = useTranslation();
  return useMemo(() => createFormatters(i18n.language), [i18n.language]);
}
