import { z } from 'zod';

/**
 * Fixed category taxonomy. Each category belongs to one budgeting group,
 * which is what the 50/30/20 method splits on.
 */
export const CATEGORY_IDS = [
  'housing',
  'utilities',
  'groceries',
  'transport',
  'health',
  'insurance',
  'education',
  'debt',
  'dining',
  'shopping',
  'entertainment',
  'travel',
  'subscriptions',
  'personal',
  'gifts',
  'savings',
  'income',
  'other',
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];
export type CategoryGroup = 'needs' | 'wants' | 'savings' | 'income';

export const categoryIdSchema = z.enum(CATEGORY_IDS);

export const CATEGORY_GROUP: Readonly<Record<CategoryId, CategoryGroup>> = {
  housing: 'needs',
  utilities: 'needs',
  groceries: 'needs',
  transport: 'needs',
  health: 'needs',
  insurance: 'needs',
  education: 'needs',
  debt: 'needs',
  dining: 'wants',
  shopping: 'wants',
  entertainment: 'wants',
  travel: 'wants',
  subscriptions: 'wants',
  personal: 'wants',
  gifts: 'wants',
  other: 'wants',
  savings: 'savings',
  income: 'income',
};

/** Categories an expense can use (everything except income). */
export const EXPENSE_CATEGORY_IDS: readonly CategoryId[] = CATEGORY_IDS.filter(
  (id) => id !== 'income',
);

/** Categories a budget line can use: expenses plus savings, never income. */
export const BUDGET_CATEGORY_IDS = EXPENSE_CATEGORY_IDS;

export function categoriesInGroup(group: CategoryGroup): CategoryId[] {
  return CATEGORY_IDS.filter((id) => CATEGORY_GROUP[id] === group);
}

/** True for categories that count as spending, i.e. not savings transfers or income. */
export function isSpendingCategory(id: CategoryId): boolean {
  const group = CATEGORY_GROUP[id];
  return group === 'needs' || group === 'wants';
}
