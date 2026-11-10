import { addMonths, monthsBetween } from '../dates';
import { runScenario, NO_CHANGE, type Baseline } from './simulator';
import { essentialTotal } from './totals';

/** How far ahead "earliest month you could afford it" looks. */
export const AFFORDABILITY_SEARCH_MONTHS = 60;

export interface AffordabilityInput {
  amount: number;
  /** YYYY-MM of the planned purchase. */
  month: string;
}

export interface AffordabilityResult {
  affordable: boolean;
  amount: number;
  month: string;
  monthsUntil: number;
  /** Liquid savings projected at the start of `month`, before the purchase. */
  projectedBalance: number;
  balanceAfter: number;
  /** Cushion kept untouched: one month of essential spending. */
  safetyBuffer: number;
  shortfall: number;
  freeCashFlow: number;
  /** First month the purchase fits with the buffer kept; null if the balance never grows enough. */
  earliestMonth: string | null;
  /** If paid from goal savings instead, months the top-priority goal would slip. */
  goalDelayMonths: number | null;
}

/**
 * Can the user buy something of `amount` in `month` from liquid savings,
 * keeping one month of essential spending as a buffer and leaving the
 * emergency fund untouched? Pure projection with the current plan.
 */
export function checkAffordability(
  baseline: Baseline,
  input: AffordabilityInput,
): AffordabilityResult {
  const plan = runScenario(baseline, NO_CHANGE, 0);
  const monthsUntil = Math.max(0, monthsBetween(baseline.month, input.month));
  const flow = plan.freeCashFlow;
  const projectedBalance = baseline.liquidSavings + flow * monthsUntil;
  const safetyBuffer = essentialTotal(baseline.spending);
  const balanceAfter = projectedBalance - input.amount;
  const shortfall = Math.max(0, safetyBuffer - balanceAfter);

  let earliestMonth: string | null = null;
  for (let m = 0; m <= AFFORDABILITY_SEARCH_MONTHS; m++) {
    if (baseline.liquidSavings + flow * m - input.amount >= safetyBuffer) {
      earliestMonth = addMonths(baseline.month, m);
      break;
    }
  }

  const contribution = plan.goalContribution;
  const goalDelayMonths =
    baseline.goals.length > 0 && contribution > 0 ? Math.ceil(input.amount / contribution) : null;

  return {
    affordable: shortfall === 0,
    amount: input.amount,
    month: input.month,
    monthsUntil,
    projectedBalance,
    balanceAfter,
    safetyBuffer,
    shortfall,
    freeCashFlow: flow,
    earliestMonth,
    goalDelayMonths,
  };
}
