import { advanceDate, dueDates, type RecurringRule, type Transaction } from '@moneyflow/shared';

import type { WriteOp } from '@/data/firestore';

/**
 * Writes that bring recurring rules up to date: one transaction per due date
 * (with a deterministic id, so running twice or in two tabs never creates a
 * duplicate) and the rule's next date moved past today.
 */
export function recurringWrites(
  rules: readonly RecurringRule[],
  today: string,
  now: string,
): WriteOp[] {
  const ops: WriteOp[] = [];
  for (const rule of rules) {
    if (!rule.active) continue;
    const dates = dueDates(rule.nextDate, rule.cadence, today, 60);
    if (dates.length === 0) continue;
    for (const date of dates) {
      const tx: Transaction = {
        id: `rec_${rule.id}_${date}`,
        date,
        amount: rule.amount,
        currency: rule.currency,
        type: rule.type,
        categoryId: rule.categoryId,
        note: rule.note,
        source: 'recurring',
        recurringId: rule.id,
        importHash: null,
        createdAt: now,
      };
      ops.push({ kind: 'set', name: 'transactions', value: tx });
    }
    ops.push({
      kind: 'set',
      name: 'recurring',
      value: { ...rule, nextDate: advanceDate(rule.nextDate, rule.cadence, dates.length) },
    });
  }
  return ops;
}
