import {
  checkAffordability,
  compareScenario,
  compareStrategies,
  formatMoney,
  projectGoals,
  toMinorUnits,
  toolArgsSchemas,
  type ToolCall,
} from '@moneyflow/shared';

import type { FinanceView } from '@/data/financeView';

/** What the chat shows as a card under a tool call. Amounts are minor units of the main currency. */
export type ToolDisplay =
  | {
      kind: 'affordability';
      label: string | null;
      amount: number;
      month: string;
      affordable: boolean;
      projectedBalance: number;
      balanceAfter: number;
      safetyBuffer: number;
      earliestMonth: string | null;
    }
  | {
      kind: 'scenario';
      before: { surplus: number; score: number; savings: number };
      after: { surplus: number; score: number; savings: number };
    }
  | {
      kind: 'goal';
      name: string;
      saved: number;
      target: number;
      projectedMonth: string | null;
      requiredMonthly: number | null;
      onTrack: boolean | null;
    }
  | {
      kind: 'debts';
      avalanche: { interest: number; payoffMonth: string | null };
      snowball: { interest: number; payoffMonth: string | null };
      interestSaved: number;
    };

export type ToolOutcome =
  | { ok: true; result: Record<string, unknown>; display: ToolDisplay }
  | { ok: false; result: { error: string } };

const HORIZON = 24;

/**
 * Run a coach tool call with the tested finance module. The returned
 * `result` goes back to the model with amounts already formatted, so the
 * model only has to restate them, never compute them.
 */
export function runTool(call: ToolCall, view: FinanceView): ToolOutcome {
  const money = (amount: number) => formatMoney({ amount, currency: view.main }, 'en-US');
  const minor = (major: number) => toMinorUnits(major, view.main);

  if (call.name === 'check_affordability') {
    const args = toolArgsSchemas.check_affordability.safeParse(call.args);
    if (!args.success) return { ok: false, result: { error: 'invalid arguments' } };
    const r = checkAffordability(view.baseline, {
      amount: minor(args.data.amountMajor),
      month: args.data.month < view.month ? view.month : args.data.month,
    });
    return {
      ok: true,
      result: {
        affordable: r.affordable,
        month: r.month,
        monthsUntil: r.monthsUntil,
        amount: money(r.amount),
        projectedSavingsBeforePurchase: money(r.projectedBalance),
        savingsAfterPurchase: money(r.balanceAfter),
        safetyBufferKept: money(r.safetyBuffer),
        shortfall: money(r.shortfall),
        monthlyFreeCashFlow: money(r.freeCashFlow),
        earliestAffordableMonth: r.earliestMonth,
        monthsTopGoalWouldSlipIfPaidFromGoals: r.goalDelayMonths,
        rule: 'Affordable when savings after the purchase still cover one month of essential spending. The emergency fund is never used.',
      },
      display: {
        kind: 'affordability',
        label: args.data.label ?? null,
        amount: r.amount,
        month: r.month,
        affordable: r.affordable,
        projectedBalance: r.projectedBalance,
        balanceAfter: r.balanceAfter,
        safetyBuffer: r.safetyBuffer,
        earliestMonth: r.earliestMonth,
      },
    };
  }

  if (call.name === 'simulate_scenario') {
    const args = toolArgsSchemas.simulate_scenario.safeParse(call.args);
    if (!args.success) return { ok: false, result: { error: 'invalid arguments' } };
    const c = compareScenario(
      view.baseline,
      {
        extraSavingsPerMonth: minor(args.data.extraSavingsMajor),
        categoryCuts: args.data.categoryCuts,
        incomeChangePerMonth: minor(args.data.incomeChangeMajor),
      },
      HORIZON,
    );
    const last = (s: typeof c.base) => s.savingsSeries[s.savingsSeries.length - 1]?.balance ?? 0;
    const goals = c.base.goals.map((g, i) => ({
      goal: view.goals.find((x) => x.id === g.id)?.name,
      before: g.projectedMonth,
      after: c.scenario.goals[i]?.projectedMonth ?? null,
      monthsEarlier: c.delta.goalMonths[i]?.months ?? null,
    }));
    return {
      ok: true,
      result: {
        monthlySurplusBefore: money(c.base.monthlySurplus),
        monthlySurplusAfter: money(c.scenario.monthlySurplus),
        healthScoreBefore: c.base.healthScore,
        healthScoreAfter: c.scenario.healthScore,
        savingsIn24MonthsBefore: money(last(c.base)),
        savingsIn24MonthsAfter: money(last(c.scenario)),
        partOfExtraSavingsNotCoveredByWants: money(c.scenario.extraSavingsShortfall),
        goals,
      },
      display: {
        kind: 'scenario',
        before: {
          surplus: c.base.monthlySurplus,
          score: c.base.healthScore,
          savings: last(c.base),
        },
        after: {
          surplus: c.scenario.monthlySurplus,
          score: c.scenario.healthScore,
          savings: last(c.scenario),
        },
      },
    };
  }

  if (call.name === 'project_goal') {
    const args = toolArgsSchemas.project_goal.safeParse(call.args);
    const index = args.success ? view.goals.findIndex((g) => g.id === args.data.goalId) : -1;
    const goal = view.goals[index];
    if (!goal) return { ok: false, result: { error: 'unknown goal' } };
    const p = projectGoals(view.goals, view.goalContribution, view.month)[index];
    if (!p) return { ok: false, result: { error: 'unknown goal' } };
    return {
      ok: true,
      result: {
        name: goal.name,
        saved: money(goal.savedAmount),
        target: money(goal.targetAmount),
        remaining: money(p.remaining),
        monthlyContribution: money(p.firstMonthContribution),
        projectedMonth: p.projectedMonth,
        monthsToGoal: p.monthsToGoal,
        targetDate: goal.targetDate,
        requiredMonthlyForTargetDate: p.requiredMonthly === null ? null : money(p.requiredMonthly),
        onTrack: p.onTrack,
      },
      display: {
        kind: 'goal',
        name: goal.name,
        saved: goal.savedAmount,
        target: goal.targetAmount,
        projectedMonth: p.projectedMonth,
        requiredMonthly: p.requiredMonthly,
        onTrack: p.onTrack,
      },
    };
  }

  const args = toolArgsSchemas.compare_debt_strategies.safeParse(call.args);
  if (!args.success) return { ok: false, result: { error: 'invalid arguments' } };
  if (view.debts.length === 0) return { ok: false, result: { error: 'no debts recorded' } };
  const c = compareStrategies(view.debts, minor(args.data.extraPerMonthMajor), view.month);
  const names = new Map(view.debts.map((d) => [d.id, d.name]));
  const describe = (r: typeof c.avalanche) => ({
    feasible: r.feasible,
    totalInterest: money(r.totalInterest),
    debtFreeMonth: r.payoffMonth,
    months: r.months,
    order: r.order.map((id) => names.get(id)),
  });
  return {
    ok: true,
    result: {
      avalanche: describe(c.avalanche),
      snowball: describe(c.snowball),
      interestSavedByAvalanche: money(c.interestSaved),
      cheapest: c.cheapest,
    },
    display: {
      kind: 'debts',
      avalanche: { interest: c.avalanche.totalInterest, payoffMonth: c.avalanche.payoffMonth },
      snowball: { interest: c.snowball.totalInterest, payoffMonth: c.snowball.payoffMonth },
      interestSaved: c.interestSaved,
    },
  };
}
