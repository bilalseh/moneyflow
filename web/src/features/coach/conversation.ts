import type { CoachMessage, ToolCall } from '@moneyflow/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ToolDisplay } from '@/features/coach/tools';

/** One visible item in the chat. Tool turns carry both the API payload and the card shown to the person. */
export type Turn =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string; refusal: boolean; source: 'ai' | 'fallback' }
  | { kind: 'tool'; call: ToolCall; result: Record<string, unknown>; display: ToolDisplay | null }
  | { kind: 'error'; reason: 'quota' | 'failed' | 'steps' };

export const MAX_API_MESSAGES = 24;

/** Turns to API messages, newest last, trimmed so the first message is from the person. */
export function toApiMessages(turns: readonly Turn[]): CoachMessage[] {
  const messages: CoachMessage[] = [];
  for (const turn of turns) {
    if (turn.kind === 'user') messages.push({ role: 'user', text: turn.text });
    else if (turn.kind === 'assistant') messages.push({ role: 'assistant', text: turn.text });
    else if (turn.kind === 'tool') {
      messages.push({ role: 'assistant', toolCall: turn.call });
      messages.push({
        role: 'tool',
        toolResult: { id: turn.call.id, name: turn.call.name, result: turn.result },
      });
    }
  }
  let start = Math.max(0, messages.length - MAX_API_MESSAGES);
  while (start < messages.length && messages[start]?.role !== 'user') start += 1;
  return messages.slice(start);
}

interface ConversationState {
  turns: Turn[];
  add: (turn: Turn) => void;
  clear: () => void;
}

export const useConversation = create<ConversationState>()(
  persist(
    (set, get) => ({
      turns: [],
      add: (turn) => {
        set({ turns: [...get().turns, turn] });
      },
      clear: () => {
        set({ turns: [] });
      },
    }),
    { name: 'moneyflow.coach', storage: createJSONStorage(() => sessionStorage), version: 1 },
  ),
);
