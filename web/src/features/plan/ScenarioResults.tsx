import type { ScenarioComparison } from '@moneyflow/shared';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';
import { Card, CardHeader } from '@/components/ui/Card';
import type { FinanceView } from '@/data/financeView';
import { useFormatters } from '@/lib/format';

function Delta({
  label,
  before,
  after,
  delta,
  positiveIsGood = true,
}: {
  label: string;
  before: string;
  after: string;
  delta: number;
  positiveIsGood?: boolean;
}) {
  const { t } = useTranslation();
  const good = positiveIsGood ? delta > 0 : delta < 0;
  const tone = delta === 0 ? 'text-ink-muted' : good ? 'text-positive' : 'text-negative';
  return (
    <div className="rounded-card border-line bg-surface-raised border p-4">
      <p className="text-ink-muted text-sm">{label}</p>
      <p className="tabular mt-1 text-2xl font-bold">{after}</p>
      <p className={`tabular mt-1 flex items-center gap-1 text-xs font-medium ${tone}`}>
        {delta !== 0 && <Icon name={good ? 'check' : 'alert'} className="size-3.5" />}
        {delta === 0 ? t('plan.simulator.noChange') : t('plan.simulator.from', { before })}
      </p>
    </div>
  );
}

/** Before/after numbers and goal dates for the current what-if scenario. */
export function ScenarioResults({
  comparison,
  view,
}: {
  comparison: ScenarioComparison;
  view: FinanceView;
}) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const { base, scenario, delta } = comparison;
  const last = (s: typeof base) => s.savingsSeries[s.savingsSeries.length - 1]?.balance ?? 0;

  return (
    <>
      <div aria-live="polite" className="grid gap-3 sm:grid-cols-3">
        <Delta
          label={t('plan.simulator.surplus')}
          before={fmt.money(base.monthlySurplus, view.main)}
          after={fmt.money(scenario.monthlySurplus, view.main)}
          delta={delta.monthlySurplus}
        />
        <Delta
          label={t('plan.simulator.score')}
          before={String(base.healthScore)}
          after={`${String(scenario.healthScore)} / 100`}
          delta={delta.healthScore}
        />
        <Delta
          label={t('plan.simulator.savingsAt')}
          before={fmt.money(last(base), view.main)}
          after={fmt.money(last(scenario), view.main)}
          delta={delta.savingsAtHorizon}
        />
      </div>
      {scenario.extraSavingsShortfall > 0 && (
        <p role="status" className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          {t('plan.simulator.shortfall', {
            amount: fmt.money(scenario.extraSavingsShortfall, view.main),
          })}
        </p>
      )}
      {scenario.freeCashFlow < 0 && (
        <p role="status" className="bg-negative-soft text-negative rounded-lg p-3 text-sm">
          {t('plan.simulator.drawdown', { amount: fmt.money(-scenario.freeCashFlow, view.main) })}
        </p>
      )}
      {view.goals.length > 0 && (
        <Card>
          <CardHeader
            title={t('plan.simulator.goalsTitle')}
            description={t('plan.simulator.goalsDescription', {
              amount: fmt.money(scenario.goalContribution, view.main),
            })}
          />
          <ul className="divide-line divide-y text-sm">
            {base.goals.map((g, i) => {
              const next = scenario.goals[i];
              const name = view.goals.find((x) => x.id === g.id)?.name ?? '';
              const shift = delta.goalMonths[i]?.months ?? null;
              return (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-medium">{name}</span>
                  <span className="tabular text-ink-muted">
                    {g.projectedMonth ? fmt.month(g.projectedMonth, 'short') : t('common.never')}
                    {` ${t('plan.simulator.arrow')} `}
                    <span className="text-ink font-semibold">
                      {next?.projectedMonth
                        ? fmt.month(next.projectedMonth, 'short')
                        : t('common.never')}
                    </span>
                    {shift !== null && shift !== 0 && (
                      <span className={shift > 0 ? 'text-positive ms-2' : 'text-negative ms-2'}>
                        {shift > 0
                          ? t('plan.simulator.earlier', { count: shift })
                          : t('plan.simulator.later', { count: -shift })}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
