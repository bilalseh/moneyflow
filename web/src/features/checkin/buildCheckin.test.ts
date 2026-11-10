import { buildDemoData } from '@moneyflow/shared';

import { buildFinanceView } from '@/data/financeView';
import { applyAdjustment, buildCheckinRequest } from '@/features/checkin/buildCheckin';

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

describe('buildCheckinRequest', () => {
  const request = buildCheckinRequest(view, '2026-10', demo.budgets, demo.scores, 'en');

  it('summarizes the month from the ledger', () => {
    expect(request.month).toBe('2026-10');
    expect(request.income).toBeGreaterThan(0);
    expect(request.spending).toBeGreaterThan(0);
    expect(request.categories.length).toBeGreaterThan(3);
    expect(request.categories.length).toBeLessThanOrEqual(18);
    expect(request.categories.some((c) => c.categoryId === 'savings')).toBe(false);
  });

  it('includes every goal with a definite on-track flag and the score change', () => {
    expect(request.goals).toHaveLength(3);
    expect(request.goals.every((g) => typeof g.onTrack === 'boolean')).toBe(true);
    expect(request.scoreChange).toEqual(expect.any(Number));
  });

  it('always sends at least one category', () => {
    const empty = buildCheckinRequest({ ...view, ledger: [] }, '2020-01', [], [], 'en');
    expect(empty.categories.length).toBeGreaterThan(0);
  });
});

describe('applyAdjustment', () => {
  it('changes the next month budget line by the percentage', () => {
    const october = demo.budgets.find((b) => b.month === '2026-10');
    const dining = october?.lines.find((l) => l.categoryId === 'dining')?.planned ?? 0;
    const next = applyAdjustment(
      { month: '2026-10' },
      { categoryId: 'dining', changePercent: -10 },
      demo.budgets,
      {},
      'now',
    );
    expect(next?.month).toBe('2026-11');
    expect(next?.lines.find((l) => l.categoryId === 'dining')?.planned).toBe(
      Math.round(dining * 0.9),
    );
  });

  it('creates a missing line from actual spending', () => {
    const next = applyAdjustment(
      { month: '2026-10' },
      { categoryId: 'travel', changePercent: -20 },
      demo.budgets,
      { travel: 50000 },
      'now',
    );
    expect(next?.lines.find((l) => l.categoryId === 'travel')?.planned).toBe(40000);
  });

  it('returns null without any budget to start from', () => {
    expect(
      applyAdjustment(
        { month: '2026-10' },
        { categoryId: 'dining', changePercent: -10 },
        [],
        {},
        'now',
      ),
    ).toBeNull();
  });
});
