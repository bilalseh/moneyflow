import type { CategoryId } from '../categories';
import { daysInMonth } from '../dates';
import type { Transaction } from '../domain';
import {
  DEMO_CARD_EXTRA_PAYMENT,
  DEMO_DEBTS,
  DEMO_FIXED_COSTS,
  DEMO_PATTERNS,
  DEMO_SAVINGS_TRANSFER,
  DEMO_SUBSCRIPTIONS,
} from './fixtures';
import { createRandom } from './random';

export const dayOf = (month: string, day: number) =>
  `${month}-${String(Math.min(day, daysInMonth(month))).padStart(2, '0')}`;

/** Every demo transaction for `months`, skipping anything dated after `today`. */
export function generateDemoTransactions(
  months: readonly string[],
  today: string,
  nowIso: string,
): Transaction[] {
  const rng = createRandom(20261109);
  const transactions: Transaction[] = [];

  const add = (
    date: string,
    amount: number,
    type: Transaction['type'],
    categoryId: CategoryId,
    note: string,
    currency: Transaction['currency'] = 'USD',
  ) => {
    if (date > today) return;
    transactions.push({
      id: `demo-${String(transactions.length).padStart(4, '0')}`,
      date,
      amount,
      currency,
      type,
      categoryId,
      note,
      source: 'demo',
      recurringId: null,
      importHash: null,
      createdAt: nowIso,
    });
  };

  for (const month of months) {
    add(dayOf(month, 1), 420000, 'income', 'income', 'Salary');
    add(
      dayOf(month, rng.int(18, 24)),
      rng.int(30, 90) * 1000,
      'income',
      'income',
      'Freelance invoice',
      'EUR',
    );
    add(dayOf(month, 2), DEMO_SAVINGS_TRANSFER, 'expense', 'savings', 'Transfer to savings');
    for (const f of DEMO_FIXED_COSTS) {
      const amount =
        f.categoryId === 'utilities' && f.id === 'fc-power'
          ? f.amount + rng.int(-25, 25) * 100
          : f.amount;
      add(dayOf(month, f.day), amount, 'expense', f.categoryId, f.name);
    }
    for (const d of DEMO_DEBTS) {
      const extra = d.id === 'debt-card' ? DEMO_CARD_EXTRA_PAYMENT : 0;
      add(dayOf(month, d.day), d.minPayment + extra, 'expense', 'debt', `${d.name} payment`);
    }
    for (const s of DEMO_SUBSCRIPTIONS)
      add(dayOf(month, s.day), s.amount, 'expense', 'subscriptions', s.note);
    for (const p of DEMO_PATTERNS) {
      const count = rng.int(p.perMonth[0], p.perMonth[1]);
      for (let i = 0; i < count; i++) {
        const amount = Math.round(rng.int(p.amount[0], p.amount[1]) / 10) * 10;
        add(
          dayOf(month, rng.int(1, daysInMonth(month))),
          amount,
          'expense',
          p.categoryId,
          rng.pick(p.notes),
        );
      }
    }
  }
  transactions.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return transactions;
}
