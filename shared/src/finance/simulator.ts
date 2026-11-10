import { CATEGORY_GROUP, type CategoryId } from '../categories';
import { addMonths } from '../dates';
import { allocate } from './allocate';
import { projectGoals, type GoalInput, type GoalProjection } from './goals';
import { computeHealthScore } from './healthScore';
import { essentialTotal, spendingTotal, type CategoryAmounts } from './totals';

/**
 * The what-if model, in one paragraph (also in docs/finance-rules.md):
 * surplus = income - spending. Goals receive `goalContribution` per month,
 * never more than the surplus. Whatever surplus is left accumulates in the
 * liquid savings balance (it can go negative, which the UI flags as drawing
 * down savings). "Save X more" lowers wants spending by X (proportionally,
 * capped at total wants) and sends X to goals. Category cuts lower spending
 * and so raise the free surplus.
 */
export interface Baseline {
  month: string;
  monthlyIncome: number;
  /** Monthly spending by category, savings transfers excluded. */
  spending: CategoryAmounts;
  /** Cash and savings accounts, not counting the emergency fund. */
  liquidSavings: number;
  emergencyFund: number;
  debtMinimums: number;
  fixedCosts: number;
  goalContribution: number;
  goals: readonly GoalInput[];
}

export interface CategoryCut {
  categoryId: CategoryId;
  /** 1..100 */
  percent: number;
}

export interface Scenario {
  extraSavingsPerMonth: number;
  categoryCuts: readonly CategoryCut[];
  incomeChangePerMonth: number;
}

export const NO_CHANGE: Scenario = {
  extraSavingsPerMonth: 0,
  categoryCuts: [],
  incomeChangePerMonth: 0,
};

export interface ScenarioResult {
  monthlyIncome: number;
  monthlySpending: number;
  spending: CategoryAmounts;
  monthlySurplus: number;
  goalContribution: number;
  /** Surplus left after goal contributions; added to liquid savings each month. */
  freeCashFlow: number;
  savingsRate: number | null;
  healthScore: number;
  /** Part of "save X more" that could not be taken from wants. */
  extraSavingsShortfall: number;
  goals: GoalProjection[];
  savingsSeries: { month: string; balance: number }[];
}

function applyCuts(spending: CategoryAmounts, cuts: readonly CategoryCut[]): CategoryAmounts {
  const next: CategoryAmounts = { ...spending };
  for (const cut of cuts) {
    const current = next[cut.categoryId];
    if (current === undefined) continue;
    const pct = Math.min(100, Math.max(0, cut.percent));
    next[cut.categoryId] = current - Math.round((current * pct) / 100);
  }
  return next;
}

function takeFromWants(spending: CategoryAmounts, amount: number) {
  const ids = (Object.keys(spending) as CategoryId[]).filter(
    (id) => CATEGORY_GROUP[id] === 'wants' && (spending[id] ?? 0) > 0,
  );
  const available = ids.reduce((a, id) => a + (spending[id] ?? 0), 0);
  const take = Math.min(Math.max(0, amount), available);
  const next: CategoryAmounts = { ...spending };
  allocate(
    take,
    ids.map((id) => spending[id] ?? 0),
  ).forEach((part, i) => {
    const id = ids[i];
    if (id !== undefined) next[id] = (next[id] ?? 0) - part;
  });
  return { spending: next, taken: take, shortfall: Math.max(0, amount) - take };
}

export function runScenario(
  baseline: Baseline,
  scenario: Scenario,
  horizonMonths = 24,
): ScenarioResult {
  const income = Math.max(0, baseline.monthlyIncome + scenario.incomeChangePerMonth);
  const cut = applyCuts(baseline.spending, scenario.categoryCuts);
  const moved = takeFromWants(cut, scenario.extraSavingsPerMonth);
  const monthlySpending = spendingTotal(moved.spending);
  const surplus = income - monthlySpending;
  const goalContribution = Math.max(0, Math.min(baseline.goalContribution + moved.taken, surplus));
  const freeCashFlow = surplus - goalContribution;

  const health = computeHealthScore({
    monthlyIncome: income,
    monthlySpending,
    essentialSpending: essentialTotal(moved.spending),
    emergencyFund: baseline.emergencyFund,
    debtMinimums: baseline.debtMinimums,
    fixedCosts: baseline.fixedCosts,
  });

  const savingsSeries = Array.from({ length: horizonMonths + 1 }, (_, m) => ({
    month: addMonths(baseline.month, m),
    balance: baseline.liquidSavings + freeCashFlow * m,
  }));

  return {
    monthlyIncome: income,
    monthlySpending,
    spending: moved.spending,
    monthlySurplus: surplus,
    goalContribution,
    freeCashFlow,
    savingsRate: income > 0 ? surplus / income : null,
    healthScore: health.score,
    extraSavingsShortfall: moved.shortfall,
    goals: projectGoals(baseline.goals, goalContribution, baseline.month),
    savingsSeries,
  };
}

export interface ScenarioComparison {
  base: ScenarioResult;
  scenario: ScenarioResult;
  delta: {
    monthlySurplus: number;
    healthScore: number;
    savingsAtHorizon: number;
    /** Months each goal arrives earlier (positive) or later (negative); null if unknown. */
    goalMonths: { id: string; months: number | null }[];
  };
}

export function compareScenario(
  baseline: Baseline,
  scenario: Scenario,
  horizonMonths = 24,
): ScenarioComparison {
  const base = runScenario(baseline, NO_CHANGE, horizonMonths);
  const next = runScenario(baseline, scenario, horizonMonths);
  const lastBalance = (r: ScenarioResult) =>
    r.savingsSeries[r.savingsSeries.length - 1]?.balance ?? 0;
  return {
    base,
    scenario: next,
    delta: {
      monthlySurplus: next.monthlySurplus - base.monthlySurplus,
      healthScore: next.healthScore - base.healthScore,
      savingsAtHorizon: lastBalance(next) - lastBalance(base),
      goalMonths: base.goals.map((g, i) => {
        const after = next.goals[i]?.monthsToGoal ?? null;
        return {
          id: g.id,
          months: g.monthsToGoal !== null && after !== null ? g.monthsToGoal - after : null,
        };
      }),
    },
  };
}
