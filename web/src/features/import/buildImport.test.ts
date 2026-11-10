import { guessMapping, mapRows, markDuplicates, parseCsv } from '@moneyflow/shared';

import { applySuggestions, toReviewRows, toTransactions } from '@/features/import/buildImport';

const csv = parseCsv(
  'Date,Description,Amount\n2026-10-01,CARREFOUR 12,-45.20\n2026-10-01,CARREFOUR 12,-45.20\n2026-10-02,Mystery vendor,-9.99\n2026-10-03,Salary,3000\n',
);
const { rows } = mapRows(csv, guessMapping(csv, 'USD'));
const review = toReviewRows(markDuplicates(rows, []));

describe('import review', () => {
  it('unticks in-file duplicates and pre-categorizes with keyword rules', () => {
    expect(review.map((r) => r.include)).toEqual([true, false, true, true]);
    expect(review[0]?.categoryId).toBe('groceries');
    expect(review[2]?.categoryId).toBe('other');
    expect(review[3]?.categoryId).toBe('income');
  });

  it('applies AI suggestions but never over a choice the person made', () => {
    const edited = review.map((r, i) =>
      i === 0 ? { ...r, categoryId: 'dining' as const, categorySource: 'user' as const } : r,
    );
    const next = applySuggestions(edited, [
      { id: '0', categoryId: 'shopping', confidence: 0.9 },
      { id: '2', categoryId: 'shopping', confidence: 0.7 },
      { id: '3', categoryId: 'shopping', confidence: 0.9 },
    ]);
    expect(next[0]?.categoryId).toBe('dining');
    expect(next[2]).toMatchObject({
      categoryId: 'shopping',
      categorySource: 'ai',
      aiConfidence: 0.7,
    });
    expect(next[3]?.categoryId).toBe('income');
  });

  it('writes only included rows, tagged as CSV with their hash', () => {
    const txs = toTransactions(
      review,
      '2026-11-09T00:00:00Z',
      (r) => `csv_${r.hash}_${String(r.rowIndex)}`,
    );
    expect(txs).toHaveLength(3);
    expect(txs.every((t) => t.source === 'csv' && t.importHash !== null)).toBe(true);
    expect(txs[0]).toMatchObject({ amount: 4520, type: 'expense', note: 'CARREFOUR 12' });
  });
});
