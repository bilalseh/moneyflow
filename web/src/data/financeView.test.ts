import { buildDemoData } from '@moneyflow/shared';

import { buildFinanceView } from '@/data/financeView';

const demo = buildDemoData('2026-11-09', '2026-11-09T00:00:00.000Z', 'en');
const raw = {
  profile: demo.profile,
  incomes: demo.incomes,
  fixedCosts: demo.fixedCosts,
  debts: demo.debts,
  accounts: demo.accounts,
  goals: demo.goals,
  transactions: demo.transactions,
  budgets: demo.budgets,
};

describe('buildFinanceView', () => {
  const view = buildFinanceView(raw, '2026-11-09');

  it('converts foreign-currency items with the manual rate', () => {
    expect(view.missingRates).toEqual([]);
    expect(view.plannedIncome).toBe(420000 + 64800);
  });

  it('averages the last three complete months as the spending basis', () => {
    expect(view.basisMonths).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(view.spendingBasis.housing).toBe(145000);
    expect(view.spendingBasis.savings).toBeUndefined();
  });

  it('splits accounts into liquid savings and the emergency fund', () => {
    expect(view.emergencyFund).toBe(650000);
    expect(view.liquidSavings).toBe(715000);
    expect(view.netWorth).toBe(650000 + 715000 - 1170000);
  });

  it('builds a six-month trend ending this month', () => {
    expect(view.trend.map((t) => t.month)).toEqual([
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
    ]);
    expect(view.current.month).toBe('2026-11');
  });

  it('computes a health score and a simulator baseline from the same numbers', () => {
    expect(view.health.score).toBeGreaterThan(0);
    expect(view.health.score).toBeLessThanOrEqual(100);
    expect(view.baseline.monthlyIncome).toBe(view.incomeBasis);
    expect(view.baseline.goals).toHaveLength(3);
  });

  it('reports currencies without a rate instead of failing', () => {
    const noRate = buildFinanceView(
      { ...raw, profile: { ...raw.profile, rates: {} } },
      '2026-11-09',
    );
    expect(noRate.missingRates).toEqual(['EUR']);
  });

  it('falls back to the plan when there is no history', () => {
    const fresh = buildFinanceView({ ...raw, transactions: [] }, '2026-11-09');
    expect(fresh.basisMonths).toEqual([]);
    expect(fresh.spendingBasis.housing).toBeGreaterThan(0);
  });
});
