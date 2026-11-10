import { CATEGORY_GROUP, CATEGORY_IDS, type CategoryId } from '../categories';
import { allocate } from './allocate';
import type { CategoryAmounts } from './totals';

export const BUDGET_METHODS = ['fiftyThirtyTwenty', 'zeroBased', 'custom'] as const;
export type BudgetMethod = (typeof BUDGET_METHODS)[number];

export interface BudgetInput {
  /** Expected monthly income in main-currency minor units. */
  income: number;
  /** Committed monthly costs by category (rent, utilities, ...). */
  fixedCosts: CategoryAmounts;
  /** Sum of minimum monthly debt payments. Booked to the debt category. */
  debtMinimums: number;
  /** Monthly amount the user wants to put towards goals. */
  goalContributions: number;
  /** Average monthly spending by category from history (may be empty). */
  history: CategoryAmounts;
}

export interface BudgetLine {
  categoryId: CategoryId;
  planned: number;
}

export interface BudgetPlan {
  method: BudgetMethod;
  income: number;
  lines: BudgetLine[];
  totals: { needs: number; wants: number; savings: number };
  /** income minus all planned lines. Zero for zero-based; negative means over-planned. */
  unassigned: number;
  /** Fixed commitments alone exceed the needs share (50/30/20) or the income. */
  overCommitted: boolean;
}

/** Default weights used when there is no spending history yet. */
const DEFAULT_WEIGHTS: CategoryAmounts = {
  groceries: 4,
  transport: 2,
  utilities: 1,
  health: 1,
  dining: 2,
  shopping: 2,
  entertainment: 1,
  subscriptions: 1,
  personal: 1,
};

function commitments(input: BudgetInput): CategoryAmounts {
  const c: CategoryAmounts = { ...input.fixedCosts };
  if (input.debtMinimums > 0) c.debt = (c.debt ?? 0) + input.debtMinimums;
  return c;
}

/** Variable categories in a group, weighted by history or the defaults. */
function weightsFor(group: 'needs' | 'wants', input: BudgetInput, fixed: CategoryAmounts) {
  const ids = CATEGORY_IDS.filter(
    (id) => CATEGORY_GROUP[id] === group && fixed[id] === undefined && id !== 'debt',
  );
  const fromHistory = ids.filter((id) => (input.history[id] ?? 0) > 0);
  const source = fromHistory.length > 0 ? input.history : DEFAULT_WEIGHTS;
  const chosen = ids.filter((id) => (source[id] ?? 0) > 0);
  return { ids: chosen, weights: chosen.map((id) => source[id] ?? 0) };
}

function distribute(total: number, ids: CategoryId[], weights: number[], into: CategoryAmounts) {
  if (total <= 0 || ids.length === 0) return;
  allocate(total, weights).forEach((amount, i) => {
    const id = ids[i];
    if (id !== undefined && amount > 0) into[id] = (into[id] ?? 0) + amount;
  });
}

function finish(
  method: BudgetMethod,
  income: number,
  amounts: CategoryAmounts,
  overCommitted: boolean,
) {
  const lines = CATEGORY_IDS.filter((id) => (amounts[id] ?? 0) > 0).map((id) => ({
    categoryId: id,
    planned: amounts[id] ?? 0,
  }));
  const totals = { needs: 0, wants: 0, savings: 0 };
  for (const l of lines) {
    const g = CATEGORY_GROUP[l.categoryId];
    if (g === 'needs' || g === 'wants' || g === 'savings') totals[g] += l.planned;
  }
  const planned = totals.needs + totals.wants + totals.savings;
  return {
    method,
    income,
    lines,
    totals,
    unassigned: income - planned,
    overCommitted,
  } satisfies BudgetPlan;
}

/** 50/30/20: half for needs, 30% wants, 20% savings. Fixed costs are honoured first. */
function fiftyThirtyTwenty(input: BudgetInput): BudgetPlan {
  const [needsTarget = 0, wantsTarget = 0, savingsTarget = 0] = allocate(
    input.income,
    [50, 30, 20],
  );
  const amounts = commitments(input);
  const committed = Object.values(amounts).reduce((a, b) => a + b, 0);
  const overflow = Math.max(0, committed - needsTarget);
  const wants = Math.max(0, wantsTarget - overflow);
  const savings = Math.max(0, savingsTarget - Math.max(0, overflow - wantsTarget));

  const needs = weightsFor('needs', input, amounts);
  distribute(needsTarget - committed, needs.ids, needs.weights, amounts);
  const wantW = weightsFor('wants', input, amounts);
  distribute(wants, wantW.ids, wantW.weights, amounts);
  if (savings > 0) amounts.savings = savings;
  return finish('fiftyThirtyTwenty', input.income, amounts, overflow > 0);
}

/** Zero-based: every unit of income gets a job; leftovers go to savings. */
function zeroBased(input: BudgetInput): BudgetPlan {
  const amounts = commitments(input);
  const committed = Object.values(amounts).reduce((a, b) => a + b, 0);
  const goal = Math.max(0, Math.min(input.goalContributions, input.income - committed));
  let free = input.income - committed - goal;

  const needs = weightsFor('needs', input, amounts);
  const wants = weightsFor('wants', input, amounts);
  const ids = [...needs.ids, ...wants.ids];
  const historyWanted = ids.map((id) => input.history[id] ?? 0);
  const historyTotal = historyWanted.reduce((a, b) => a + b, 0);
  if (free > 0 && historyTotal > 0) {
    // Fund each category up to its historical average, then save the rest.
    const give = Math.min(free, historyTotal);
    distribute(give, ids, historyWanted, amounts);
    free -= give;
  } else if (free > 0) {
    // No history yet: give 80% to everyday categories by default weights, save 20%.
    const give = Math.floor((free * 4) / 5);
    distribute(give, ids, [...needs.weights, ...wants.weights], amounts);
    free -= give;
  }
  const savings = goal + Math.max(0, free);
  if (savings > 0) amounts.savings = savings;
  return finish('zeroBased', input.income, amounts, committed > input.income);
}

/** Custom: start from history plus commitments; the user edits from there. */
function custom(input: BudgetInput): BudgetPlan {
  const amounts = commitments(input);
  for (const [id, value] of Object.entries(input.history) as [CategoryId, number][]) {
    if (CATEGORY_GROUP[id] === 'income' || id === 'savings') continue;
    amounts[id] = Math.max(amounts[id] ?? 0, value);
  }
  if (input.goalContributions > 0) amounts.savings = input.goalContributions;
  const committed = Object.values(commitments(input)).reduce((a, b) => a + b, 0);
  return finish('custom', input.income, amounts, committed > input.income);
}

export function buildBudget(method: BudgetMethod, input: BudgetInput): BudgetPlan {
  if (method === 'fiftyThirtyTwenty') return fiftyThirtyTwenty(input);
  if (method === 'zeroBased') return zeroBased(input);
  return custom(input);
}

/** Recompute totals after the user edits lines by hand. */
export function summarizeLines(method: BudgetMethod, income: number, lines: readonly BudgetLine[]) {
  const amounts: CategoryAmounts = {};
  for (const l of lines) amounts[l.categoryId] = (amounts[l.categoryId] ?? 0) + l.planned;
  return finish(method, income, amounts, false);
}

/** Apply a percentage change to one line, rounding to the nearest minor unit. */
export function adjustLine(lines: readonly BudgetLine[], categoryId: CategoryId, percent: number) {
  return lines.map((l) =>
    l.categoryId === categoryId
      ? { ...l, planned: Math.max(0, Math.round((l.planned * (100 + percent)) / 100)) }
      : l,
  );
}
