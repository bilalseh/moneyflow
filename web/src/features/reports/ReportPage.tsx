import {
  isSpendingCategory,
  projectGoals,
  summarizeMonth,
  type CategoryId,
} from '@moneyflow/shared';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';

import { Icon } from '@/components/Icon';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/Feedback';
import { PageLoader } from '@/components/ui/PageLoader';
import { useCollection } from '@/data/hooks';
import { useFinanceView } from '@/data/useFinanceView';
import { useFormatters } from '@/lib/format';

/**
 * Printable monthly report. "Download PDF" uses the browser's print to PDF,
 * which keeps Arabic shaping and right-to-left layout exactly as on screen.
 */
export function ReportPage() {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const { month = '' } = useParams();
  const { view, isLoading, error, refetch } = useFinanceView();
  const budgets = useCollection('budgets');
  const scores = useCollection('scores');
  if (isLoading || budgets.isLoading) return <PageLoader />;
  if (error || !view || !/^\d{4}-\d{2}$/.test(month))
    return <ErrorState error={error} onRetry={refetch} />;

  const s = summarizeMonth(view.ledger, month);
  const budget = budgets.data?.find((b) => b.month === month) ?? view.budget;
  const planned = new Map((budget?.lines ?? []).map((l) => [l.categoryId, l.planned]));
  const ids = [
    ...new Set<CategoryId>([...planned.keys(), ...(Object.keys(s.byCategory) as CategoryId[])]),
  ].filter(isSpendingCategory);
  const rows = ids
    .map((id) => ({ id, planned: planned.get(id) ?? 0, actual: s.byCategory[id] ?? 0 }))
    .sort((a, b) => b.actual - a.actual);
  const score =
    scores.data?.find((x) => x.month === month)?.score ??
    (month === view.month ? view.health.score : null);
  const goals = projectGoals(view.goals, view.goalContribution, month);
  const money = (n: number) => fmt.money(n, view.main);

  return (
    <article className="mx-auto max-w-3xl print:max-w-none">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link to="/app/settings" className="text-brand text-sm hover:underline">
          {t('report.back')}
        </Link>
        <Button
          onClick={() => {
            window.print();
          }}
        >
          <Icon name="download" className="size-4" />
          {t('report.download')}
        </Button>
      </div>
      <p className="no-print text-ink-muted mb-6 text-xs">{t('report.printHint')}</p>
      <header className="border-line mb-6 border-b pb-4">
        <p className="text-brand text-sm font-semibold">{t('app.name')}</p>
        <h1 className="text-3xl font-bold">{t('report.title', { month: fmt.month(month) })}</h1>
        <p className="text-ink-muted text-sm">
          {t('report.generated', { date: fmt.date(view.today) })} · {t('app.disclaimer')}
        </p>
      </header>
      <section className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          [t('report.income'), money(s.income)],
          [t('report.spending'), money(s.spending)],
          [t('report.savingsRate'), fmt.percent(s.savingsRate, 1)],
          [t('health.scoreLabel'), score === null ? '-' : `${String(score)} / 100`],
        ].map(([label, value]) => (
          <div key={label} className="border-line rounded-lg border p-3">
            <p className="text-ink-muted text-xs">{label}</p>
            <p className="tabular text-lg font-bold">{value}</p>
          </div>
        ))}
      </section>
      <section className="mb-6 break-inside-avoid">
        <h2 className="mb-2 font-semibold">{t('report.byCategory')}</h2>
        <table className="tabular w-full text-sm">
          <thead>
            <tr className="border-line text-ink-muted border-b">
              <th className="py-1.5 text-start font-medium">{t('common.category')}</th>
              <th className="py-1.5 text-end font-medium">{t('dashboard.budget.planned')}</th>
              <th className="py-1.5 text-end font-medium">{t('dashboard.budget.actual')}</th>
              <th className="py-1.5 text-end font-medium">{t('report.difference')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-line border-b">
                <td className="py-1.5">{t(`categories.${r.id}`)}</td>
                <td className="py-1.5 text-end">{money(r.planned)}</td>
                <td className="py-1.5 text-end">{money(r.actual)}</td>
                <td className={`py-1.5 text-end ${r.actual > r.planned ? 'text-negative' : ''}`}>
                  {fmt.money(r.planned - r.actual, view.main, { signed: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {view.goals.length > 0 && (
        <section className="mb-6 break-inside-avoid">
          <h2 className="mb-2 font-semibold">{t('report.goals')}</h2>
          <ul className="space-y-1 text-sm">
            {view.goals.map((g, i) => (
              <li key={g.id} className="flex justify-between gap-3">
                <span>{g.name}</span>
                <span className="tabular text-ink-muted">
                  {money(g.savedAmount)} / {money(g.targetAmount)} ·{' '}
                  {goals[i]?.projectedMonth
                    ? fmt.month(goals[i].projectedMonth)
                    : t('common.never')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {view.debts.length > 0 && (
        <section className="break-inside-avoid">
          <h2 className="mb-2 font-semibold">{t('report.debts')}</h2>
          <ul className="space-y-1 text-sm">
            {view.debts.map((d) => (
              <li key={d.id} className="flex justify-between gap-3">
                <span>{d.name}</span>
                <span className="tabular text-ink-muted">
                  {money(d.balance)} · {fmt.percent(d.aprBps / 10000, 2)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
