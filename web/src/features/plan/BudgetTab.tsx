import {
  BUDGET_CATEGORY_IDS,
  BUDGET_METHODS,
  buildBudget,
  isSpendingCategory,
  summarizeLines,
  type BudgetLine,
  type BudgetMethod,
  type CategoryAmounts,
  type CategoryId,
} from '@moneyflow/shared';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router';

import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { SelectInput } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Tabs';
import { toast } from '@/components/ui/toast';
import { useProfile, useSaveDoc, useSaveProfile } from '@/data/hooks';
import type { FinanceView } from '@/data/financeView';
import { BudgetLines } from '@/features/plan/BudgetLines';
import type { PlanContext } from '@/features/plan/PlanLayout';
import { useFormatters } from '@/lib/format';
import { nowIso } from '@/lib/ids';

/** Generate a plan for a method from the person's own numbers. */
export function generatePlan(view: FinanceView, method: BudgetMethod, income: number) {
  const history: CategoryAmounts = {};
  for (const [id, v] of Object.entries(view.spendingBasis) as [CategoryId, number][]) {
    if (isSpendingCategory(id) && view.fixedByCategory[id] === undefined && id !== 'debt')
      history[id] = v;
  }
  return buildBudget(method, {
    income,
    fixedCosts: view.fixedByCategory,
    debtMinimums: view.debtMinimums,
    goalContributions: view.budget?.lines.find((l) => l.categoryId === 'savings')?.planned ?? 0,
    history,
  });
}

export function BudgetTab() {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const { view } = useOutletContext<PlanContext>();
  const profile = useProfile();
  const saveBudget = useSaveDoc('budgets', (b) => b.month);
  const saveProfile = useSaveProfile();
  const income = view.plannedIncome > 0 ? view.plannedIncome : view.incomeBasis;

  const initialMethod: BudgetMethod =
    view.budget?.method ?? profile.data?.budgetMethod ?? 'fiftyThirtyTwenty';
  const [method, setMethod] = useState<BudgetMethod>(initialMethod);
  const [lines, setLines] = useState<BudgetLine[]>(
    () => view.budget?.lines ?? generatePlan(view, initialMethod, income).lines,
  );
  const [dirty, setDirty] = useState(view.budget?.month !== view.month);
  const summary = useMemo(() => summarizeLines(method, income, lines), [method, income, lines]);
  const unused = BUDGET_CATEGORY_IDS.filter((id) => !lines.some((l) => l.categoryId === id));

  const changeMethod = (next: BudgetMethod) => {
    if (dirty && !window.confirm(t('plan.budget.confirmRegenerate'))) return;
    setMethod(next);
    setLines(generatePlan(view, next, income).lines);
    setDirty(true);
  };

  const save = () => {
    saveBudget.mutate(
      {
        month: view.month,
        method,
        income,
        lines: lines.filter((l) => l.planned > 0),
        updatedAt: nowIso(),
      },
      {
        onSuccess: () => {
          toast.success(t('plan.budget.saved'));
          setDirty(false);
        },
        onError: () => {
          toast.error(t('common.saveFailed'));
        },
      },
    );
    if (profile.data && profile.data.budgetMethod !== method)
      saveProfile.mutate({ ...profile.data, budgetMethod: method });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader
          title={t('plan.budget.title', { month: fmt.month(view.month) })}
          description={t('plan.budget.income', { amount: fmt.money(income, view.main) })}
        />
        <div className="mb-5 space-y-2">
          <Segmented
            label={t('plan.budget.method')}
            value={method}
            onChange={changeMethod}
            options={BUDGET_METHODS.map((m) => ({ value: m, label: t(`plan.methods.${m}.name`) }))}
          />
          <p className="text-ink-muted text-sm">{t(`plan.methods.${method}.description`)}</p>
        </div>
        <BudgetLines
          lines={lines}
          currency={view.main}
          actual={view.current.byCategory}
          onChange={(next) => {
            setLines(next);
            setDirty(true);
          }}
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="add-line">
            {t('plan.budget.addLine')}
          </label>
          <SelectInput
            id="add-line"
            className="w-auto"
            value=""
            onChange={(e) => {
              if (e.target.value === '') return;
              const id = e.target.value as CategoryId;
              setLines([...lines, { categoryId: id, planned: 0 }]);
              setDirty(true);
            }}
          >
            <option value="">{t('plan.budget.addLine')}</option>
            {unused.map((id) => (
              <option key={id} value={id}>
                {t(`categories.${id}`)}
              </option>
            ))}
          </SelectInput>
          <Button
            className="ms-auto"
            onClick={save}
            loading={saveBudget.isPending}
            disabled={!dirty}
          >
            {t('plan.budget.save')}
          </Button>
        </div>
      </Card>

      <Card className="h-fit lg:sticky lg:top-20">
        <CardHeader title={t('plan.budget.summary')} />
        <dl className="tabular space-y-2 text-sm">
          {(['needs', 'wants', 'savings'] as const).map((g) => (
            <div key={g} className="flex justify-between gap-3">
              <dt className="text-ink-muted">{t(`plan.groups.${g}`)}</dt>
              <dd className="font-semibold">
                {fmt.money(summary.totals[g], view.main)}{' '}
                <span className="text-ink-subtle font-normal">
                  ({fmt.percent(income > 0 ? summary.totals[g] / income : null)})
                </span>
              </dd>
            </div>
          ))}
          <div className="border-line flex justify-between gap-3 border-t pt-2">
            <dt className="font-medium">
              {summary.unassigned >= 0
                ? t('plan.budget.leftToAssign')
                : t('plan.budget.overPlanned')}
            </dt>
            <dd
              className={
                summary.unassigned < 0
                  ? 'text-negative font-bold'
                  : summary.unassigned === 0
                    ? 'text-positive font-bold'
                    : 'font-bold'
              }
            >
              {fmt.money(Math.abs(summary.unassigned), view.main)}
            </dd>
          </div>
        </dl>
        {summary.unassigned === 0 && (
          <p className="text-positive mt-3 text-sm">{t('plan.budget.balanced')}</p>
        )}
      </Card>
    </div>
  );
}
