import type { CategoryId } from '../categories';
import { addMonths, addMonthsToDate, lastMonths, monthOf } from '../dates';
import type {
  Account,
  Budget,
  Debt,
  FixedCost,
  Goal,
  Income,
  Locale,
  Profile,
  RecurringRule,
  ScoreSnapshot,
  SubscriptionPref,
  Transaction,
} from '../domain';
import { buildBudget } from '../finance/budget';
import { computeHealthScore } from '../finance/healthScore';
import { normalizeMerchant } from '../finance/recurring';
import {
  averageByCategory,
  essentialTotal,
  summarizeMonth,
  type CategoryAmounts,
} from '../finance/totals';
import {
  DEMO_ACCOUNTS,
  DEMO_DEBTS,
  DEMO_FIXED_COSTS,
  DEMO_GOALS,
  DEMO_INCOMES,
  DEMO_SAVINGS_TRANSFER,
  DEMO_SUBSCRIPTIONS,
} from './fixtures';
import { dayOf, generateDemoTransactions } from './transactions';

export interface DemoDataset {
  profile: Profile;
  incomes: Income[];
  fixedCosts: FixedCost[];
  debts: Debt[];
  accounts: Account[];
  goals: Goal[];
  transactions: Transaction[];
  recurring: RecurringRule[];
  budgets: Budget[];
  scores: ScoreSnapshot[];
  subscriptionPrefs: SubscriptionPref[];
}

export const DEMO_MONTHS = 4;
const EUR_RATE = '1.08';

/**
 * Four months of realistic activity for one household, ending today. The
 * same `today` always yields the same data. Freelance income arrives in EUR
 * to show multi-currency handling.
 */
export function buildDemoData(today: string, nowIso: string, locale: Locale): DemoDataset {
  const thisMonth = monthOf(today);
  const months = lastMonths(thisMonth, DEMO_MONTHS);
  const transactions = generateDemoTransactions(months, today, nowIso);

  const fixedByCategory: CategoryAmounts = {};
  for (const f of DEMO_FIXED_COSTS)
    fixedByCategory[f.categoryId] = (fixedByCategory[f.categoryId] ?? 0) + f.amount;
  const debtMinimums = DEMO_DEBTS.reduce((a, d) => a + d.minPayment, 0);
  const fixedTotal = Object.values(fixedByCategory).reduce((a, b) => a + b, 0);

  // Ledger in USD: freelance EUR converted at the demo rate.
  const ledger = transactions.map((t) => ({
    ...t,
    amount: t.currency === 'EUR' ? Math.round(t.amount * 1.08) : t.amount,
  }));
  const complete = months.slice(0, -1);
  const summaries = complete.map((m) => summarizeMonth(ledger, m));
  const history = averageByCategory(summaries);
  for (const id of Object.keys(fixedByCategory) as CategoryId[])
    Reflect.deleteProperty(history, id);
  Reflect.deleteProperty(history, 'debt');
  Reflect.deleteProperty(history, 'savings');

  const plannedIncome = 420000 + Math.round(60000 * 1.08);
  const plan = buildBudget('fiftyThirtyTwenty', {
    income: plannedIncome,
    fixedCosts: fixedByCategory,
    debtMinimums,
    goalContributions: DEMO_SAVINGS_TRANSFER,
    history,
  });
  const budgets: Budget[] = months.map((month) => ({
    month,
    method: 'fiftyThirtyTwenty',
    income: plannedIncome,
    lines: plan.lines,
    updatedAt: nowIso,
  }));

  const scores: ScoreSnapshot[] = summaries.map((s, i) => {
    const monthsAgo = complete.length - i;
    const health = computeHealthScore({
      monthlyIncome: s.income,
      monthlySpending: s.spending,
      essentialSpending: essentialTotal(s.byCategory),
      emergencyFund: 650000 - monthsAgo * 25000,
      debtMinimums,
      fixedCosts: fixedTotal,
    });
    return {
      month: s.month,
      score: health.score,
      factors: health.factors.map((f) => ({ id: f.id, value: f.value, points: f.points })),
      netWorth: 195000 - monthsAgo * 95000,
      savingsRate: s.savingsRate,
      tips: null,
      computedAt: nowIso,
    };
  });

  const nextDay = (day: number) => {
    const date = dayOf(thisMonth, day);
    return date > today ? date : addMonthsToDate(dayOf(thisMonth, day), 1);
  };
  const rule = (
    id: string,
    type: RecurringRule['type'],
    amount: number,
    categoryId: CategoryId,
    note: string,
    day: number,
  ): RecurringRule => ({
    id,
    type,
    amount,
    currency: 'USD',
    categoryId,
    note,
    cadence: 'monthly',
    nextDate: nextDay(day),
    active: true,
  });
  const recurring: RecurringRule[] = [
    rule('rec-salary', 'income', 420000, 'income', 'Salary', 1),
    rule('rec-rent', 'expense', 145000, 'housing', 'Rent', 1),
    rule('rec-savings', 'expense', DEMO_SAVINGS_TRANSFER, 'savings', 'Transfer to savings', 2),
    ...DEMO_SUBSCRIPTIONS.slice(0, 4).map((s, i) =>
      rule(`rec-sub-${String(i)}`, 'expense', s.amount, 'subscriptions', s.note, s.day),
    ),
  ];

  return {
    profile: {
      displayName: 'Alex',
      mainCurrency: 'USD',
      rates: { EUR: EUR_RATE },
      locale,
      budgetMethod: 'fiftyThirtyTwenty',
      onboardingCompleted: true,
      isDemo: true,
      notifications: { monthlyCheckin: true, budgetAlerts: true, productUpdates: false },
      createdAt: nowIso,
    },
    incomes: DEMO_INCOMES.map((i) => ({
      ...i,
      currency: i.id === 'inc-freelance' ? 'EUR' : 'USD',
      amount: i.id === 'inc-freelance' ? 60000 : i.amount,
    })),
    fixedCosts: DEMO_FIXED_COSTS.map(({ day: _day, ...f }) => ({ ...f, currency: 'USD' })),
    debts: DEMO_DEBTS.map(({ day: _day, ...d }) => ({ ...d, currency: 'USD' })),
    accounts: DEMO_ACCOUNTS.map((a) => ({ ...a, currency: 'USD' })),
    goals: DEMO_GOALS.map(({ inMonths, ...g }) => ({
      ...g,
      currency: 'USD',
      targetDate: `${addMonths(thisMonth, inMonths)}-01`,
      createdAt: nowIso,
    })),
    transactions,
    recurring,
    budgets,
    scores,
    subscriptionPrefs: DEMO_SUBSCRIPTIONS.filter((s) => s.used !== null).map((s) => ({
      key: normalizeMerchant(s.note),
      used: true,
      updatedAt: nowIso,
    })),
  };
}
