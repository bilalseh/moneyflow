import { useTranslation } from 'react-i18next';

import { ChartFrame } from '@/components/charts/ChartFrame';
import { TimeChart } from '@/components/charts/TimeChart';
import { getCurrency } from '@moneyflow/shared';
import { useCollection } from '@/data/hooks';
import type { FinanceView } from '@/data/financeView';
import { useFormatters } from '@/lib/format';

const C1 = 'var(--color-chart-1)';
const C2 = 'var(--color-chart-2)';

function useMoneyAxis(view: FinanceView) {
  const fmt = useFormatters();
  const scale = 10 ** getCurrency(view.main).minorUnits;
  return {
    axis: (v: number) => fmt.money(v * scale, view.main, { compact: true }),
    exact: (v: number) => fmt.money(Math.round(v * scale), view.main),
    scale,
  };
}

export function TrendChart({ view }: { view: FinanceView }) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const money = useMoneyAxis(view);
  const series = [
    { key: 'income', label: t('dashboard.trend.income'), color: C1 },
    { key: 'spending', label: t('dashboard.trend.spending'), color: C2 },
  ];
  const data = view.trend.map((m) => ({
    month: m.month,
    income: m.income / money.scale,
    spending: m.spending / money.scale,
  }));
  return (
    <ChartFrame
      title={t('dashboard.trend.title')}
      description={t('dashboard.trend.description')}
      series={series}
      table={{
        headers: [t('common.month'), series[0]?.label ?? '', series[1]?.label ?? ''],
        rows: view.trend.map((m) => [
          fmt.month(m.month, 'short'),
          fmt.money(m.income, view.main),
          fmt.money(m.spending, view.main),
        ]),
      }}
    >
      <TimeChart
        kind="bar"
        data={data}
        xKey="month"
        series={series}
        formatX={(m) => fmt.month(m, 'short')}
        formatY={money.axis}
        formatValue={money.exact}
      />
    </ChartFrame>
  );
}

export function SavingsRateChart({ view }: { view: FinanceView }) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const series = [{ key: 'rate', label: t('dashboard.savingsRate.series'), color: C1 }];
  const data = view.trend.map((m) => ({
    month: m.month,
    rate: m.savingsRate === null ? null : Math.round(m.savingsRate * 1000) / 10,
  }));
  return (
    <ChartFrame
      title={t('dashboard.savingsRate.title')}
      description={t('dashboard.savingsRate.description')}
      table={{
        headers: [t('common.month'), series[0]?.label ?? ''],
        rows: view.trend.map((m) => [fmt.month(m.month, 'short'), fmt.percent(m.savingsRate, 1)]),
      }}
    >
      <TimeChart
        kind="line"
        data={data}
        xKey="month"
        series={series}
        formatX={(m) => fmt.month(m, 'short')}
        formatY={(v) => fmt.percent(v / 100)}
        formatValue={(v) => fmt.percent(v / 100, 1)}
        reference={{ y: 20, label: t('dashboard.savingsRate.target') }}
        height={200}
      />
    </ChartFrame>
  );
}

export function NetWorthChart({ view }: { view: FinanceView }) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const money = useMoneyAxis(view);
  const scores = useCollection('scores');
  const history = (scores.data ?? [])
    .filter((s) => s.month < view.month)
    .map((s) => ({ month: s.month, netWorth: s.netWorth }));
  const points = [...history, { month: view.month, netWorth: view.netWorth }].sort((a, b) =>
    a.month.localeCompare(b.month),
  );
  const series = [{ key: 'netWorth', label: t('dashboard.netWorth.series'), color: C1 }];
  return (
    <ChartFrame
      title={t('dashboard.netWorth.title')}
      description={t('dashboard.netWorth.description')}
      table={{
        headers: [t('common.month'), series[0]?.label ?? ''],
        rows: points.map((p) => [fmt.month(p.month, 'short'), fmt.money(p.netWorth, view.main)]),
      }}
    >
      <TimeChart
        kind="line"
        data={points.map((p) => ({ month: p.month, netWorth: p.netWorth / money.scale }))}
        xKey="month"
        series={series}
        formatX={(m) => fmt.month(m, 'short')}
        formatY={money.axis}
        formatValue={money.exact}
        height={200}
      />
    </ChartFrame>
  );
}
