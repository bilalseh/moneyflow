import {
  addMonths,
  adjustLine,
  isSpendingCategory,
  projectGoals,
  summarizeMonth,
  type Budget,
  type CategoryId,
  type Checkin,
  type CheckinRequest,
  type Locale,
  type ScoreSnapshot,
} from '@moneyflow/shared';

import type { FinanceView } from '@/data/financeView';

const MAX_CATEGORIES = 18;

/** The numbers the AI receives for a month. Everything here is computed by code. */
export function buildCheckinRequest(
  view: FinanceView,
  month: string,
  budgets: readonly Budget[],
  scores: readonly ScoreSnapshot[],
  locale: Locale,
): CheckinRequest {
  const summary = summarizeMonth(view.ledger, month);
  const budget = budgets.find((b) => b.month === month) ?? view.budget;
  const planned = new Map((budget?.lines ?? []).map((l) => [l.categoryId, l.planned]));
  const ids = new Set<CategoryId>([
    ...planned.keys(),
    ...(Object.keys(summary.byCategory) as CategoryId[]),
  ]);
  const categories = [...ids]
    .filter((id) => isSpendingCategory(id))
    .map((id) => ({
      categoryId: id,
      planned: planned.get(id) ?? 0,
      actual: summary.byCategory[id] ?? 0,
    }))
    .filter((c) => c.planned > 0 || c.actual > 0)
    .sort((a, b) => b.actual - a.actual)
    .slice(0, MAX_CATEGORIES);

  const projections = projectGoals(view.goals, view.goalContribution, month);
  const score = scores.find((s) => s.month === month)?.score;
  const previous = scores.find((s) => s.month === addMonths(month, -1))?.score;

  return {
    locale,
    currency: view.main,
    month,
    income: summary.income,
    spending: summary.spending,
    savingsRate: summary.savingsRate ?? 0,
    categories:
      categories.length > 0 ? categories : [{ categoryId: 'other', planned: 0, actual: 0 }],
    goals: view.goals.slice(0, 10).map((g, i) => {
      const p = projections[i];
      return {
        id: g.id,
        name: g.name,
        target: g.targetAmount,
        saved: g.savedAmount,
        onTrack: p?.onTrack ?? p?.projectedMonth != null,
        projectedMonth: p?.projectedMonth ?? null,
      };
    }),
    scoreChange: score !== undefined && previous !== undefined ? score - previous : null,
  };
}

/**
 * Apply one accepted adjustment to the budget of the month after the
 * check-in. Starts from that month's budget, or a copy of the latest one.
 * A category with no planned line starts from what was actually spent.
 */
export function applyAdjustment(
  checkin: Pick<Checkin, 'month'>,
  adjustment: { categoryId: CategoryId; changePercent: number },
  budgets: readonly Budget[],
  actual: Partial<Record<CategoryId, number>>,
  now: string,
): Budget | null {
  const target = addMonths(checkin.month, 1);
  const base =
    budgets.find((b) => b.month === target) ??
    [...budgets].sort((a, b) => b.month.localeCompare(a.month))[0];
  if (!base) return null;
  const has = base.lines.some((l) => l.categoryId === adjustment.categoryId);
  const lines = has
    ? adjustLine(base.lines, adjustment.categoryId, adjustment.changePercent)
    : [
        ...base.lines,
        {
          categoryId: adjustment.categoryId,
          planned: Math.max(
            0,
            Math.round(
              ((actual[adjustment.categoryId] ?? 0) * (100 + adjustment.changePercent)) / 100,
            ),
          ),
        },
      ];
  return { ...base, month: target, lines, updatedAt: now };
}
