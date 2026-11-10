import {
  addMonths,
  averageByCategory,
  computeHealthScore,
  essentialTotal,
  isSpendingCategory,
  lastMonths,
  monthOf,
  spendingTotal,
  summarizeMonth,
  sumInMain,
  toMain,
  MissingRateError,
  type Account,
  type Baseline,
  type Budget,
  type CategoryAmounts,
  type CategoryId,
  type CurrencyCode,
  type Debt,
  type DebtInput,
  type FixedCost,
  type Goal,
  type GoalInput,
  type HealthScore,
  type Income,
  type LedgerEntry,
  type MonthSummary,
  type Profile,
  type Rates,
  type Transaction,
} from '@moneyflow/shared';

export interface RawData {
  profile: Profile;
  incomes: Income[];
  fixedCosts: FixedCost[];
  debts: Debt[];
  accounts: Account[];
  goals: Goal[];
  transactions: Transaction[];
  budgets: Budget[];
}

export interface Entry extends LedgerEntry {
  id: string;
  note: string;
}

export interface FinanceView {
  today: string;
  month: string;
  main: CurrencyCode;
  rates: Rates;
  missingRates: CurrencyCode[];
  ledger: Entry[];
  current: MonthSummary;
  trend: MonthSummary[];
  /** Months used for the averages (up to 3 complete months with data). */
  basisMonths: string[];
  plannedIncome: number;
  incomeBasis: number;
  spendingBasis: CategoryAmounts;
  fixedByCategory: CategoryAmounts;
  fixedTotal: number;
  debts: DebtInput[];
  debtMinimums: number;
  liquidSavings: number;
  emergencyFund: number;
  netWorth: number;
  goals: GoalInput[];
  budget: Budget | null;
  goalContribution: number;
  health: HealthScore;
  baseline: Baseline;
}

/** Convert, remembering currencies with no rate instead of throwing. */
function converter(main: CurrencyCode, rates: Rates, missing: Set<CurrencyCode>) {
  return (amount: number, currency: CurrencyCode): number => {
    try {
      return toMain(amount, currency, main, rates);
    } catch (error) {
      if (!(error instanceof MissingRateError)) throw error;
      missing.add(error.currency);
      return 0;
    }
  };
}

export function buildFinanceView(data: RawData, today: string): FinanceView {
  const main = data.profile.mainCurrency;
  const rates = data.profile.rates;
  const missing = new Set<CurrencyCode>();
  const conv = converter(main, rates, missing);
  const month = monthOf(today);

  const ledger: Entry[] = data.transactions
    .map((t) => ({
      id: t.id,
      date: t.date,
      type: t.type,
      categoryId: t.categoryId,
      note: t.note,
      amount: conv(t.amount, t.currency),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const trend = lastMonths(month, 6).map((m) => summarizeMonth(ledger, m));
  const current = trend[trend.length - 1] ?? summarizeMonth(ledger, month);
  const complete = lastMonths(addMonths(month, -1), 3)
    .map((m) => summarizeMonth(ledger, m))
    .filter((s) => s.income > 0 || s.spending > 0);

  const fixedByCategory: CategoryAmounts = {};
  for (const f of data.fixedCosts)
    fixedByCategory[f.categoryId] =
      (fixedByCategory[f.categoryId] ?? 0) + conv(f.amount, f.currency);
  const fixedTotal = Object.values(fixedByCategory).reduce((a, b) => a + b, 0);

  const debts = data.debts.map((d) => ({
    id: d.id,
    name: d.name,
    aprBps: d.aprBps,
    balance: conv(d.balance, d.currency),
    minPayment: conv(d.minPayment, d.currency),
  }));
  const debtMinimums = debts.filter((d) => d.balance > 0).reduce((a, d) => a + d.minPayment, 0);
  const plannedIncome = sumInMain(data.incomes, main, rates).total;
  sumInMain(data.incomes, main, rates).missing.forEach((c) => missing.add(c));

  const budget =
    data.budgets.find((b) => b.month === month) ??
    [...data.budgets].sort((a, b) => b.month.localeCompare(a.month))[0] ??
    null;
  const planned: CategoryAmounts = {};
  for (const l of budget?.lines ?? []) planned[l.categoryId] = l.planned;

  // Spending basis: the recent 3-month average when there is history, else the plan, else commitments.
  let spendingBasis: CategoryAmounts = {};
  if (complete.length > 0) spendingBasis = averageByCategory(complete);
  else if (budget) spendingBasis = { ...planned };
  else spendingBasis = { ...fixedByCategory, ...(debtMinimums > 0 ? { debt: debtMinimums } : {}) };
  for (const id of Object.keys(spendingBasis) as CategoryId[]) {
    if (!isSpendingCategory(id)) Reflect.deleteProperty(spendingBasis, id);
  }

  const historicIncome =
    complete.length > 0
      ? Math.round(complete.reduce((a, s) => a + s.income, 0) / complete.length)
      : 0;
  const incomeBasis = plannedIncome > 0 ? plannedIncome : historicIncome;

  const accounts = data.accounts.map((a) => ({
    kind: a.kind,
    balance: conv(a.balance, a.currency),
  }));
  const emergencyFund = accounts
    .filter((a) => a.kind === 'emergency')
    .reduce((s, a) => s + a.balance, 0);
  const liquidSavings = accounts
    .filter((a) => a.kind !== 'emergency')
    .reduce((s, a) => s + a.balance, 0);
  const goals: GoalInput[] = data.goals.map((g) => ({
    id: g.id,
    name: g.name,
    priority: g.priority,
    targetDate: g.targetDate,
    targetAmount: conv(g.targetAmount, g.currency),
    savedAmount: conv(g.savedAmount, g.currency),
  }));
  const netWorth = emergencyFund + liquidSavings - debts.reduce((a, d) => a + d.balance, 0);
  const goalContribution = data.goals.length > 0 ? (planned.savings ?? 0) : 0;

  const health = computeHealthScore({
    monthlyIncome: incomeBasis,
    monthlySpending: spendingTotal(spendingBasis),
    essentialSpending: essentialTotal(spendingBasis),
    emergencyFund,
    debtMinimums,
    fixedCosts: fixedTotal,
  });

  return {
    today,
    month,
    main,
    rates,
    missingRates: [...missing],
    ledger,
    current,
    trend,
    basisMonths: complete.map((s) => s.month),
    plannedIncome,
    incomeBasis,
    spendingBasis,
    fixedByCategory,
    fixedTotal,
    debts,
    debtMinimums,
    liquidSavings,
    emergencyFund,
    netWorth,
    goals,
    budget,
    goalContribution,
    health,
    baseline: {
      month,
      monthlyIncome: incomeBasis,
      spending: spendingBasis,
      liquidSavings,
      emergencyFund,
      debtMinimums,
      fixedCosts: fixedTotal,
      goalContribution,
      goals,
    },
  };
}
