import { getCurrency, toCsv, type CurrencyCode, type Profile } from '@moneyflow/shared';
import { strToU8, zipSync } from 'fflate';

import { readCollection, readProfile, type DocOf } from '@/data/firestore';

/** Minor units as an exact decimal string in major units ("1234.50"), for spreadsheets. */
export function major(amount: number, currency: CurrencyCode): string {
  const digits = getCurrency(currency).minorUnits;
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  if (digits === 0) return `${sign}${String(abs)}`;
  const scale = 10 ** digits;
  return `${sign}${String(Math.floor(abs / scale))}.${String(abs % scale).padStart(digits, '0')}`;
}

export interface ExportInput {
  profile: Profile | null;
  incomes: DocOf<'incomes'>[];
  fixedCosts: DocOf<'fixedCosts'>[];
  debts: DocOf<'debts'>[];
  accounts: DocOf<'accounts'>[];
  goals: DocOf<'goals'>[];
  transactions: DocOf<'transactions'>[];
  recurring: DocOf<'recurring'>[];
  budgets: DocOf<'budgets'>[];
  scores: DocOf<'scores'>[];
  checkins: DocOf<'checkins'>[];
}

/** One CSV per kind of data. Text cells are escaped against spreadsheet formula injection. */
export function buildCsvFiles(d: ExportInput): Record<string, string> {
  const main = d.profile?.mainCurrency ?? 'USD';
  const txs = [...d.transactions].sort((a, b) => a.date.localeCompare(b.date));
  return {
    'transactions.csv': toCsv(
      ['date', 'type', 'category', 'amount', 'currency', 'note', 'source'],
      txs.map((t) => [
        t.date,
        t.type,
        t.categoryId,
        major(t.amount, t.currency),
        t.currency,
        t.note,
        t.source,
      ]),
    ),
    'incomes.csv': toCsv(
      ['name', 'kind', 'monthly_amount', 'currency'],
      d.incomes.map((i) => [i.name, i.kind, major(i.amount, i.currency), i.currency]),
    ),
    'fixed_costs.csv': toCsv(
      ['name', 'category', 'monthly_amount', 'currency'],
      d.fixedCosts.map((f) => [f.name, f.categoryId, major(f.amount, f.currency), f.currency]),
    ),
    'debts.csv': toCsv(
      ['name', 'balance', 'apr_percent', 'min_payment', 'currency'],
      d.debts.map((x) => [
        x.name,
        major(x.balance, x.currency),
        (x.aprBps / 100).toFixed(2),
        major(x.minPayment, x.currency),
        x.currency,
      ]),
    ),
    'accounts.csv': toCsv(
      ['name', 'kind', 'balance', 'currency'],
      d.accounts.map((a) => [a.name, a.kind, major(a.balance, a.currency), a.currency]),
    ),
    'goals.csv': toCsv(
      ['name', 'target', 'saved', 'currency', 'target_date', 'priority'],
      d.goals.map((g) => [
        g.name,
        major(g.targetAmount, g.currency),
        major(g.savedAmount, g.currency),
        g.currency,
        g.targetDate ?? '',
        g.priority,
      ]),
    ),
    'recurring.csv': toCsv(
      ['note', 'type', 'category', 'amount', 'currency', 'cadence', 'next_date', 'active'],
      d.recurring.map((r) => [
        r.note,
        r.type,
        r.categoryId,
        major(r.amount, r.currency),
        r.currency,
        r.cadence,
        r.nextDate,
        r.active,
      ]),
    ),
    'budgets.csv': toCsv(
      ['month', 'method', 'category', 'planned', 'currency'],
      d.budgets.flatMap((b) =>
        b.lines.map((l) => [b.month, b.method, l.categoryId, major(l.planned, main), main]),
      ),
    ),
    'health_scores.csv': toCsv(
      ['month', 'score', 'net_worth', 'currency', 'savings_rate'],
      d.scores.map((s) => [
        s.month,
        s.score,
        major(s.netWorth, main),
        main,
        s.savingsRate === null ? '' : s.savingsRate.toFixed(4),
      ]),
    ),
    'checkins.csv': toCsv(
      ['month', 'summary', 'questions_and_answers', 'adjustments'],
      d.checkins.map((c) => [
        c.month,
        c.summary,
        c.questions.map((q) => `${q.text} ${q.answer}`).join(' | '),
        c.adjustments
          .map((a) => `${a.categoryId} ${String(a.changePercent)}% (${a.status})`)
          .join(' | '),
      ]),
    ),
    'profile.csv': toCsv(
      ['display_name', 'main_currency', 'locale', 'budget_method', 'rates'],
      d.profile
        ? [
            [
              d.profile.displayName,
              d.profile.mainCurrency,
              d.profile.locale,
              d.profile.budgetMethod,
              Object.entries(d.profile.rates)
                .map(([k, v]) => `${k}=${v}`)
                .join(' '),
            ],
          ]
        : [],
    ),
  };
}

export async function downloadExport(uid: string): Promise<void> {
  const [
    profile,
    incomes,
    fixedCosts,
    debts,
    accounts,
    goals,
    transactions,
    recurring,
    budgets,
    scores,
    checkins,
  ] = await Promise.all([
    readProfile(uid),
    readCollection(uid, 'incomes'),
    readCollection(uid, 'fixedCosts'),
    readCollection(uid, 'debts'),
    readCollection(uid, 'accounts'),
    readCollection(uid, 'goals'),
    readCollection(uid, 'transactions'),
    readCollection(uid, 'recurring'),
    readCollection(uid, 'budgets'),
    readCollection(uid, 'scores'),
    readCollection(uid, 'checkins'),
  ]);
  const files = buildCsvFiles({
    profile,
    incomes,
    fixedCosts,
    debts,
    accounts,
    goals,
    transactions,
    recurring,
    budgets,
    scores,
    checkins,
  });
  // A BOM keeps spreadsheet apps reading the files as UTF-8 (Arabic text, currency symbols).
  const zip = zipSync(
    Object.fromEntries(Object.entries(files).map(([name, csv]) => [name, strToU8(`\uFEFF${csv}`)])),
  );
  const url = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `moneyflow-export-${new Date().toISOString().slice(0, 10)}.zip`;
  link.click();
  URL.revokeObjectURL(url);
}
