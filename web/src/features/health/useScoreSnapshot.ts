import type { ScoreSnapshot } from '@moneyflow/shared';
import { useEffect, useMemo } from 'react';

import type { FinanceView } from '@/data/financeView';
import { useCollection, useSaveDoc } from '@/data/hooks';
import { nowIso } from '@/lib/ids';

/**
 * Keep this month's score snapshot current, which is what builds the
 * month-by-month history. Writes only when the score or net worth changed,
 * and keeps cached AI tips while the score is unchanged.
 */
export function useScoreSnapshot(view: FinanceView | null) {
  const scores = useCollection('scores');
  const save = useSaveDoc('scores', (s) => s.month);
  const existing = scores.data?.find((s) => s.month === view?.month);

  const next = useMemo<ScoreSnapshot | null>(() => {
    if (!view) return null;
    return {
      month: view.month,
      score: view.health.score,
      factors: view.health.factors.map((f) => ({ id: f.id, value: f.value, points: f.points })),
      netWorth: view.netWorth,
      savingsRate: view.health.factors.find((f) => f.id === 'savingsRate')?.value ?? null,
      tips: existing?.score === view.health.score ? (existing.tips ?? null) : null,
      computedAt: nowIso(),
    };
  }, [view, existing]);

  const changed =
    next !== null &&
    scores.isSuccess &&
    (existing?.score !== next.score || existing.netWorth !== next.netWorth);
  const { mutate } = save;
  useEffect(() => {
    if (changed) mutate(next);
  }, [changed, next, mutate]);

  const snapshot: ScoreSnapshot | null =
    existing !== undefined && existing.score === next?.score ? existing : next;
  return { snapshot, history: scores.data ?? [], save };
}
