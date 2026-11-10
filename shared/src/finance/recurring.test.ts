import {
  advanceDate,
  detectRecurring,
  dueDates,
  normalizeMerchant,
  type RecurringSource,
} from './recurring';

let n = 0;
const tx = (
  date: string,
  amount: number,
  note: string,
  over: Partial<RecurringSource> = {},
): RecurringSource => ({
  id: `t${String(++n)}`,
  date,
  amount,
  note,
  type: 'expense',
  categoryId: 'subscriptions',
  ...over,
});

describe('normalizeMerchant', () => {
  it('drops digits, punctuation and noise words', () => {
    expect(normalizeMerchant('NETFLIX.COM 866-579 Payment')).toBe('netflix');
    expect(normalizeMerchant('  Spotify AB *1234 ')).toBe('spotify ab');
  });
});

describe('detectRecurring', () => {
  it('finds a monthly subscription and totals it yearly', () => {
    const [sub] = detectRecurring([
      tx('2026-08-03', 1599, 'NETFLIX.COM 123'),
      tx('2026-09-03', 1599, 'NETFLIX.COM 456'),
      tx('2026-10-03', 1599, 'Netflix.com'),
    ]);
    expect(sub?.cadence).toBe('monthly');
    expect(sub?.yearlyTotal).toBe(1599 * 12);
    expect(sub?.occurrences).toBe(3);
    expect(sub?.nextDate).toBe('2026-11-03');
  });

  it('tolerates small price changes and ignores outliers', () => {
    const [sub] = detectRecurring([
      tx('2026-08-10', 1000, 'Gym'),
      tx('2026-09-10', 1100, 'Gym'),
      tx('2026-09-20', 5000, 'Gym'),
      tx('2026-10-10', 1000, 'Gym'),
    ]);
    expect(sub?.cadence).toBe('monthly');
    expect(sub?.occurrences).toBe(3);
  });

  it('finds weekly and yearly charges', () => {
    const found = detectRecurring([
      tx('2026-10-01', 500, 'Bakery'),
      tx('2026-10-08', 500, 'Bakery'),
      tx('2026-10-15', 520, 'Bakery'),
      tx('2025-03-01', 9900, 'Domain renewal'),
      tx('2026-03-02', 9900, 'Domain renewal'),
    ]);
    expect(found.map((f) => [f.key, f.cadence])).toEqual(
      expect.arrayContaining([
        ['bakery', 'weekly'],
        ['domain renewal', 'yearly'],
      ]),
    );
  });

  it('ignores irregular charges, single charges and income', () => {
    expect(
      detectRecurring([
        tx('2026-08-01', 3000, 'Amazon'),
        tx('2026-08-12', 3000, 'Amazon'),
        tx('2026-10-30', 3000, 'Amazon'),
        tx('2026-09-01', 999, 'Once'),
        tx('2026-08-01', 400000, 'Salary', { type: 'income' }),
        tx('2026-09-01', 400000, 'Salary', { type: 'income' }),
      ]),
    ).toEqual([]);
  });
});

describe('recurring rule dates', () => {
  it('lists due dates up to a day and advances the rule', () => {
    expect(dueDates('2026-09-30', 'monthly', '2026-11-30')).toEqual([
      '2026-09-30',
      '2026-10-30',
      '2026-11-30',
    ]);
    expect(dueDates('2026-11-01', 'weekly', '2026-11-15')).toEqual([
      '2026-11-01',
      '2026-11-08',
      '2026-11-15',
    ]);
    expect(dueDates('2026-12-01', 'monthly', '2026-11-30')).toEqual([]);
    expect(advanceDate('2026-01-31', 'monthly', 1)).toBe('2026-02-28');
    expect(advanceDate('2026-01-31', 'monthly', 2)).toBe('2026-03-31');
  });
});
