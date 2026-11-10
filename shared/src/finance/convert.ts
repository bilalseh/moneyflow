import { z } from 'zod';

import { getCurrency, type CurrencyCode } from '../currency';

/**
 * Manual exchange rates, relative to the user's main currency:
 * `rates.EUR = "1.08"` means 1 EUR is worth 1.08 units of the main currency.
 * Rates are decimal strings and the math runs on BigInt, so no float ever
 * touches a stored amount.
 */
export type Rates = Partial<Record<CurrencyCode, string>>;

export const rateSchema = z
  .string()
  .regex(/^\d{1,12}(\.\d{1,12})?$/, 'Use digits with an optional decimal point')
  .refine((v) => Number(v) > 0, 'Rate must be greater than zero');

export class MissingRateError extends Error {
  constructor(readonly currency: CurrencyCode) {
    super(`No exchange rate set for ${currency}`);
    this.name = 'MissingRateError';
  }
}

function parseRate(rate: string): { num: bigint; den: bigint } {
  const [whole = '0', fraction = ''] = rate.split('.');
  return { num: BigInt(whole + fraction), den: 10n ** BigInt(fraction.length) };
}

/** Integer division rounding half away from zero. */
export function divRound(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const q = (n * 2n + d) / (2n * d);
  return negative ? -q : q;
}

/** Convert an amount in minor units of `from` into minor units of `main`. */
export function toMain(
  amount: number,
  from: CurrencyCode,
  main: CurrencyCode,
  rates: Rates,
): number {
  if (from === main) return amount;
  const rate = rates[from];
  if (rate === undefined) throw new MissingRateError(from);
  const { num, den } = parseRate(rate);
  const fromScale = 10n ** BigInt(getCurrency(from).minorUnits);
  const mainScale = 10n ** BigInt(getCurrency(main).minorUnits);
  return Number(divRound(BigInt(amount) * num * mainScale, den * fromScale));
}

/** Convert minor units of `main` into minor units of `to`. */
export function fromMain(
  amount: number,
  to: CurrencyCode,
  main: CurrencyCode,
  rates: Rates,
): number {
  if (to === main) return amount;
  const rate = rates[to];
  if (rate === undefined) throw new MissingRateError(to);
  const { num, den } = parseRate(rate);
  const toScale = 10n ** BigInt(getCurrency(to).minorUnits);
  const mainScale = 10n ** BigInt(getCurrency(main).minorUnits);
  return Number(divRound(BigInt(amount) * den * toScale, num * mainScale));
}

export interface ConvertedSum {
  total: number;
  missing: CurrencyCode[];
}

/** Sum amounts in the main currency, skipping (and reporting) currencies without a rate. */
export function sumInMain(
  items: readonly { amount: number; currency: CurrencyCode }[],
  main: CurrencyCode,
  rates: Rates,
): ConvertedSum {
  const missing = new Set<CurrencyCode>();
  let total = 0;
  for (const item of items) {
    try {
      total += toMain(item.amount, item.currency, main, rates);
    } catch (error) {
      if (error instanceof MissingRateError) missing.add(error.currency);
      else throw error;
    }
  }
  return { total, missing: [...missing] };
}
