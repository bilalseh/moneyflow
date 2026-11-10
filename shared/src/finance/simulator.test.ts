import { checkAffordability } from './affordability';
import { compareScenario, NO_CHANGE, runScenario, type Baseline } from './simulator';

const baseline: Baseline = {
  month: '2026-11',
  monthlyIncome: 500000,
  spending: { housing: 150000, groceries: 60000, dining: 40000, shopping: 30000 },
  liquidSavings: 100000,
  emergencyFund: 600000,
  debtMinimums: 0,
  fixedCosts: 150000,
  goalContribution: 50000,
  goals: [
    {
      id: 'car',
      name: 'Car',
      targetAmount: 1000000,
      savedAmount: 0,
      targetDate: null,
      priority: 'high',
    },
  ],
};

describe('runScenario', () => {
  it('reproduces the baseline with no changes', () => {
    const r = runScenario(baseline, NO_CHANGE, 12);
    expect(r.monthlySpending).toBe(280000);
    expect(r.monthlySurplus).toBe(220000);
    expect(r.goalContribution).toBe(50000);
    expect(r.freeCashFlow).toBe(170000);
    expect(r.savingsSeries).toHaveLength(13);
    expect(r.savingsSeries[12]?.balance).toBe(100000 + 170000 * 12);
    expect(r.goals[0]?.monthsToGoal).toBe(20);
  });

  it('"save X more" comes out of wants and goes to goals', () => {
    const r = runScenario(baseline, { ...NO_CHANGE, extraSavingsPerMonth: 20000 }, 12);
    expect(r.monthlySpending).toBe(260000);
    expect(r.goalContribution).toBe(70000);
    expect((r.spending.dining ?? 0) + (r.spending.shopping ?? 0)).toBe(50000);
    expect(r.spending.housing).toBe(150000);
    expect(r.extraSavingsShortfall).toBe(0);
  });

  it('reports the part of "save X more" that wants cannot cover', () => {
    const r = runScenario(baseline, { ...NO_CHANGE, extraSavingsPerMonth: 100000 }, 12);
    expect(r.extraSavingsShortfall).toBe(30000);
  });

  it('applies category cuts and income changes', () => {
    const r = runScenario(
      baseline,
      {
        extraSavingsPerMonth: 0,
        categoryCuts: [{ categoryId: 'dining', percent: 50 }],
        incomeChangePerMonth: -100000,
      },
      12,
    );
    expect(r.spending.dining).toBe(20000);
    expect(r.monthlyIncome).toBe(400000);
    expect(r.monthlySurplus).toBe(140000);
  });

  it('never gives goals more than the surplus', () => {
    const r = runScenario(baseline, { ...NO_CHANGE, incomeChangePerMonth: -480000 }, 6);
    expect(r.goalContribution).toBe(0);
    expect(r.freeCashFlow).toBeLessThan(0);
  });
});

describe('compareScenario', () => {
  it('reports deltas against the baseline', () => {
    const c = compareScenario(baseline, { ...NO_CHANGE, extraSavingsPerMonth: 50000 }, 12);
    expect(c.delta.monthlySurplus).toBe(50000);
    expect(c.delta.healthScore).toBeGreaterThanOrEqual(0);
    expect(c.delta.goalMonths[0]?.months).toBeGreaterThan(0);
    expect(c.delta.savingsAtHorizon).toBe(0);
  });
});

describe('checkAffordability', () => {
  it('approves a purchase that leaves the safety buffer intact', () => {
    const r = checkAffordability(baseline, { amount: 90000, month: '2027-03' });
    expect(r.monthsUntil).toBe(4);
    expect(r.projectedBalance).toBe(100000 + 170000 * 4);
    expect(r.safetyBuffer).toBe(210000);
    expect(r.affordable).toBe(true);
  });

  it('declines and suggests the earliest month when the buffer would break', () => {
    const r = checkAffordability(baseline, { amount: 600000, month: '2026-12' });
    expect(r.affordable).toBe(false);
    expect(r.shortfall).toBe(210000 - (270000 - 600000));
    expect(r.earliestMonth).toBe('2027-04');
    expect(r.goalDelayMonths).toBe(12);
  });

  it('returns no earliest month when savings never grow', () => {
    const r = checkAffordability(
      { ...baseline, monthlyIncome: 200000 },
      { amount: 900000, month: '2027-01' },
    );
    expect(r.earliestMonth).toBeNull();
  });
});
