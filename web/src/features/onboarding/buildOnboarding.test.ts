import type { WriteOp } from '@/data/firestore';
import { buildOnboardingWrites } from '@/features/onboarding/buildOnboarding';
import { EMPTY_WIZARD, type WizardData } from '@/features/onboarding/wizardStore';

const options = {
  locale: 'en' as const,
  displayName: 'Sam',
  today: '2026-11-09',
  now: '2026-11-09T10:00:00.000Z',
  labelFor: (id: string) => `Label ${id}`,
  defaultIncomeName: 'Income',
};

const of = (ops: WriteOp[], name: string) =>
  ops
    .filter((o) => o.kind === 'set' && o.name === name)
    .map((o) => (o as { value: Record<string, unknown> }).value);

describe('buildOnboardingWrites', () => {
  const data: WizardData = {
    ...EMPTY_WIZARD,
    currency: 'EUR',
    incomes: [
      { name: 'Salary', amount: 300000, kind: 'fixed' },
      { name: '', amount: 50000, kind: 'variable' },
      { name: 'Empty', amount: null, kind: 'fixed' },
    ],
    fixedCosts: [
      { name: '', categoryId: 'housing', amount: 100000 },
      { name: 'Power', categoryId: 'utilities', amount: 8000 },
      { name: '', categoryId: 'transport', amount: null },
    ],
    debts: [{ name: 'Card', balance: 200000, aprBps: 1999, minPayment: 6000 }],
    savings: { savingsBalance: 150000, emergencyFund: 0 },
    goals: [
      {
        name: 'Trip',
        targetAmount: 200000,
        savedAmount: 20000,
        targetDate: '2027-06-01',
        priority: 'high',
      },
    ],
  };
  const ops = buildOnboardingWrites(data, options);

  it('writes a completed profile in the chosen currency', () => {
    const profile = ops.find((o) => o.kind === 'profile');
    expect(profile?.kind === 'profile' && profile.value).toMatchObject({
      mainCurrency: 'EUR',
      onboardingCompleted: true,
      isDemo: false,
      displayName: 'Sam',
    });
  });

  it('keeps only rows with an amount and names unnamed ones', () => {
    expect(of(ops, 'incomes').map((i) => i.name)).toEqual(['Salary', 'Income 2']);
    expect(of(ops, 'fixedCosts').map((f) => f.name)).toEqual(['Label housing', 'Power']);
    expect(of(ops, 'accounts')).toHaveLength(1);
  });

  it('turns fixed incomes and costs into monthly recurring entries starting next month', () => {
    const rules = of(ops, 'recurring');
    expect(rules).toHaveLength(3);
    expect(rules.every((r) => r.nextDate === '2026-12-01' && r.cadence === 'monthly')).toBe(true);
  });

  it('creates a balanced first budget and a first score', () => {
    const [budget] = of(ops, 'budgets');
    const lines = budget?.lines as { planned: number }[];
    expect(budget?.month).toBe('2026-11');
    expect(lines.reduce((a, l) => a + l.planned, 0)).toBe(350000);
    const [score] = of(ops, 'scores');
    expect(score?.score).toEqual(expect.any(Number));
  });

  it('works when every optional step was skipped', () => {
    const minimal = buildOnboardingWrites(
      {
        ...EMPTY_WIZARD,
        currency: 'USD',
        incomes: [{ name: 'Pay', amount: 100000, kind: 'fixed' }],
      },
      options,
    );
    expect(of(minimal, 'debts')).toEqual([]);
    expect(of(minimal, 'goals')).toEqual([]);
    expect(of(minimal, 'budgets')).toHaveLength(1);
  });
});
