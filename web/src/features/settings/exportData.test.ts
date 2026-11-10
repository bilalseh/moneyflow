import { buildDemoData } from '@moneyflow/shared';

import { buildCsvFiles, major } from '@/features/settings/exportData';

describe('major', () => {
  it('formats minor units as exact decimals for each currency', () => {
    expect(major(123450, 'USD')).toBe('1234.50');
    expect(major(-5, 'USD')).toBe('-0.05');
    expect(major(1500000, 'LBP')).toBe('1500000');
    expect(major(1500, 'JOD')).toBe('1.500');
  });
});

describe('buildCsvFiles', () => {
  const demo = buildDemoData('2026-11-09', 'now', 'en');
  const files = buildCsvFiles({ ...demo, checkins: [] });

  it('writes one file per kind of data', () => {
    expect(Object.keys(files).sort()).toEqual([
      'accounts.csv',
      'budgets.csv',
      'checkins.csv',
      'debts.csv',
      'fixed_costs.csv',
      'goals.csv',
      'health_scores.csv',
      'incomes.csv',
      'profile.csv',
      'recurring.csv',
      'transactions.csv',
    ]);
  });

  it('exports every transaction with its own currency', () => {
    const lines = (files['transactions.csv'] ?? '').trim().split('\r\n');
    expect(lines[0]).toBe('date,type,category,amount,currency,note,source');
    expect(lines).toHaveLength(demo.transactions.length + 1);
    expect(lines.some((l) => l.includes(',EUR,'))).toBe(true);
  });
});
