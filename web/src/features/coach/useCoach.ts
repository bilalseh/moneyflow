import { coachResponseSchema, type Locale } from '@moneyflow/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { queryKeys } from '@/data/hooks';
import type { FinanceView } from '@/data/financeView';
import { useSessionUser } from '@/features/auth/authStore';
import { buildCoachContext } from '@/features/coach/context';
import { toApiMessages, useConversation } from '@/features/coach/conversation';
import { runTool } from '@/features/coach/tools';
import { ApiError, apiRequest } from '@/lib/api';

/** Tool rounds allowed per question before giving up. */
const MAX_TOOL_ROUNDS = 3;

export function useCoach(view: FinanceView | null) {
  const { i18n } = useTranslation();
  const { uid } = useSessionUser();
  const client = useQueryClient();
  const { turns, add, clear } = useConversation();
  const [pending, setPending] = useState(false);
  const locale: Locale = i18n.language.startsWith('ar') ? 'ar' : 'en';

  const ask = async (text: string) => {
    if (!view || pending || text.trim() === '') return;
    add({ kind: 'user', text: text.trim().slice(0, 2000) });
    setPending(true);
    try {
      const context = buildCoachContext(view);
      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const response = await apiRequest('/ai/coach', {
          method: 'POST',
          schema: coachResponseSchema,
          body: {
            locale,
            currency: view.main,
            context,
            messages: toApiMessages(useConversation.getState().turns),
          },
        });
        if (response.type === 'message') {
          add({
            kind: 'assistant',
            text: response.text,
            refusal: response.refusal,
            source: response.source,
          });
          return;
        }
        if (round === MAX_TOOL_ROUNDS) break;
        const outcome = runTool(response.toolCall, view);
        add({
          kind: 'tool',
          call: response.toolCall,
          result: outcome.result,
          display: outcome.ok ? outcome.display : null,
        });
      }
      add({ kind: 'error', reason: 'steps' });
    } catch (error) {
      add({
        kind: 'error',
        reason: error instanceof ApiError && error.isQuota ? 'quota' : 'failed',
      });
    } finally {
      setPending(false);
      void client.invalidateQueries({ queryKey: queryKeys.me(uid) });
    }
  };

  return { turns, ask, clear, pending };
}
