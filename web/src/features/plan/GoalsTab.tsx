import { addMonths, getCurrency, progressRatio, projectGoals, type Goal } from '@moneyflow/shared';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useOutletContext } from 'react-router';

import { ChartFrame } from '@/components/charts/ChartFrame';
import { TimeChart, type Row } from '@/components/charts/TimeChart';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge, EmptyState, ProgressBar } from '@/components/ui/Feedback';
import { useCollection, useDeleteDoc } from '@/data/hooks';
import { GoalDialog } from '@/features/plan/GoalDialog';
import type { PlanContext } from '@/features/plan/PlanLayout';
import { useFormatters } from '@/lib/format';

const COLORS = ['var(--color-chart-1)', 'var(--color-chart-2)', 'var(--color-chart-3)'];
/** The chart shows at most three goals (the categorical palette's all-pairs safe limit). */
const MAX_CHART_GOALS = 3;

export function GoalsTab() {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const { view } = useOutletContext<PlanContext>();
  const goals = useCollection('goals');
  const remove = useDeleteDoc('goals');
  const [editing, setEditing] = useState<Goal | 'new' | null>(null);

  const projections = useMemo(
    () => projectGoals(view.goals, view.goalContribution, view.month),
    [view],
  );
  const scale = 10 ** getCurrency(view.main).minorUnits;
  const charted = projections.slice(0, MAX_CHART_GOALS);
  const horizon = Math.min(60, Math.max(6, ...charted.map((p) => p.monthsToGoal ?? 24)));
  const rows: Row[] = Array.from({ length: horizon + 1 }, (_, i) => {
    const row: Row = { month: addMonths(view.month, i) };
    for (const p of charted) {
      // After a goal is reached its line stays flat at the target.
      const point = p.series[i] ?? p.series[p.series.length - 1];
      row[p.id] = point ? point.saved / scale : null;
    }
    return row;
  });
  const series = charted.map((p, i) => ({
    key: p.id,
    label: view.goals.find((g) => g.id === p.id)?.name ?? '',
    color: COLORS[i] ?? COLORS[0] ?? '',
  }));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-muted text-sm">
          {t('plan.goals.contribution', { amount: fmt.money(view.goalContribution, view.main) })}{' '}
          <Link to="/app/plan" className="text-brand font-medium hover:underline">
            {t('plan.goals.changeContribution')}
          </Link>
        </p>
        <Button
          onClick={() => {
            setEditing('new');
          }}
        >
          <Icon name="plus" className="size-4" />
          {t('plan.goals.add')}
        </Button>
      </div>

      {view.goals.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icon name="target" />}
            title={t('plan.goals.empty')}
            body={t('plan.goals.emptyBody')}
          />
        </Card>
      ) : (
        <>
          {charted.some((p) => p.monthsToGoal !== null && p.monthsToGoal > 0) && (
            <ChartFrame
              className="mb-6"
              title={t('plan.goals.chartTitle')}
              description={t('plan.goals.chartDescription')}
              series={series}
              table={{
                headers: [
                  t('plan.goals.goal'),
                  t('plan.goals.projected'),
                  t('plan.goals.required'),
                ],
                rows: projections.map((p) => [
                  view.goals.find((g) => g.id === p.id)?.name ?? '',
                  p.projectedMonth ? fmt.month(p.projectedMonth) : t('common.never'),
                  p.requiredMonthly === null ? '-' : fmt.money(p.requiredMonthly, view.main),
                ]),
              }}
            >
              <TimeChart
                kind="line"
                data={rows}
                xKey="month"
                series={series}
                formatX={(m) => fmt.month(m, 'short')}
                formatY={(v) => fmt.money(v * scale, view.main, { compact: true })}
                formatValue={(v) => fmt.money(Math.round(v * scale), view.main)}
                height={240}
              />
            </ChartFrame>
          )}
          <ul className="grid gap-4 md:grid-cols-2">
            {projections.map((p) => {
              const goal = goals.data?.find((g) => g.id === p.id);
              const input = view.goals.find((g) => g.id === p.id);
              if (!goal || !input) return null;
              const ratio = progressRatio(input);
              return (
                <li key={p.id}>
                  <Card className="flex h-full flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">{goal.name}</h3>
                        <p className="text-ink-muted text-xs">
                          {t('plan.goals.priorityLabel', {
                            priority: t(`priority.${goal.priority}`),
                          })}
                        </p>
                      </div>
                      {p.onTrack !== null && (
                        <Badge tone={p.onTrack ? 'positive' : 'warning'}>
                          {p.onTrack ? t('plan.goals.onTrack') : t('plan.goals.behind')}
                        </Badge>
                      )}
                    </div>
                    <ProgressBar
                      value={ratio}
                      label={t('plan.goals.progress', { name: goal.name })}
                      tone={ratio >= 1 ? 'positive' : 'brand'}
                    />
                    <p className="tabular text-sm">
                      <span className="font-semibold">
                        {fmt.money(goal.savedAmount, goal.currency)}
                      </span>
                      <span className="text-ink-muted">
                        {' '}
                        / {fmt.money(goal.targetAmount, goal.currency)} · {fmt.percent(ratio)}
                      </span>
                    </p>
                    <dl className="text-ink-muted grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt>{t('plan.goals.projected')}</dt>
                        <dd className="text-ink font-medium">
                          {p.monthsToGoal === 0
                            ? t('plan.goals.done')
                            : p.projectedMonth
                              ? fmt.month(p.projectedMonth)
                              : t('common.never')}
                        </dd>
                      </div>
                      <div>
                        <dt>{t('plan.goals.target')}</dt>
                        <dd className="text-ink font-medium">
                          {goal.targetDate ? fmt.date(goal.targetDate) : t('plan.goals.noDate')}
                        </dd>
                      </div>
                      <div>
                        <dt>{t('plan.goals.monthly')}</dt>
                        <dd className="text-ink font-medium">
                          {fmt.money(p.firstMonthContribution, view.main)}
                        </dd>
                      </div>
                      {p.requiredMonthly !== null && (
                        <div>
                          <dt>{t('plan.goals.required')}</dt>
                          <dd className="text-ink font-medium">
                            {fmt.money(p.requiredMonthly, view.main)}
                          </dd>
                        </div>
                      )}
                    </dl>
                    <div className="mt-auto flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditing(goal);
                        }}
                      >
                        {t('common.edit')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm(t('plan.goals.confirmDelete', { name: goal.name })))
                            remove.mutate(goal.id);
                        }}
                      >
                        {t('common.delete')}
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {editing !== null && (
        <GoalDialog
          open
          onClose={() => {
            setEditing(null);
          }}
          goal={editing === 'new' ? null : editing}
          currency={view.main}
        />
      )}
    </>
  );
}
