import { todayIso } from '@moneyflow/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { commitWrites, readCollection } from '@/data/firestore';
import { queryKeys } from '@/data/hooks';
import { useSessionUser } from '@/features/auth/authStore';
import { recurringWrites } from '@/features/transactions/recurringSync';
import { nowIso } from '@/lib/ids';

/** Once per session, record recurring transactions that came due since the last visit. */
export function useRecurringSync(): void {
  const { uid } = useSessionUser();
  const client = useQueryClient();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const run = async () => {
      const rules = await readCollection(uid, 'recurring');
      const ops = recurringWrites(rules, todayIso(), nowIso());
      if (ops.length === 0) return;
      await commitWrites(uid, ops);
      await client.invalidateQueries({ queryKey: queryKeys.collection(uid, 'transactions') });
      await client.invalidateQueries({ queryKey: queryKeys.collection(uid, 'recurring') });
    };
    run().catch((error: unknown) => {
      console.warn('Recurring sync failed', error);
    });
  }, [uid, client]);
}
