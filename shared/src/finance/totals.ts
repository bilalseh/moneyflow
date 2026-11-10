import { CATEGORY_GROUP, isSpendingCategory, type CategoryId } from '../categories';
import { monthOf } from '../dates';

/** A transaction already converted to the main currency. `amount` is positive. */
export interface LedgerEntry {
  date: string;
  amount: number;
  type: 'expense' | 'income';
  categoryId: CategoryId;
}

export type CategoryAmounts = Partial<Record<CategoryId, number>>;

export interface MonthSummary {
  month: string;
  income: number;
  /** Money spent: needs and wants. Transfers to savings are not spending. */
  spending: number;
  /** Expenses booked to the savings category. */
  savedTransfers: number;
  byCategory: CategoryAmounts;
  /** (income - spending) / income, or null without income. */
  savingsRate: number | null;
}

export function summarizeMonth(entries: readonly LedgerEntry[], month: string): MonthSummary {
  let income = 0;
  let spending = 0;
  let savedTransfers = 0;
  const byCategory: CategoryAmounts = {};
  for (const e of entries) {
    if (monthOf(e.date) !== month) continue;
    if (e.type === 'income') {
      income += e.amount;
      continue;
    }
    byCategory[e.categoryId] = (byCategory[e.categoryId] ?? 0) + e.amount;
    if (isSpendingCategory(e.categoryId)) spending += e.amount;
    else savedTransfers += e.amount;
  }
  return {
    month,
    income,
    spending,
    savedTransfers,
    byCategory,
    savingsRate: income > 0 ? (income - spending) / income : null,
  };
}

export function summarizeMonths(
  entries: readonly LedgerEntry[],
  months: readonly string[],
): MonthSummary[] {
  return months.map((m) => summarizeMonth(entries, m));
}

/** Rounded average per category over the given months (missing months count as zero). */
export function averageByCategory(summaries: readonly MonthSummary[]): CategoryAmounts {
  if (summaries.length === 0) return {};
  const totals: CategoryAmounts = {};
  for (const s of summaries) {
    for (const [id, amount] of Object.entries(s.byCategory) as [CategoryId, number][]) {
      totals[id] = (totals[id] ?? 0) + amount;
    }
  }
  const avg: CategoryAmounts = {};
  for (const [id, amount] of Object.entries(totals) as [CategoryId, number][]) {
    avg[id] = Math.round(amount / summaries.length);
  }
  return avg;
}

export function averageOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export function sumAmounts(amounts: CategoryAmounts): number {
  return Object.values(amounts).reduce((a, b) => a + b, 0);
}

/** Spending only (needs and wants), excluding savings transfers. */
export function spendingTotal(amounts: CategoryAmounts): number {
  return (Object.entries(amounts) as [CategoryId, number][])
    .filter(([id]) => isSpendingCategory(id))
    .reduce((a, [, v]) => a + v, 0);
}

/** Spending in the "needs" group: the basis for emergency-fund months. */
export function essentialTotal(amounts: CategoryAmounts): number {
  return (Object.entries(amounts) as [CategoryId, number][])
    .filter(([id]) => CATEGORY_GROUP[id] === 'needs')
    .reduce((a, [, v]) => a + v, 0);
}
