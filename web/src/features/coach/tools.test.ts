import { buildDemoData } from '@moneyflow/shared';

import { buildFinanceView } from '@/data/financeView';
import { buildCoachContext } from '@/features/coach/context';
import { runTool } from '@/features/coach/tools';

const demo = buildDemoData('2026-11-09', '2026-11-09T00:00:00Z', 'en');
const view = buildFinanceView(
  {
    profile: demo.profile,
    incomes: demo.incomes,
    fixedCosts: demo.fixedCosts,
    debts: demo.debts,
    accounts: demo.accounts,
    goals: demo.goals,
    transactions: demo.transactions,
    budgets: demo.budgets,
  },
  '2026-11-09',
);

describe('runTool', () => {
  it('checks affordability with the finance module and returns formatted amounts', () => {
    const outcome = runTool(
      { id: 'c1', name: 'check_affordability', args: { amountMajor: 900, month: '2027-03' } },
      view,
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.amount).toBe('$900.00');
    expect(typeof outcome.result.affordable).toBe('boolean');
    expect(outcome.display).toMatchObject({
      kind: 'affordability',
      amount: 90000,
      month: '2027-03',
    });
  });

  it('treats a past month as this month', () => {
    const outcome = runTool(
      { id: 'c1', name: 'check_affordability', args: { amountMajor: 10, month: '2020-01' } },
      view,
    );
    expect(outcome.ok && outcome.display.kind === 'affordability' && outcome.display.month).toBe(
      '2026-11',
    );
  });

  it('simulates a scenario', () => {
    const outcome = runTool(
      {
        id: 'c2',
        name: 'simulate_scenario',
        args: {
          extraSavingsMajor: 100,
          categoryCuts: [{ categoryId: 'dining', percent: 20 }],
          incomeChangeMajor: 0,
        },
      },
      view,
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok || outcome.display.kind !== 'scenario') return;
    expect(outcome.display.after.surplus).toBeGreaterThan(outcome.display.before.surplus);
  });

  it('projects a known goal and rejects an unknown one', () => {
    expect(
      runTool({ id: 'c3', name: 'project_goal', args: { goalId: 'goal-japan' } }, view).ok,
    ).toBe(true);
    expect(runTool({ id: 'c3', name: 'project_goal', args: { goalId: 'nope' } }, view)).toEqual({
      ok: false,
      result: { error: 'unknown goal' },
    });
  });

  it('compares debt strategies', () => {
    const outcome = runTool(
      { id: 'c4', name: 'compare_debt_strategies', args: { extraPerMonthMajor: 50 } },
      view,
    );
    expect(outcome.ok && outcome.result.cheapest).toBe('avalanche');
  });

  it('rejects malformed arguments instead of guessing', () => {
    expect(
      runTool(
        { id: 'c5', name: 'check_affordability', args: { amountMajor: -5, month: 'March' } },
        view,
      ).ok,
    ).toBe(false);
  });
});

describe('buildCoachContext', () => {
  it('stays within the API limits and uses non-negative minor units', () => {
    const context = buildCoachContext(view);
    expect(context.categories.length).toBeLessThanOrEqual(18);
    expect(context.goals).toHaveLength(3);
    expect(context.debts).toHaveLength(2);
    expect(context.monthlyIncome).toBeGreaterThan(0);
    expect(context.categories.every((c) => c.planned >= 0 && c.actual >= 0)).toBe(true);
  });
});
