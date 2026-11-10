import {
  compareScenario,
  getCurrency,
  isSpendingCategory,
  type CategoryId,
  type Scenario,
} from '@moneyflow/shared';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router';

import { ChartFrame } from '@/components/charts/ChartFrame';
import { TimeChart } from '@/components/charts/TimeChart';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Field, SelectInput } from '@/components/ui/Field';
import { Slider } from '@/components/ui/Slider';
import { ScenarioResults } from '@/features/plan/ScenarioResults';
import type { PlanContext } from '@/features/plan/PlanLayout';
import { useFormatters } from '@/lib/format';

const HORIZON = 24;

export function SimulatorTab() {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const { view } = useOutletContext<PlanContext>();
  const income = view.baseline.monthlyIncome;
  const unit = 10 ** getCurrency(view.main).minorUnits;
  // Slider step: about 1% of income, rounded to a whole unit of currency.
  const step = Math.max(unit, Math.round(income / 100 / unit) * unit);

  const categories = (Object.entries(view.baseline.spending) as [CategoryId, number][])
    .filter(([id, v]) => isSpendingCategory(id) && v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  const [extra, setExtra] = useState(0);
  const [cutCategory, setCutCategory] = useState<CategoryId | ''>(
    categories.find((c) => c === 'dining') ?? categories[0] ?? '',
  );
  const [cutPercent, setCutPercent] = useState(0);
  const [incomeChange, setIncomeChange] = useState(0);

  const scenario: Scenario = {
    extraSavingsPerMonth: extra,
    categoryCuts:
      cutCategory !== '' && cutPercent > 0
        ? [{ categoryId: cutCategory, percent: cutPercent }]
        : [],
    incomeChangePerMonth: incomeChange,
  };
  const comparison = useMemo(
    () => compareScenario(view.baseline, scenario, HORIZON),
    [view.baseline, extra, cutCategory, cutPercent, incomeChange],
  ); // eslint-disable-line react-hooks/exhaustive-deps -- scenario is derived from these

  const series = [
    {
      key: 'base',
      label: t('plan.simulator.current'),
      color: 'var(--color-chart-1)',
      dashed: true,
    },
    { key: 'scenario', label: t('plan.simulator.scenario'), color: 'var(--color-chart-2)' },
  ];
  const rows = comparison.base.savingsSeries.map((p, i) => ({
    month: p.month,
    base: p.balance / unit,
    scenario: (comparison.scenario.savingsSeries[i]?.balance ?? 0) / unit,
  }));
  const reset = () => {
    setExtra(0);
    setCutPercent(0);
    setIncomeChange(0);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <Card className="h-fit lg:sticky lg:top-20">
        <CardHeader
          title={t('plan.simulator.controls')}
          description={t('plan.simulator.controlsHint')}
        />
        <div className="space-y-5">
          <Slider
            label={t('plan.simulator.saveMore')}
            value={extra}
            min={0}
            max={step * 30}
            step={step}
            onChange={setExtra}
            valueText={fmt.money(extra, view.main)}
            hint={t('plan.simulator.saveMoreHint')}
          />
          <div className="space-y-3">
            <Field label={t('plan.simulator.cutCategory')}>
              {({ id }) => (
                <SelectInput
                  id={id}
                  value={cutCategory}
                  onChange={(e) => {
                    setCutCategory(e.target.value as CategoryId);
                  }}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {t(`categories.${c}`)}
                    </option>
                  ))}
                </SelectInput>
              )}
            </Field>
            <Slider
              label={t('plan.simulator.cutBy')}
              value={cutPercent}
              min={0}
              max={100}
              step={5}
              onChange={setCutPercent}
              valueText={fmt.percent(cutPercent / 100)}
            />
          </div>
          <Slider
            label={t('plan.simulator.incomeChange')}
            value={incomeChange}
            min={-step * 50}
            max={step * 50}
            step={step}
            onChange={setIncomeChange}
            valueText={fmt.money(incomeChange, view.main, { signed: true })}
          />
          <Button variant="secondary" className="w-full" onClick={reset}>
            {t('plan.simulator.reset')}
          </Button>
        </div>
      </Card>
      <div className="space-y-6">
        <ScenarioResults comparison={comparison} view={view} />
        <ChartFrame
          title={t('plan.simulator.chartTitle', { months: HORIZON })}
          description={t('plan.simulator.chartDescription')}
          series={series}
          table={{
            headers: [t('common.month'), series[0]?.label ?? '', series[1]?.label ?? ''],
            rows: comparison.base.savingsSeries
              .filter((_, i) => i % 3 === 0)
              .map((p, i) => [
                fmt.month(p.month, 'short'),
                fmt.money(p.balance, view.main),
                fmt.money(comparison.scenario.savingsSeries[i * 3]?.balance ?? 0, view.main),
              ]),
          }}
        >
          <TimeChart
            kind="line"
            data={rows}
            xKey="month"
            series={series}
            formatX={(m) => fmt.month(m, 'short')}
            formatY={(v) => fmt.money(v * unit, view.main, { compact: true })}
            formatValue={(v) => fmt.money(Math.round(v * unit), view.main)}
            height={260}
          />
        </ChartFrame>
        <p className="text-ink-muted text-xs">{t('plan.simulator.note')}</p>
      </div>
    </div>
  );
}
