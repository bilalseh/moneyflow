import { addMonths, monthOf, monthsBetween } from '../dates';
import { allocate } from './allocate';

export const GOAL_PRIORITIES = ['high', 'medium', 'low'] as const;
export type GoalPriority = (typeof GOAL_PRIORITIES)[number];

const PRIORITY_WEIGHT: Readonly<Record<GoalPriority, number>> = { high: 3, medium: 2, low: 1 };

/** Projections stop after this many months; anything longer is "not at this pace". */
export const GOAL_HORIZON_MONTHS = 240;

export interface GoalInput {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  /** YYYY-MM-DD or null when the goal has no deadline. */
  targetDate: string | null;
  priority: GoalPriority;
}

export interface GoalProjection {
  id: string;
  remaining: number;
  /** Months from the start month until the goal is reached; null if never at this pace. */
  monthsToGoal: number | null;
  projectedMonth: string | null;
  /** Monthly amount needed to hit the target date; null without a date. */
  requiredMonthly: number | null;
  onTrack: boolean | null;
  /** Contribution in the first month of the projection. */
  firstMonthContribution: number;
  series: { month: string; saved: number }[];
}

/** Split one month's contribution by priority across unfinished goals, capped at what each needs. */
export function splitContributions(
  total: number,
  goals: readonly { id: string; remaining: number; priority: GoalPriority }[],
): Map<string, number> {
  const result = new Map<string, number>(goals.map((g) => [g.id, 0]));
  let pool = Math.max(0, total);
  let open = goals.filter((g) => g.remaining > 0);
  while (pool > 0 && open.length > 0) {
    const parts = allocate(
      pool,
      open.map((g) => PRIORITY_WEIGHT[g.priority]),
    );
    pool = 0;
    const stillOpen: typeof open = [];
    open.forEach((g, i) => {
      const already = result.get(g.id) ?? 0;
      const need = g.remaining - already;
      const give = Math.min(parts[i] ?? 0, need);
      result.set(g.id, already + give);
      pool += (parts[i] ?? 0) - give;
      if (already + give < g.remaining) stillOpen.push(g);
    });
    if (stillOpen.length === open.length && pool > 0) break;
    open = stillOpen;
  }
  return result;
}

function requiredMonthly(goal: GoalInput, startMonth: string): number | null {
  if (goal.targetDate === null) return null;
  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
  if (remaining === 0) return 0;
  const months = Math.max(1, monthsBetween(startMonth, monthOf(goal.targetDate)));
  return Math.ceil(remaining / months);
}

/**
 * Month-by-month projection of all goals sharing one monthly contribution.
 * When a goal completes, its share flows to the remaining goals.
 */
export function projectGoals(
  goals: readonly GoalInput[],
  monthlyContribution: number,
  startMonth: string,
): GoalProjection[] {
  const saved = new Map(goals.map((g) => [g.id, g.savedAmount]));
  const doneAt = new Map<string, number>();
  const series = new Map(goals.map((g) => [g.id, [{ month: startMonth, saved: g.savedAmount }]]));
  const firstMonth = new Map<string, number>();

  for (const g of goals) if (g.savedAmount >= g.targetAmount) doneAt.set(g.id, 0);

  for (let m = 1; m <= GOAL_HORIZON_MONTHS && doneAt.size < goals.length; m++) {
    if (monthlyContribution <= 0) break;
    const open = goals
      .filter((g) => !doneAt.has(g.id))
      .map((g) => ({
        id: g.id,
        priority: g.priority,
        remaining: g.targetAmount - (saved.get(g.id) ?? 0),
      }));
    const split = splitContributions(monthlyContribution, open);
    const month = addMonths(startMonth, m);
    for (const g of goals) {
      if (doneAt.has(g.id)) continue;
      const give = split.get(g.id) ?? 0;
      if (m === 1) firstMonth.set(g.id, give);
      const next = (saved.get(g.id) ?? 0) + give;
      saved.set(g.id, next);
      series.get(g.id)?.push({ month, saved: next });
      if (next >= g.targetAmount) doneAt.set(g.id, m);
    }
  }

  return goals.map((g) => {
    const months = doneAt.get(g.id) ?? null;
    const required = requiredMonthly(g, startMonth);
    const projectedMonth = months === null ? null : addMonths(startMonth, months);
    let onTrack: boolean | null = null;
    if (g.targetDate !== null) {
      onTrack = projectedMonth !== null && projectedMonth <= monthOf(g.targetDate);
    }
    return {
      id: g.id,
      remaining: Math.max(0, g.targetAmount - g.savedAmount),
      monthsToGoal: months,
      projectedMonth,
      requiredMonthly: required,
      onTrack,
      firstMonthContribution: firstMonth.get(g.id) ?? 0,
      series: series.get(g.id) ?? [],
    };
  });
}

export function progressRatio(goal: Pick<GoalInput, 'targetAmount' | 'savedAmount'>): number {
  if (goal.targetAmount <= 0) return 1;
  return Math.min(1, goal.savedAmount / goal.targetAmount);
}
