import {
  addMonths,
  buildBudget,
  computeHealthScore,
  essentialTotal,
  monthOf,
  spendingTotal,
  type CategoryAmounts,
  type CategoryId,
  type Locale,
  type Profile,
} from '@moneyflow/shared';

import type { WriteOp } from '@/data/firestore';
import type { WizardData } from '@/features/onboarding/wizardStore';
import { newId } from '@/lib/ids';

interface Options {
  locale: Locale;
  displayName: string;
  today: string;
  now: string;
  /** Localized default name for an unnamed row, e.g. the category label. */
  labelFor: (categoryId: CategoryId) => string;
  defaultIncomeName: string;
}

const positive = (n: number | null): n is number => n !== null && n > 0;

/** Turn wizard answers into the documents of a brand-new account. */
export function buildOnboardingWrites(data: WizardData, o: Options): WriteOp[] {
  const currency = data.currency ?? 'USD';
  const month = monthOf(o.today);
  const firstOfNext = `${addMonths(month, 1)}-01`;
  const ops: WriteOp[] = [];

  const profile: Profile = {
    displayName: o.displayName.slice(0, 80),
    mainCurrency: currency,
    rates: {},
    locale: o.locale,
    budgetMethod: 'fiftyThirtyTwenty',
    onboardingCompleted: true,
    isDemo: false,
    notifications: { monthlyCheckin: true, budgetAlerts: true, productUpdates: false },
    createdAt: o.now,
  };
  ops.push({ kind: 'profile', value: profile });

  const incomes = data.incomes.filter((i) => positive(i.amount));
  incomes.forEach((i, n) => {
    const id = newId('inc');
    const name = i.name.trim() || `${o.defaultIncomeName} ${String(n + 1)}`;
    ops.push({
      kind: 'set',
      name: 'incomes',
      value: { id, name, amount: i.amount ?? 0, currency, kind: i.kind },
    });
    if (i.kind === 'fixed') {
      ops.push({
        kind: 'set',
        name: 'recurring',
        value: {
          id: newId('rec'),
          type: 'income',
          amount: i.amount ?? 0,
          currency,
          categoryId: 'income',
          note: name,
          cadence: 'monthly',
          nextDate: firstOfNext,
          active: true,
        },
      });
    }
  });

  const fixed: CategoryAmounts = {};
  for (const f of data.fixedCosts.filter((x) => positive(x.amount))) {
    const name = f.name.trim() || o.labelFor(f.categoryId);
    const amount = f.amount ?? 0;
    fixed[f.categoryId] = (fixed[f.categoryId] ?? 0) + amount;
    ops.push({
      kind: 'set',
      name: 'fixedCosts',
      value: { id: newId('fc'), name, categoryId: f.categoryId, amount, currency },
    });
    ops.push({
      kind: 'set',
      name: 'recurring',
      value: {
        id: newId('rec'),
        type: 'expense',
        amount,
        currency,
        categoryId: f.categoryId,
        note: name,
        cadence: 'monthly',
        nextDate: firstOfNext,
        active: true,
      },
    });
  }

  const debts = data.debts.filter((d) => positive(d.balance));
  for (const d of debts) {
    ops.push({
      kind: 'set',
      name: 'debts',
      value: {
        id: newId('debt'),
        name: d.name.trim(),
        balance: d.balance ?? 0,
        aprBps: d.aprBps ?? 0,
        minPayment: d.minPayment ?? 0,
        currency,
      },
    });
  }

  const { savingsBalance, emergencyFund } = data.savings;
  if (positive(savingsBalance))
    ops.push({
      kind: 'set',
      name: 'accounts',
      value: {
        id: newId('acc'),
        name: 'Savings',
        kind: 'savings',
        balance: savingsBalance,
        currency,
      },
    });
  if (positive(emergencyFund))
    ops.push({
      kind: 'set',
      name: 'accounts',
      value: {
        id: newId('acc'),
        name: 'Emergency fund',
        kind: 'emergency',
        balance: emergencyFund,
        currency,
      },
    });

  for (const g of data.goals.filter((x) => positive(x.targetAmount))) {
    ops.push({
      kind: 'set',
      name: 'goals',
      value: {
        id: newId('goal'),
        name: g.name.trim(),
        targetAmount: g.targetAmount ?? 0,
        savedAmount: g.savedAmount ?? 0,
        currency,
        targetDate: g.targetDate === '' ? null : g.targetDate,
        priority: g.priority,
        createdAt: o.now,
      },
    });
  }

  const income = incomes.reduce((a, i) => a + (i.amount ?? 0), 0);
  const debtMinimums = debts.reduce((a, d) => a + (d.minPayment ?? 0), 0);
  const plan = buildBudget('fiftyThirtyTwenty', {
    income,
    fixedCosts: fixed,
    debtMinimums,
    goalContributions: 0,
    history: {},
  });
  ops.push({
    kind: 'set',
    name: 'budgets',
    value: { month, method: plan.method, income, lines: plan.lines, updatedAt: o.now },
  });

  const plannedSpending: CategoryAmounts = {};
  for (const l of plan.lines)
    if (l.categoryId !== 'savings') plannedSpending[l.categoryId] = l.planned;
  const health = computeHealthScore({
    monthlyIncome: income,
    monthlySpending: spendingTotal(plannedSpending),
    essentialSpending: essentialTotal(plannedSpending),
    emergencyFund: emergencyFund ?? 0,
    debtMinimums,
    fixedCosts: Object.values(fixed).reduce((a, b) => a + b, 0),
  });
  const netWorth =
    (savingsBalance ?? 0) + (emergencyFund ?? 0) - debts.reduce((a, d) => a + (d.balance ?? 0), 0);
  ops.push({
    kind: 'set',
    name: 'scores',
    value: {
      month,
      score: health.score,
      factors: health.factors.map((f) => ({ id: f.id, value: f.value, points: f.points })),
      netWorth,
      savingsRate: income > 0 ? (income - spendingTotal(plannedSpending)) / income : null,
      tips: null,
      computedAt: o.now,
    },
  });
  return ops;
}
