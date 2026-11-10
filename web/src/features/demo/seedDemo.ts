import { buildDemoData, todayIso, type Locale } from '@moneyflow/shared';

import { clearUserData, commitWrites, type WriteOp } from '@/data/firestore';
import { nowIso } from '@/lib/ids';

/** Every write needed to turn an empty account into the demo household. */
export function demoWrites(locale: Locale, today = todayIso(), now = nowIso()): WriteOp[] {
  const data = buildDemoData(today, now, locale);
  return [
    { kind: 'profile', value: data.profile },
    ...data.incomes.map((value) => ({ kind: 'set', name: 'incomes', value }) as const),
    ...data.fixedCosts.map((value) => ({ kind: 'set', name: 'fixedCosts', value }) as const),
    ...data.debts.map((value) => ({ kind: 'set', name: 'debts', value }) as const),
    ...data.accounts.map((value) => ({ kind: 'set', name: 'accounts', value }) as const),
    ...data.goals.map((value) => ({ kind: 'set', name: 'goals', value }) as const),
    ...data.transactions.map((value) => ({ kind: 'set', name: 'transactions', value }) as const),
    ...data.recurring.map((value) => ({ kind: 'set', name: 'recurring', value }) as const),
    ...data.budgets.map((value) => ({ kind: 'set', name: 'budgets', value }) as const),
    ...data.scores.map((value) => ({ kind: 'set', name: 'scores', value }) as const),
    ...data.subscriptionPrefs.map(
      (value) => ({ kind: 'set', name: 'subscriptionPrefs', value }) as const,
    ),
  ];
}

export async function seedDemo(uid: string, locale: Locale): Promise<void> {
  await commitWrites(uid, demoWrites(locale));
}

/** Wipe and re-seed: lets a visitor start the demo over from Settings. */
export async function resetDemo(uid: string, locale: Locale): Promise<void> {
  await clearUserData(uid);
  await seedDemo(uid, locale);
}
