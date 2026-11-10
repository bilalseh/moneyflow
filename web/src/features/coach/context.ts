import {
  isSpendingCategory,
  projectGoals,
  type CategoryId,
  type CoachContext,
} from '@moneyflow/shared';

import type { FinanceView } from '@/data/financeView';

/**
 * Structured context the coach receives: only numbers computed here, in
 * minor units of the main currency, trimmed to the API's limits.
 */
export function buildCoachContext(view: FinanceView): CoachContext {
  const planned = new Map((view.budget?.lines ?? []).map((l) => [l.categoryId, l.planned]));
  const ids = new Set<CategoryId>([
    ...planned.keys(),
    ...(Object.keys(view.current.byCategory) as CategoryId[]),
  ]);
  const categories = [...ids]
    .filter(isSpendingCategory)
    .map((id) => ({
      categoryId: id,
      planned: planned.get(id) ?? 0,
      actual: view.current.byCategory[id] ?? 0,
    }))
    .filter((c) => c.planned > 0 || c.actual > 0)
    .sort((a, b) => b.planned + b.actual - (a.planned + a.actual))
    .slice(0, 18);
  const projections = projectGoals(view.goals, view.goalContribution, view.month);
  const emergency = view.health.factors.find((f) => f.id === 'emergencyFund')?.value ?? 0;
  const savingsRate = view.health.factors.find((f) => f.id === 'savingsRate')?.value ?? 0;

  return {
    month: view.month,
    monthlyIncome: Math.max(0, view.incomeBasis),
    monthlySpending: Math.max(
      0,
      Object.values(view.spendingBasis).reduce((a, b) => a + b, 0),
    ),
    savingsRate: Math.max(-1000, Math.min(1000, savingsRate)),
    savingsBalance: Math.max(0, view.liquidSavings),
    emergencyFund: Math.max(0, view.emergencyFund),
    emergencyMonths: Math.min(1000, Math.max(0, emergency)),
    healthScore: view.health.score,
    categories,
    goals: view.goals.slice(0, 10).map((g, i) => ({
      id: g.id,
      name: g.name.slice(0, 100),
      target: g.targetAmount,
      saved: g.savedAmount,
      targetDate: g.targetDate,
      projectedMonth: projections[i]?.projectedMonth ?? null,
    })),
    debts: view.debts.slice(0, 20).map((d) => ({
      id: d.id,
      name: d.name.slice(0, 100),
      balance: d.balance,
      aprBps: d.aprBps,
      minPayment: d.minPayment,
    })),
  };
}
