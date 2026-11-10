import {
  adjustLine,
  buildBudget,
  summarizeLines,
  type BudgetInput,
  type BudgetPlan,
} from './budget';

const base: BudgetInput = {
  income: 500000,
  fixedCosts: { housing: 150000, utilities: 20000 },
  debtMinimums: 15000,
  goalContributions: 40000,
  history: {
    groceries: 60000,
    transport: 25000,
    dining: 30000,
    shopping: 20000,
    subscriptions: 5000,
  },
};

const total = (plan: BudgetPlan) => plan.lines.reduce((a, l) => a + l.planned, 0);
const line = (plan: BudgetPlan, id: string) => plan.lines.find((l) => l.categoryId === id)?.planned;

describe('50/30/20', () => {
  it('splits income 50/30/20 and keeps fixed costs and debt minimums', () => {
    const plan = buildBudget('fiftyThirtyTwenty', base);
    expect(plan.totals).toEqual({ needs: 250000, wants: 150000, savings: 100000 });
    expect(total(plan)).toBe(500000);
    expect(plan.unassigned).toBe(0);
    expect(line(plan, 'housing')).toBe(150000);
    expect(line(plan, 'debt')).toBe(15000);
    expect(plan.overCommitted).toBe(false);
  });

  it('takes overflow from wants, then savings, when commitments exceed half the income', () => {
    const plan = buildBudget('fiftyThirtyTwenty', {
      ...base,
      fixedCosts: { housing: 300000 },
      debtMinimums: 0,
    });
    expect(plan.overCommitted).toBe(true);
    expect(plan.totals.needs).toBe(300000);
    expect(plan.totals.wants).toBe(100000);
    expect(plan.totals.savings).toBe(100000);
    expect(total(plan)).toBe(500000);
  });

  it('uses default weights when there is no history', () => {
    const plan = buildBudget('fiftyThirtyTwenty', { ...base, history: {} });
    expect(line(plan, 'groceries')).toBeGreaterThan(0);
    expect(total(plan)).toBe(500000);
  });
});

describe('zero-based', () => {
  it('assigns every unit of income', () => {
    const plan = buildBudget('zeroBased', base);
    expect(total(plan)).toBe(500000);
    expect(plan.unassigned).toBe(0);
    expect(line(plan, 'groceries')).toBe(60000);
    expect(line(plan, 'savings')).toBe(500000 - 185000 - 140000);
  });

  it('scales history down when income is short', () => {
    const plan = buildBudget('zeroBased', { ...base, income: 250000 });
    expect(total(plan)).toBe(250000);
    expect(line(plan, 'savings')).toBe(40000);
  });

  it('flags over-commitment and never invents money', () => {
    const plan = buildBudget('zeroBased', { ...base, income: 100000 });
    expect(plan.overCommitted).toBe(true);
    expect(plan.unassigned).toBeLessThan(0);
  });

  it('gives 80% to everyday categories without history', () => {
    const plan = buildBudget('zeroBased', { ...base, history: {}, goalContributions: 0 });
    const free = 500000 - 185000;
    expect(line(plan, 'savings')).toBe(free - Math.floor((free * 4) / 5));
    expect(total(plan)).toBe(500000);
  });
});

describe('custom', () => {
  it('starts from history plus commitments and reports what is unassigned', () => {
    const plan = buildBudget('custom', base);
    expect(line(plan, 'dining')).toBe(30000);
    expect(plan.unassigned).toBe(500000 - total(plan));
  });

  it('recomputes totals after manual edits', () => {
    const edited = summarizeLines('custom', 500000, [
      { categoryId: 'housing', planned: 200000 },
      { categoryId: 'dining', planned: 50000 },
      { categoryId: 'savings', planned: 100000 },
    ]);
    expect(edited.totals).toEqual({ needs: 200000, wants: 50000, savings: 100000 });
    expect(edited.unassigned).toBe(150000);
  });
});

describe('adjustLine', () => {
  it('applies a percentage change to one category only', () => {
    const lines = [
      { categoryId: 'dining' as const, planned: 30000 },
      { categoryId: 'housing' as const, planned: 150000 },
    ];
    expect(adjustLine(lines, 'dining', -10)).toEqual([
      { categoryId: 'dining', planned: 27000 },
      { categoryId: 'housing', planned: 150000 },
    ]);
    expect(adjustLine(lines, 'dining', -200)[0]?.planned).toBe(0);
  });
});
