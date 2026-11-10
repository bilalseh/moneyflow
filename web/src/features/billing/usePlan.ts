import { meResponseSchema, type MeResponse } from '@moneyflow/shared';
import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/data/hooks';
import { useSessionUser } from '@/features/auth/authStore';
import { apiRequest } from '@/lib/api';

/** Plan, AI usage and which server features are configured. */
export function usePlan() {
  const { uid } = useSessionUser();
  return useQuery<MeResponse>({
    queryKey: queryKeys.me(uid),
    queryFn: () => apiRequest('/me', { schema: meResponseSchema }),
    staleTime: 30_000,
    retry: false,
  });
}
