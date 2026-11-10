import type { CategoryId } from '../categories';
import { addDays, addMonthsToDate, diffDays } from '../dates';

export const CADENCES = ['weekly', 'monthly', 'yearly'] as const;
export type Cadence = (typeof CADENCES)[number];

interface CadenceRule {
  minDays: number;
  maxDays: number;
  minOccurrences: number;
  perYear: number;
}

/** Interval windows (in days) that classify a series of charges. */
export const CADENCE_RULES: Readonly<Record<Cadence, CadenceRule>> = {
  weekly: { minDays: 6, maxDays: 8, minOccurrences: 3, perYear: 52 },
  monthly: { minDays: 26, maxDays: 35, minOccurrences: 2, perYear: 12 },
  yearly: { minDays: 350, maxDays: 380, minOccurrences: 2, perYear: 1 },
};

/** Charges may vary by this much around the median and still count as the same subscription. */
export const AMOUNT_TOLERANCE = 0.15;

export interface RecurringSource {
  id: string;
  date: string;
  amount: number;
  type: 'expense' | 'income';
  note: string;
  categoryId: CategoryId;
}

export interface RecurringCandidate {
  key: string;
  label: string;
  cadence: Cadence;
  averageAmount: number;
  yearlyTotal: number;
  occurrences: number;
  firstDate: string;
  lastDate: string;
  nextDate: string;
  categoryId: CategoryId;
  transactionIds: string[];
}

const NOISE =
  /\b(inc|ltd|llc|sarl|co|com|www|payment|purchase|pos|card|online|debit|ref|txn|id)\b/g;

/** Merchant key: lowercase letters only, noise words, digits and punctuation removed. */
export function normalizeMerchant(note: string): string {
  return note
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\s]/gu, ' ')
    .replace(NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
}

function mostCommon<T>(values: readonly T[]): T | undefined {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function classify(intervals: readonly number[], count: number): Cadence | null {
  if (intervals.length === 0) return null;
  const typical = median(intervals);
  for (const cadence of CADENCES) {
    const rule = CADENCE_RULES[cadence];
    const fits = intervals.every((d) => d >= rule.minDays && d <= rule.maxDays);
    if (fits && typical >= rule.minDays && count >= rule.minOccurrences) return cadence;
  }
  return null;
}

/**
 * Find charges that repeat at a regular cadence with a stable amount.
 * Groups expenses by normalized merchant, keeps the amounts close to the
 * group's median, and checks every gap falls inside one cadence window.
 */
export function detectRecurring(transactions: readonly RecurringSource[]): RecurringCandidate[] {
  const groups = new Map<string, RecurringSource[]>();
  for (const t of transactions) {
    if (t.type !== 'expense') continue;
    const key = normalizeMerchant(t.note);
    if (key.length < 2) continue;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }

  const result: RecurringCandidate[] = [];
  for (const [key, items] of groups) {
    const typical = median(items.map((t) => t.amount));
    const close = items
      .filter((t) => Math.abs(t.amount - typical) <= typical * AMOUNT_TOLERANCE)
      .sort((a, b) => a.date.localeCompare(b.date));
    const intervals = close.slice(1).map((t, i) => diffDays(close[i]?.date ?? t.date, t.date));
    const cadence = classify(intervals, close.length);
    const first = close[0];
    const last = close[close.length - 1];
    if (cadence === null || first === undefined || last === undefined) continue;

    const averageAmount = Math.round(close.reduce((a, t) => a + t.amount, 0) / close.length);
    const nextDate =
      cadence === 'weekly'
        ? addDays(last.date, 7)
        : addMonthsToDate(last.date, cadence === 'monthly' ? 1 : 12);
    result.push({
      key,
      label: last.note.trim(),
      cadence,
      averageAmount,
      yearlyTotal: averageAmount * CADENCE_RULES[cadence].perYear,
      occurrences: close.length,
      firstDate: first.date,
      lastDate: last.date,
      nextDate,
      categoryId: mostCommon(close.map((t) => t.categoryId)) ?? 'other',
      transactionIds: close.map((t) => t.id),
    });
  }
  return result.sort((a, b) => b.yearlyTotal - a.yearlyTotal || a.key.localeCompare(b.key));
}

/** Next due dates of a recurring rule from `nextDate` up to and including `until`. */
export function dueDates(nextDate: string, cadence: Cadence, until: string, limit = 400): string[] {
  const dates: string[] = [];
  let step = 0;
  let current = nextDate;
  while (current <= until && dates.length < limit) {
    dates.push(current);
    step += 1;
    current =
      cadence === 'weekly'
        ? addDays(nextDate, 7 * step)
        : addMonthsToDate(nextDate, (cadence === 'monthly' ? 1 : 12) * step);
  }
  return dates;
}

/** The date after the last due one, i.e. the rule's new `nextDate`. */
export function advanceDate(nextDate: string, cadence: Cadence, occurrences: number): string {
  if (cadence === 'weekly') return addDays(nextDate, 7 * occurrences);
  return addMonthsToDate(nextDate, (cadence === 'monthly' ? 1 : 12) * occurrences);
}
