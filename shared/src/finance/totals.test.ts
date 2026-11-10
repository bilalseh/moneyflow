import {
  averageByCategory,
  essentialTotal,
  spendingTotal,
  summarizeMonth,
  summarizeMonths,
  type LedgerEntry,
} from './totals';

const entries: LedgerEntry[] = [
  { date: '2026-10-01', amount: 400000, type: 'income', categoryId: 'income' },
  { date: '2026-10-02', amount: 150000, type: 'expense', categoryId: 'housing' },
  { date: '2026-10-05', amount: 30000, type: 'expense', categoryId: 'dining' },
  { date: '2026-10-06', amount: 50000, type: 'expense', categoryId: 'savings' },
  { date: '2026-11-01', amount: 400000, type: 'income', categoryId: 'income' },
  { date: '2026-11-03', amount: 10000, type: 'expense', categoryId: 'dining' },
];

describe('summarizeMonth', () => {
  it('separates income, spending and savings transfers', () => {
    const s = summarizeMonth(entries, '2026-10');
    expect(s.income).toBe(400000);
    expect(s.spending).toBe(180000);
    expect(s.savedTransfers).toBe(50000);
    expect(s.byCategory).toEqual({ housing: 150000, dining: 30000, savings: 50000 });
    expect(s.savingsRate).toBeCloseTo(0.55);
  });

  it('returns a null savings rate without income', () => {
    expect(summarizeMonth([], '2026-09').savingsRate).toBeNull();
  });
});

describe('averages and group totals', () => {
  it('averages per category across months, counting missing months as zero', () => {
    const avg = averageByCategory(summarizeMonths(entries, ['2026-10', '2026-11']));
    expect(avg).toEqual({ housing: 75000, dining: 20000, savings: 25000 });
  });

  it('totals spending and essentials', () => {
    const amounts = { housing: 100, groceries: 50, dining: 30, savings: 999 };
    expect(spendingTotal(amounts)).toBe(180);
    expect(essentialTotal(amounts)).toBe(150);
  });
});
