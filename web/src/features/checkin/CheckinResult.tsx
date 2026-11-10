import { addMonths, summarizeMonth, type Budget, type Checkin } from '@moneyflow/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Feedback';
import { toast } from '@/components/ui/toast';
import { useSaveDoc } from '@/data/hooks';
import type { FinanceView } from '@/data/financeView';
import { applyAdjustment } from '@/features/checkin/buildCheckin';
import { useFormatters } from '@/lib/format';
import { nowIso } from '@/lib/ids';

/** A saved check-in: summary, questions to answer, and budget changes to accept or dismiss. */
export function CheckinResult({
  checkin,
  view,
  budgets,
}: {
  checkin: Checkin;
  view: FinanceView;
  budgets: Budget[];
}) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const saveCheckin = useSaveDoc('checkins', (c) => c.month);
  const saveBudget = useSaveDoc('budgets', (b) => b.month);
  const [answers, setAnswers] = useState(() =>
    Object.fromEntries(checkin.questions.map((q) => [q.id, q.answer])),
  );
  const nextMonth = addMonths(checkin.month, 1);

  const decide = (id: string, status: 'accepted' | 'dismissed') => {
    const adjustment = checkin.adjustments.find((a) => a.id === id);
    if (!adjustment) return;
    if (status === 'accepted') {
      const actual = summarizeMonth(view.ledger, checkin.month).byCategory;
      const budget = applyAdjustment(checkin, adjustment, budgets, actual, nowIso());
      if (!budget) {
        toast.error(t('checkin.noBudget'));
        return;
      }
      saveBudget.mutate(budget);
      const after = budget.lines.find((l) => l.categoryId === adjustment.categoryId)?.planned ?? 0;
      toast.success(
        t('checkin.applied', {
          category: t(`categories.${adjustment.categoryId}`),
          month: fmt.month(nextMonth),
          amount: fmt.money(after, view.main),
        }),
      );
    }
    saveCheckin.mutate({
      ...checkin,
      adjustments: checkin.adjustments.map((a) => (a.id === id ? { ...a, status } : a)),
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader
            title={t('checkin.summaryTitle', { month: fmt.month(checkin.month) })}
            action={
              <Badge tone={checkin.source === 'ai' ? 'brand' : 'neutral'}>
                <Icon name="sparkles" className="size-3.5" />
                {checkin.source === 'ai' ? t('checkin.byAi') : t('checkin.byRules')}
              </Badge>
            }
          />
          <p className="whitespace-pre-line leading-relaxed">{checkin.summary}</p>
          {checkin.highlights.length > 0 && (
            <ul className="mt-4 space-y-2">
              {checkin.highlights.map((h, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <Icon name="check" className="text-brand mt-0.5 size-4" />
                  {h}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader
            title={t('checkin.questionsTitle')}
            description={t('checkin.questionsHint')}
          />
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveCheckin.mutate(
                {
                  ...checkin,
                  questions: checkin.questions.map((q) => ({
                    ...q,
                    answer: (answers[q.id] ?? '').slice(0, 500),
                  })),
                },
                {
                  onSuccess: () => {
                    toast.success(t('common.saved'));
                  },
                },
              );
            }}
          >
            {checkin.questions.map((q) => (
              <div key={q.id}>
                <label htmlFor={`q-${q.id}`} className="mb-1.5 block text-sm font-medium">
                  {q.text}
                </label>
                <textarea
                  id={`q-${q.id}`}
                  rows={2}
                  maxLength={500}
                  className="border-line bg-surface-raised focus:border-brand w-full rounded-lg border px-3 py-2 text-sm"
                  value={answers[q.id] ?? ''}
                  onChange={(e) => {
                    setAnswers({ ...answers, [q.id]: e.target.value });
                  }}
                />
              </div>
            ))}
            <Button type="submit" variant="secondary" loading={saveCheckin.isPending}>
              {t('checkin.saveAnswers')}
            </Button>
          </form>
        </Card>
      </div>
      <Card className="h-fit">
        <CardHeader
          title={t('checkin.adjustmentsTitle')}
          description={t('checkin.adjustmentsHint', { month: fmt.month(nextMonth) })}
        />
        {checkin.adjustments.length === 0 ? (
          <p className="text-ink-muted text-sm">{t('checkin.noAdjustments')}</p>
        ) : (
          <ul className="space-y-3">
            {checkin.adjustments.map((a) => (
              <li key={a.id} className="border-line rounded-lg border p-3">
                <p className="font-medium">
                  {t(a.changePercent < 0 ? 'checkin.lower' : 'checkin.raise', {
                    category: t(`categories.${a.categoryId}`),
                    percent: fmt.percent(Math.abs(a.changePercent) / 100),
                  })}
                </p>
                <p className="text-ink-muted mt-1 text-sm">{a.reason}</p>
                {a.status === 'pending' ? (
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        decide(a.id, 'accepted');
                      }}
                    >
                      {t('checkin.accept')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        decide(a.id, 'dismissed');
                      }}
                    >
                      {t('checkin.dismiss')}
                    </Button>
                  </div>
                ) : (
                  <Badge tone={a.status === 'accepted' ? 'positive' : 'neutral'} className="mt-3">
                    {t(`checkin.status.${a.status}`)}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
