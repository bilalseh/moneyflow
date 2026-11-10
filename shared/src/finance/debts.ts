import { addMonths } from '../dates';
import { divRound } from './convert';

export const PAYOFF_STRATEGIES = ['avalanche', 'snowball'] as const;
export type PayoffStrategy = (typeof PAYOFF_STRATEGIES)[number];

/** Simulation gives up after 50 years: the plan is treated as infeasible. */
export const MAX_PAYOFF_MONTHS = 600;

export interface DebtInput {
  id: string;
  name: string;
  balance: number;
  /** Annual interest rate in basis points: 2400 = 24.00%. */
  aprBps: number;
  minPayment: number;
}

export interface PayoffResult {
  strategy: PayoffStrategy;
  feasible: boolean;
  months: number;
  totalInterest: number;
  totalPaid: number;
  payoffMonth: string | null;
  /** Debt ids in the order the strategy targets them. */
  order: string[];
  debts: { id: string; payoffMonths: number | null; interest: number }[];
  /** Total remaining balance at the end of each month, starting with month 0. */
  series: { month: string; balance: number }[];
}

/** One month of interest: balance * apr / 12, rounded half up, in integer math. */
export function monthlyInterest(balance: number, aprBps: number): number {
  if (balance <= 0 || aprBps <= 0) return 0;
  return Number(divRound(BigInt(balance) * BigInt(aprBps), 120_000n));
}

export function orderDebts(debts: readonly DebtInput[], strategy: PayoffStrategy): DebtInput[] {
  const active = debts.filter((d) => d.balance > 0);
  return [...active].sort((a, b) =>
    strategy === 'avalanche'
      ? b.aprBps - a.aprBps || a.balance - b.balance || a.id.localeCompare(b.id)
      : a.balance - b.balance || b.aprBps - a.aprBps || a.id.localeCompare(b.id),
  );
}

/**
 * Simulate paying all debts with a fixed monthly budget equal to the sum of
 * minimums plus `extraPerMonth`. Minimums are paid first; everything left
 * goes to the target debt. Money freed by a paid-off debt rolls into the next.
 */
export function simulatePayoff(
  debts: readonly DebtInput[],
  strategy: PayoffStrategy,
  extraPerMonth: number,
  startMonth: string,
): PayoffResult {
  const order = orderDebts(debts, strategy);
  const balance = new Map(order.map((d) => [d.id, d.balance]));
  const interest = new Map(order.map((d) => [d.id, 0]));
  const paidOff = new Map<string, number>();
  const budget = order.reduce((a, d) => a + d.minPayment, 0) + Math.max(0, extraPerMonth);
  const series = [{ month: startMonth, balance: order.reduce((a, d) => a + d.balance, 0) }];
  let totalPaid = 0;
  let month = 0;

  while (paidOff.size < order.length && month < MAX_PAYOFF_MONTHS) {
    month += 1;
    for (const d of order) {
      const b = balance.get(d.id) ?? 0;
      const i = monthlyInterest(b, d.aprBps);
      balance.set(d.id, b + i);
      interest.set(d.id, (interest.get(d.id) ?? 0) + i);
    }
    let left = budget;
    for (const d of order) {
      const b = balance.get(d.id) ?? 0;
      const pay = Math.min(b, d.minPayment, left);
      balance.set(d.id, b - pay);
      left -= pay;
    }
    for (const d of order) {
      if (left <= 0) break;
      const b = balance.get(d.id) ?? 0;
      const pay = Math.min(b, left);
      balance.set(d.id, b - pay);
      left -= pay;
    }
    totalPaid += budget - left;
    for (const d of order) {
      if (!paidOff.has(d.id) && (balance.get(d.id) ?? 0) === 0) paidOff.set(d.id, month);
    }
    const remaining = [...balance.values()].reduce((a, b) => a + b, 0);
    series.push({ month: addMonths(startMonth, month), balance: remaining });
  }

  const feasible = paidOff.size === order.length;
  return {
    strategy,
    feasible,
    months: feasible ? month : MAX_PAYOFF_MONTHS,
    totalInterest: [...interest.values()].reduce((a, b) => a + b, 0),
    totalPaid,
    payoffMonth: feasible ? addMonths(startMonth, month) : null,
    order: order.map((d) => d.id),
    debts: order.map((d) => ({
      id: d.id,
      payoffMonths: paidOff.get(d.id) ?? null,
      interest: interest.get(d.id) ?? 0,
    })),
    series,
  };
}

export interface StrategyComparison {
  avalanche: PayoffResult;
  snowball: PayoffResult;
  /** Interest the avalanche order saves over snowball (>= 0 when both are feasible). */
  interestSaved: number;
  monthsSaved: number;
  /** Cheapest feasible strategy; avalanche on ties. */
  cheapest: PayoffStrategy | null;
}

export function compareStrategies(
  debts: readonly DebtInput[],
  extraPerMonth: number,
  startMonth: string,
): StrategyComparison {
  const avalanche = simulatePayoff(debts, 'avalanche', extraPerMonth, startMonth);
  const snowball = simulatePayoff(debts, 'snowball', extraPerMonth, startMonth);
  let cheapest: PayoffStrategy | null = null;
  if (avalanche.feasible && snowball.feasible) {
    cheapest = snowball.totalInterest < avalanche.totalInterest ? 'snowball' : 'avalanche';
  } else if (avalanche.feasible) cheapest = 'avalanche';
  else if (snowball.feasible) cheapest = 'snowball';
  return {
    avalanche,
    snowball,
    interestSaved: snowball.totalInterest - avalanche.totalInterest,
    monthsSaved: snowball.months - avalanche.months,
    cheapest,
  };
}
