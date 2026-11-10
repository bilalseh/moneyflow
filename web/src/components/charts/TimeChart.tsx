import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';

import type { SeriesSpec } from '@/components/charts/ChartFrame';
import { getDirection } from '@/lib/i18n';

export type Row = Record<string, string | number | null>;

interface TimeChartProps {
  kind: 'line' | 'bar';
  data: readonly Row[];
  xKey: string;
  series: readonly SeriesSpec[];
  formatX: (value: string) => string;
  formatY: (value: number) => string;
  /** Formatter for exact values in the tooltip; defaults to formatY. */
  formatValue?: (value: number) => string;
  height?: number;
  /** Optional horizontal reference line, e.g. a 20% savings-rate target. */
  reference?: { y: number; label: string };
}

function TooltipBody({
  active,
  payload,
  label,
  formatX,
  formatValue,
  series,
}: TooltipContentProps<number, string> & {
  formatX: (v: string) => string;
  formatValue: (v: number) => string;
  series: readonly SeriesSpec[];
}) {
  if (!active || payload.length === 0) return null;
  return (
    <div className="border-line bg-surface-raised rounded-lg border px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold">{formatX(String(label))}</p>
      {payload.map((p) => {
        const spec = series.find((s) => s.key === p.dataKey);
        return (
          <p key={String(p.dataKey)} className="tabular flex items-center gap-2">
            <span
              className="inline-block size-2 rounded-full"
              style={{ background: spec?.color }}
              aria-hidden="true"
            />
            <span className="text-ink-muted">{spec?.label}</span>
            <span className="ms-auto font-semibold">
              {typeof p.value === 'number' ? formatValue(p.value) : '-'}
            </span>
          </p>
        );
      })}
    </div>
  );
}

/**
 * Lines or grouped bars over time. Thin marks, recessive grid, one y-axis,
 * crosshair tooltip, and the x-axis mirrored for right-to-left reading.
 */
export function TimeChart({
  kind,
  data,
  xKey,
  series,
  formatX,
  formatY,
  formatValue,
  height = 240,
  reference,
}: TimeChartProps) {
  const { i18n } = useTranslation();
  const rtl = getDirection(i18n.language) === 'rtl';
  const axis = {
    stroke: 'var(--color-chart-axis)',
    fontSize: 11,
    tickLine: false,
    axisLine: false,
  } as const;
  const common = (
    <>
      <CartesianGrid vertical={false} stroke="var(--color-chart-grid)" />
      <XAxis dataKey={xKey} tickFormatter={formatX} reversed={rtl} minTickGap={16} {...axis} />
      <YAxis tickFormatter={formatY} orientation={rtl ? 'right' : 'left'} width={64} {...axis} />
      <Tooltip
        cursor={
          kind === 'bar'
            ? { fill: 'var(--color-surface-sunken)' }
            : { stroke: 'var(--color-chart-axis)', strokeDasharray: '3 3' }
        }
        content={(props) => (
          <TooltipBody
            {...(props as TooltipContentProps<number, string>)}
            formatX={formatX}
            formatValue={formatValue ?? formatY}
            series={series}
          />
        )}
      />
      {reference && (
        <ReferenceLine
          y={reference.y}
          stroke="var(--color-chart-axis)"
          strokeDasharray="4 4"
          label={{
            value: reference.label,
            fontSize: 10,
            fill: 'var(--color-chart-axis)',
            position: 'insideTopRight',
          }}
        />
      )}
    </>
  );

  return (
    <div style={{ height }} dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        {kind === 'line' ? (
          <LineChart data={[...data]} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            {common}
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2}
                {...(s.dashed === true ? { strokeDasharray: '5 4' } : {})}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-surface-raised)' }}
                isAnimationActive={false}
                connectNulls
              />
            ))}
          </LineChart>
        ) : (
          <BarChart
            data={[...data]}
            margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
            barGap={2}
            barCategoryGap="24%"
          >
            {common}
            {series.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                fill={s.color}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
