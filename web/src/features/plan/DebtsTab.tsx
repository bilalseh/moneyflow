import { compareStrategies, getCurrency, type Debt, type PayoffResult } from '@moneyflow/shared';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router';

import { ChartFrame } from '@/components/charts/ChartFrame';
import { TimeChart } from '@/components/charts/TimeChart';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, EmptyState } from '@/components/ui/Feedback';
import { Slider } from '@/components/ui/Slider';
import { useCollection, useDeleteDoc } from '@/data/hooks';
import { DebtDialog } from '@/features/plan/DebtDialog';
import type { PlanContext } from '@/features/plan/PlanLayout';
import { useFormatters } from '@/lib/format';

function StrategyCard({
  result,
  cheapest,
  names,
  currency,
}: {
  result: PayoffResult;
  cheapest: boolean;
  names: Map<string, string>;
  currency: Debt['currency'];
}) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  return (
    <Card className={cheapest ? 'border-brand ring-brand/20 ring-2' : ''}>
      <CardHeader
        as="h3"
        title={t(`plan.debts.${result.strategy}.name`)}
        description={t(`plan.debts.${result.strategy}.description`)}
        action={
          cheapest ? (
            <Badge tone="brand">
              <Icon name="check" className="size-3.5" />
              {t('plan.debts.cheapest')}
            </Badge>
          ) : undefined
        }
      />
      {result.feasible ? (
        <dl className="tabular grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-ink-muted text-xs">{t('plan.debts.totalInterest')}</dt>
            <dd className="font-bold">{fmt.money(result.totalInterest, currency)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted text-xs">{t('plan.debts.debtFree')}</dt>
            <dd className="font-bold">
              {result.payoffMonth ? fmt.month(result.payoffMonth, 'short') : '-'}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted text-xs">{t('plan.debts.duration')}</dt>
            <dd className="font-bold">{t('common.months', { count: result.months })}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-negative text-sm font-medium">{t('plan.debts.infeasible')}</p>
      )}
      <ol className="text-ink-muted mt-3 list-inside list-decimal text-sm">
        {result.order.map((id) => (
          <li key={id}>{names.get(id)}</li>
        ))}
      </ol>
    </Card>
  );
}

export function DebtsTab() {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const { view } = useOutletContext<PlanContext>();
  const debts = useCollection('debts');
  const remove = useDeleteDoc('debts');
  const [editing, setEditing] = useState<Debt | 'new' | null>(null);
  const step = 10 ** getCurrency(view.main).minorUnits * (view.main === 'LBP' ? 10000 : 10);
  // Start with a modest extra payment: with none, both orders usually cost the same.
  const [extra, setExtra] = useState(step * 10);
  const maxExtra = Math.max(step * 10, Math.round((view.incomeBasis * 0.3) / step) * step);
  const comparison = useMemo(() => compareStrategies(view.debts, extra, view.month), [view, extra]);
  const names = new Map(view.debts.map((d) => [d.id, d.name]));
  const scale = 10 ** getCurrency(view.main).minorUnits;
  const length = Math.max(comparison.avalanche.series.length, comparison.snowball.series.length);
  const rows = Array.from({ length: Math.min(length, 241) }, (_, i) => ({
    month: comparison.avalanche.series[i]?.month ?? comparison.snowball.series[i]?.month ?? '',
    avalanche: (comparison.avalanche.series[i]?.balance ?? 0) / scale,
    snowball: (comparison.snowball.series[i]?.balance ?? 0) / scale,
  }));
  const series = [
    { key: 'avalanche', label: t('plan.debts.avalanche.name'), color: 'var(--color-chart-1)' },
    {
      key: 'snowball',
      label: t('plan.debts.snowball.name'),
      color: 'var(--color-chart-2)',
      dashed: true,
    },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button
          onClick={() => {
            setEditing('new');
          }}
        >
          <Icon name="plus" className="size-4" />
          {t('plan.debts.add')}
        </Button>
      </div>
      {view.debts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icon name="card" />}
            title={t('plan.debts.empty')}
            body={t('plan.debts.emptyBody')}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <ul className="divide-line divide-y">
              {(debts.data ?? []).map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">{d.name}</p>
                    <p className="text-ink-muted tabular text-sm">
                      {fmt.money(d.balance, d.currency)} · {fmt.percent(d.aprBps / 10000, 2)} ·{' '}
                      {t('onboarding.review.minPayment', {
                        amount: fmt.money(d.minPayment, d.currency),
                      })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditing(d);
                      }}
                    >
                      {t('common.edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (window.confirm(t('plan.debts.confirmDelete', { name: d.name })))
                          remove.mutate(d.id);
                      }}
                    >
                      {t('common.delete')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-line mt-4 border-t pt-4">
              <Slider
                label={t('plan.debts.extra')}
                value={extra}
                min={0}
                max={maxExtra}
                step={step}
                onChange={setExtra}
                valueText={fmt.money(extra, view.main)}
                hint={t('plan.debts.extraHint', {
                  amount: fmt.money(view.debtMinimums, view.main),
                })}
              />
            </div>
          </Card>
          {comparison.interestSaved > 0 && comparison.avalanche.feasible && (
            <p
              role="status"
              className="bg-brand-soft text-brand-strong rounded-lg p-3 text-sm font-medium"
            >
              {t('plan.debts.saving', { amount: fmt.money(comparison.interestSaved, view.main) })}
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <StrategyCard
              result={comparison.avalanche}
              cheapest={comparison.cheapest === 'avalanche'}
              names={names}
              currency={view.main}
            />
            <StrategyCard
              result={comparison.snowball}
              cheapest={comparison.cheapest === 'snowball'}
              names={names}
              currency={view.main}
            />
          </div>
          <ChartFrame
            title={t('plan.debts.chartTitle')}
            description={t('plan.debts.chartDescription')}
            series={series}
            table={{
              headers: [t('common.month'), series[0]?.label ?? '', series[1]?.label ?? ''],
              rows: rows
                .filter((_, i) => i % 3 === 0)
                .map((r) => [
                  fmt.month(r.month, 'short'),
                  fmt.money(Math.round(r.avalanche * scale), view.main),
                  fmt.money(Math.round(r.snowball * scale), view.main),
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
            />
          </ChartFrame>
        </div>
      )}
      {editing !== null && (
        <DebtDialog
          debt={editing === 'new' ? null : editing}
          currency={view.main}
          onClose={() => {
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
