import {
  addMonths,
  checkinResponseSchema,
  currentMonth,
  type Checkin,
  type Locale,
} from '@moneyflow/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/Feedback';
import { SelectInput } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Page';
import { PageLoader } from '@/components/ui/PageLoader';
import { toast } from '@/components/ui/toast';
import { useCollection, useSaveDoc } from '@/data/hooks';
import { useFinanceView } from '@/data/useFinanceView';
import { buildCheckinRequest } from '@/features/checkin/buildCheckin';
import { CheckinResult } from '@/features/checkin/CheckinResult';
import { ApiError, apiRequest } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { nowIso } from '@/lib/ids';

export function CheckinPage() {
  const { t, i18n } = useTranslation();
  const fmt = useFormatters();
  const { view, isLoading, error, refetch } = useFinanceView();
  const checkins = useCollection('checkins');
  const budgets = useCollection('budgets');
  const scores = useCollection('scores');
  const save = useSaveDoc('checkins', (c) => c.month);
  const [month, setMonth] = useState(addMonths(currentMonth(), -1));
  const [running, setRunning] = useState(false);

  if (isLoading || checkins.isLoading) return <PageLoader />;
  if (error || !view) return <ErrorState error={error} onRetry={refetch} />;

  const locale: Locale = i18n.language.startsWith('ar') ? 'ar' : 'en';
  const months = Array.from({ length: 6 }, (_, i) => addMonths(currentMonth(), -i));
  const existing = checkins.data?.find((c) => c.month === month) ?? null;

  const run = async () => {
    setRunning(true);
    try {
      const request = buildCheckinRequest(
        view,
        month,
        budgets.data ?? [],
        scores.data ?? [],
        locale,
      );
      const response = await apiRequest('/ai/checkin', {
        method: 'POST',
        body: request,
        schema: checkinResponseSchema,
      });
      const checkin: Checkin = {
        month,
        summary: response.summary,
        highlights: response.highlights,
        questions: response.questions.map((q) => ({ ...q, answer: '' })),
        adjustments: response.adjustments.map((a) => ({ ...a, status: 'pending' })),
        source: response.source,
        locale,
        createdAt: nowIso(),
      };
      save.mutate(checkin);
    } catch (e) {
      toast.error(e instanceof ApiError && e.isQuota ? t('checkin.quota') : t('checkin.failed'));
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <PageHeader title={t('checkin.title')} description={t('checkin.description')} />
      <Card className="mb-6 flex flex-wrap items-center gap-3">
        <label htmlFor="checkin-month" className="text-sm font-medium">
          {t('checkin.month')}
        </label>
        <SelectInput
          id="checkin-month"
          className="w-auto"
          value={month}
          onChange={(e) => {
            setMonth(e.target.value);
          }}
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {fmt.month(m)}
              {checkins.data?.some((c) => c.month === m) ? ` · ${t('checkin.done')}` : ''}
            </option>
          ))}
        </SelectInput>
        {existing && (
          <Button
            variant="ghost"
            size="sm"
            className="ms-auto"
            loading={running}
            onClick={() => void run()}
          >
            {t('checkin.redo')}
          </Button>
        )}
      </Card>
      {existing ? (
        <CheckinResult checkin={existing} view={view} budgets={budgets.data ?? []} />
      ) : (
        <Card>
          <EmptyState
            icon={<Icon name="calendar" />}
            title={t('checkin.startTitle', { month: fmt.month(month) })}
            body={t('checkin.startBody')}
            action={
              <Button loading={running} onClick={() => void run()}>
                <Icon name="sparkles" className="size-4" />
                {t('checkin.start')}
              </Button>
            }
          />
          <CardHeader as="h3" title={t('checkin.whatHappens')} />
          <ul className="text-ink-muted list-inside list-disc space-y-1 text-sm">
            <li>{t('checkin.step1')}</li>
            <li>{t('checkin.step2')}</li>
            <li>{t('checkin.step3')}</li>
          </ul>
        </Card>
      )}
    </>
  );
}
