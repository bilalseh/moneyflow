import type { RecurringRule } from '@moneyflow/shared';

import { recurringWrites } from '@/features/transactions/recurringSync';

const rule: RecurringRule = {
  id: 'rent',
  type: 'expense',
  amount: 100000,
  currency: 'USD',
  categoryId: 'housing',
  note: 'Rent',
  cadence: 'monthly',
  nextDate: '2026-09-01',
  active: true,
};

describe('recurringWrites', () => {
  it('records every missed occurrence and moves the rule past today', () => {
    const ops = recurringWrites([rule], '2026-11-09', '2026-11-09T00:00:00Z');
    const txs = ops.filter((o) => o.kind === 'set' && o.name === 'transactions');
    expect(txs.map((o) => (o as { value: { id: string } }).value.id)).toEqual([
      'rec_rent_2026-09-01',
      'rec_rent_2026-10-01',
      'rec_rent_2026-11-01',
    ]);
    const updated = ops.find((o) => o.kind === 'set' && o.name === 'recurring') as {
      value: RecurringRule;
    };
    expect(updated.value.nextDate).toBe('2026-12-01');
  });

  it('does nothing for paused rules or rules not yet due', () => {
    expect(recurringWrites([{ ...rule, active: false }], '2026-11-09', 'x')).toEqual([]);
    expect(recurringWrites([{ ...rule, nextDate: '2026-12-01' }], '2026-11-09', 'x')).toEqual([]);
  });
});
