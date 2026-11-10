import {
  healthTipsResponseSchema,
  type HealthFactorId,
  type HealthScore,
  type Locale,
  type ScoreSnapshot,
} from '@moneyflow/shared';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { useSaveDoc } from '@/data/hooks';
import type { FinanceView } from '@/data/financeView';
import { useSessionUser } from '@/features/auth/authStore';
import { healthyLabel } from '@/features/health/factors';
import { apiRequest } from '@/lib/api';
import { useFormatters } from '@/lib/format';

export interface Tips {
  items: Partial<Record<HealthFactorId, string>>;
  source: 'ai' | 'fallback' | 'offline';
}

/**
 * One plain-language suggestion per factor. Order of preference: tips cached
 * on this month's snapshot, then the API (AI or its fallback), then the
 * built-in offline text when the API cannot be reached.
 */
export function useHealthTips(
  view: FinanceView | null,
  snapshot: ScoreSnapshot | null,
  health: HealthScore | null,
) {
  const { t, i18n } = useTranslation();
  const fmt = useFormatters();
  const { uid } = useSessionUser();
  const save = useSaveDoc('scores', (s) => s.month);
  const locale: Locale = i18n.language.startsWith('ar') ? 'ar' : 'en';
  const cached = snapshot?.tips?.locale === locale ? snapshot.tips : null;

  return useQuery<Tips>({
    queryKey: ['tips', uid, view?.month, locale, health?.score],
    enabled: view !== null && health !== null && snapshot !== null,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      if (cached) {
        return {
          items: Object.fromEntries(cached.items.map((i) => [i.factorId, i.text])),
          source: cached.source,
        };
      }
      if (!view || !health || !snapshot) return { items: {}, source: 'offline' };
      try {
        const response = await apiRequest('/ai/health-tips', {
          method: 'POST',
          schema: healthTipsResponseSchema,
          body: {
            locale,
            currency: view.main,
            score: health.score,
            factors: health.factors.map((f) => ({
              id: f.id,
              value: f.value,
              points: f.points,
              maxPoints: f.maxPoints,
              status: f.status,
              healthy: healthyLabel(f.id, fmt, t),
            })),
          },
        });
        save.mutate({
          ...snapshot,
          tips: { locale, source: response.source, items: response.tips },
        });
        return {
          items: Object.fromEntries(response.tips.map((i) => [i.factorId, i.text])),
          source: response.source,
        };
      } catch {
        return {
          items: Object.fromEntries(
            health.factors.map((f) => [f.id, t(`health.offlineTips.${f.id}.${f.status}`)]),
          ),
          source: 'offline',
        };
      }
    },
  });
}
