import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Icon } from '@/components/Icon';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge, ErrorState } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/Page';
import { PageLoader } from '@/components/ui/PageLoader';
import { Spinner } from '@/components/ui/Spinner';
import { useFinanceView } from '@/data/useFinanceView';
import { usePlan } from '@/features/billing/usePlan';
import { ToolResultCard } from '@/features/coach/ToolResultCard';
import { useCoach } from '@/features/coach/useCoach';

const SUGGESTIONS = ['afford', 'faster', 'debts', 'cut'] as const;

export function CoachPage() {
  const { t } = useTranslation();
  const { view, isLoading, error, refetch } = useFinanceView();
  const plan = usePlan();
  const { turns, ask, clear, pending } = useCoach(view);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns.length, pending]);

  if (isLoading) return <PageLoader />;
  if (error || !view) return <ErrorState error={error} onRetry={refetch} />;
  const usage = plan.data?.usage;
  const send = (value: string) => {
    void ask(value);
    setText('');
  };

  return (
    <>
      <PageHeader
        title={t('coach.title')}
        description={t('coach.description')}
        actions={
          <>
            {usage && (
              <Badge tone={usage.used >= usage.limit ? 'warning' : 'neutral'}>
                {t('coach.usage', { used: usage.used, limit: usage.limit })}
              </Badge>
            )}
            {turns.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clear}>
                {t('coach.newChat')}
              </Button>
            )}
          </>
        }
      />
      {plan.data?.features.ai === false && (
        <p role="status" className="bg-warning-soft text-warning mb-4 rounded-lg p-3 text-sm">
          {t('coach.aiOff')}
        </p>
      )}
      <Card className="flex min-h-[60vh] flex-col p-0 sm:p-0">
        <div
          className="flex-1 space-y-4 overflow-y-auto p-4"
          role="log"
          aria-live="polite"
          aria-label={t('coach.logLabel')}
        >
          {turns.length === 0 && (
            <div className="py-6 text-center">
              <Icon name="sparkles" className="text-brand mx-auto size-8" />
              <p className="mt-2 font-semibold">{t('coach.emptyTitle')}</p>
              <p className="text-ink-muted mx-auto mt-1 max-w-md text-sm">{t('coach.emptyBody')}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="border-line hover:border-brand rounded-full border px-3 py-1.5 text-sm"
                    onClick={() => {
                      send(t(`coach.suggestions.${s}`));
                    }}
                  >
                    {t(`coach.suggestions.${s}`)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {turns.map((turn, i) => {
            if (turn.kind === 'user')
              return (
                <p
                  key={i}
                  className="bg-brand text-on-brand ms-auto max-w-[85%] whitespace-pre-line rounded-2xl rounded-ee-sm px-4 py-2"
                >
                  {turn.text}
                </p>
              );
            if (turn.kind === 'tool')
              return (
                <div key={i} className="max-w-[85%]">
                  {turn.display ? (
                    <ToolResultCard display={turn.display} currency={view.main} />
                  ) : (
                    <p className="text-ink-muted text-xs">{t('coach.toolFailed')}</p>
                  )}
                </div>
              );
            if (turn.kind === 'error')
              return (
                <p
                  key={i}
                  role="alert"
                  className="bg-negative-soft text-negative max-w-[85%] rounded-lg px-4 py-2 text-sm"
                >
                  {t(`coach.errors.${turn.reason}`)}{' '}
                  {turn.reason === 'quota' && (
                    <Link to="/pricing" className="underline">
                      {t('coach.upgrade')}
                    </Link>
                  )}
                </p>
              );
            return (
              <div
                key={i}
                className="bg-surface-sunken max-w-[85%] rounded-2xl rounded-es-sm px-4 py-2"
              >
                {turn.refusal && (
                  <Badge tone="warning" className="mb-1">
                    {t('coach.outOfScope')}
                  </Badge>
                )}
                <p className="whitespace-pre-line">{turn.text}</p>
              </div>
            );
          })}
          {pending && (
            <p className="text-ink-muted flex items-center gap-2 text-sm">
              <Spinner className="size-4" />
              {t('coach.thinking')}
            </p>
          )}
          <div ref={endRef} />
        </div>
        <form
          className="border-line flex items-end gap-2 border-t p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <label htmlFor="coach-input" className="sr-only">
            {t('coach.inputLabel')}
          </label>
          <textarea
            id="coach-input"
            rows={1}
            maxLength={2000}
            value={text}
            placeholder={t('coach.placeholder')}
            onChange={(e) => {
              setText(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(text);
              }
            }}
            className="border-line bg-surface-raised focus:border-brand max-h-40 min-h-10 flex-1 resize-none rounded-lg border px-3 py-2"
          />
          <Button
            type="submit"
            disabled={pending || text.trim() === ''}
            aria-label={t('coach.send')}
          >
            {t('coach.send')}
          </Button>
        </form>
      </Card>
      <p className="text-ink-muted mt-3 text-xs">{t('coach.disclaimer')}</p>
    </>
  );
}
