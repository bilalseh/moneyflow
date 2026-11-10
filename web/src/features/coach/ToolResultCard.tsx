import type { CurrencyCode } from '@moneyflow/shared';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';
import { Badge } from '@/components/ui/Feedback';
import type { ToolDisplay } from '@/features/coach/tools';
import { useFormatters } from '@/lib/format';

/** The numbers a tool computed, shown as a card so the person sees the math came from code. */
export function ToolResultCard({
  display,
  currency,
}: {
  display: ToolDisplay;
  currency: CurrencyCode;
}) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const m = (n: number) => fmt.money(n, currency);
  const month = (v: string | null) => (v ? fmt.month(v, 'short') : t('common.never'));
  const rows: [string, string][] = [];
  let title = '';
  let badge: { tone: 'positive' | 'warning'; text: string } | null = null;

  if (display.kind === 'affordability') {
    title = t('coach.tools.affordability', {
      amount: m(display.amount),
      month: month(display.month),
    });
    badge = display.affordable
      ? { tone: 'positive', text: t('coach.tools.affordable') }
      : { tone: 'warning', text: t('coach.tools.notYet') };
    rows.push(
      [t('coach.tools.projected'), m(display.projectedBalance)],
      [t('coach.tools.after'), m(display.balanceAfter)],
      [t('coach.tools.buffer'), m(display.safetyBuffer)],
    );
    if (!display.affordable) rows.push([t('coach.tools.earliest'), month(display.earliestMonth)]);
  } else if (display.kind === 'scenario') {
    title = t('coach.tools.scenario');
    rows.push(
      [
        t('plan.simulator.surplus'),
        `${m(display.before.surplus)} ${t('plan.simulator.arrow')} ${m(display.after.surplus)}`,
      ],
      [
        t('plan.simulator.score'),
        `${String(display.before.score)} ${t('plan.simulator.arrow')} ${String(display.after.score)}`,
      ],
      [
        t('plan.simulator.savingsAt'),
        `${m(display.before.savings)} ${t('plan.simulator.arrow')} ${m(display.after.savings)}`,
      ],
    );
  } else if (display.kind === 'goal') {
    title = display.name;
    if (display.onTrack !== null)
      badge = display.onTrack
        ? { tone: 'positive', text: t('plan.goals.onTrack') }
        : { tone: 'warning', text: t('plan.goals.behind') };
    rows.push(
      [t('onboarding.goals.saved'), `${m(display.saved)} / ${m(display.target)}`],
      [t('plan.goals.projected'), month(display.projectedMonth)],
    );
    if (display.requiredMonthly !== null)
      rows.push([t('plan.goals.required'), m(display.requiredMonthly)]);
  } else {
    title = t('coach.tools.debts');
    rows.push(
      [
        t('plan.debts.avalanche.name'),
        `${m(display.avalanche.interest)} · ${month(display.avalanche.payoffMonth)}`,
      ],
      [
        t('plan.debts.snowball.name'),
        `${m(display.snowball.interest)} · ${month(display.snowball.payoffMonth)}`,
      ],
    );
  }

  return (
    <div className="border-line bg-surface-raised rounded-lg border p-3 text-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-semibold">
          <Icon name="chart" className="text-brand size-4" />
          {title}
        </p>
        {badge && <Badge tone={badge.tone}>{badge.text}</Badge>}
      </div>
      <dl className="tabular grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-muted">{k}</dt>
            <dd className="text-end font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-ink-subtle mt-2 text-xs">{t('coach.tools.computed')}</p>
    </div>
  );
}
