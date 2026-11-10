import {
  accountSchema,
  budgetSchema,
  debtSchema,
  fixedCostSchema,
  goalSchema,
  incomeSchema,
  profileSchema,
  recurringRuleSchema,
  scoreSnapshotSchema,
  subscriptionPrefSchema,
  transactionSchema,
} from '../domain';
import { detectRecurring } from '../finance/recurring';
import { buildDemoData } from './seed';

const today = '2026-11-09';
const data = buildDemoData(today, '2026-11-09T10:00:00.000Z', 'en');

describe('buildDemoData', () => {
  it('is deterministic for the same day', () => {
    expect(buildDemoData(today, '2026-11-09T10:00:00.000Z', 'en')).toEqual(data);
  });

  it('produces documents that satisfy the Firestore schemas', () => {
    profileSchema.parse(data.profile);
    data.incomes.forEach((d) => incomeSchema.parse(d));
    data.fixedCosts.forEach((d) => fixedCostSchema.parse(d));
    data.debts.forEach((d) => debtSchema.parse(d));
    data.accounts.forEach((d) => accountSchema.parse(d));
    data.goals.forEach((d) => goalSchema.parse(d));
    data.transactions.forEach((d) => transactionSchema.parse(d));
    data.recurring.forEach((d) => recurringRuleSchema.parse(d));
    data.budgets.forEach((d) => budgetSchema.parse(d));
    data.scores.forEach((d) => scoreSnapshotSchema.parse(d));
    data.subscriptionPrefs.forEach((d) => subscriptionPrefSchema.parse(d));
  });

  it('covers four months and never goes past today', () => {
    const months = new Set(data.transactions.map((t) => t.date.slice(0, 7)));
    expect([...months]).toEqual(['2026-08', '2026-09', '2026-10', '2026-11']);
    expect(data.transactions.every((t) => t.date <= today)).toBe(true);
    expect(data.transactions.length).toBeGreaterThan(120);
    expect(new Set(data.transactions.map((t) => t.id)).size).toBe(data.transactions.length);
  });

  it('includes foreign-currency income with a rate to convert it', () => {
    expect(data.transactions.some((t) => t.currency === 'EUR')).toBe(true);
    expect(data.profile.rates.EUR).toBeDefined();
  });

  it('contains subscriptions the detector finds, some of them not marked as used', () => {
    const found = detectRecurring(data.transactions);
    const used = new Set(data.subscriptionPrefs.map((p) => p.key));
    expect(found.some((f) => f.key === 'netflix')).toBe(true);
    expect(
      found.filter((f) => f.categoryId === 'subscriptions' && !used.has(f.key)).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('schedules recurring rules strictly after today so nothing is duplicated', () => {
    expect(data.recurring.every((r) => r.nextDate > today)).toBe(true);
  });

  it('has a score history for the three complete months', () => {
    expect(data.scores.map((s) => s.month)).toEqual(['2026-08', '2026-09', '2026-10']);
  });
});
