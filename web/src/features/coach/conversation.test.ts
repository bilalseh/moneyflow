import { toApiMessages, type Turn } from '@/features/coach/conversation';

const call = {
  id: 'c1',
  name: 'check_affordability' as const,
  args: { amountMajor: 900, month: '2027-03' },
};

describe('toApiMessages', () => {
  it('expands tool turns into a tool call followed by its result', () => {
    const turns: Turn[] = [
      { kind: 'user', text: 'Can I afford a phone?' },
      { kind: 'tool', call, result: { affordable: true }, display: null },
      { kind: 'error', reason: 'failed' },
    ];
    expect(toApiMessages(turns)).toEqual([
      { role: 'user', text: 'Can I afford a phone?' },
      { role: 'assistant', toolCall: call },
      {
        role: 'tool',
        toolResult: { id: 'c1', name: 'check_affordability', result: { affordable: true } },
      },
    ]);
  });

  it('keeps at most 24 messages and always starts with the person', () => {
    const turns: Turn[] = [];
    for (let i = 0; i < 20; i++) {
      turns.push({ kind: 'user', text: `q${String(i)}` });
      turns.push({
        kind: 'tool',
        call: { ...call, id: `c${String(i)}` },
        result: {},
        display: null,
      });
    }
    const messages = toApiMessages(turns);
    expect(messages.length).toBeLessThanOrEqual(24);
    expect(messages[0]?.role).toBe('user');
  });
});
