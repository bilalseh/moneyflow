import {
  CATEGORY_GROUP,
  type BudgetLine,
  type CategoryAmounts,
  type CurrencyCode,
} from '@moneyflow/shared';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { useFormatters } from '@/lib/format';

interface BudgetLinesProps {
  lines: readonly BudgetLine[];
  currency: CurrencyCode;
  actual: CategoryAmounts;
  onChange: (lines: BudgetLine[]) => void;
}

const GROUP_ORDER = { needs: 0, wants: 1, savings: 2, income: 3 } as const;

/** Editable table of budget lines, grouped needs / wants / savings, with this month's actuals beside each. */
export function BudgetLines({ lines, currency, actual, onChange }: BudgetLinesProps) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const sorted = [...lines].sort(
    (a, b) =>
      GROUP_ORDER[CATEGORY_GROUP[a.categoryId]] - GROUP_ORDER[CATEGORY_GROUP[b.categoryId]] ||
      b.planned - a.planned,
  );

  return (
    <table className="tabular w-full text-sm">
      <caption className="sr-only">{t('plan.budget.tableCaption')}</caption>
      <thead>
        <tr className="text-ink-muted border-line border-b">
          <th scope="col" className="py-2 text-start font-medium">
            {t('common.category')}
          </th>
          <th scope="col" className="hidden py-2 text-end font-medium sm:table-cell">
            {t('plan.budget.actualCol')}
          </th>
          <th scope="col" className="py-2 ps-3 text-end font-medium">
            {t('plan.budget.plannedCol')}
          </th>
          <th scope="col">
            <span className="sr-only">{t('common.remove')}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((line) => {
          const spent = actual[line.categoryId] ?? 0;
          const label = t(`categories.${line.categoryId}`);
          return (
            <tr key={line.categoryId} className="border-line border-b last:border-0">
              <th scope="row" className="py-2 text-start font-normal">
                <span className="block font-medium">{label}</span>
                <span className="text-ink-subtle text-xs">
                  {t(`plan.groups.${CATEGORY_GROUP[line.categoryId]}`)}
                </span>
              </th>
              <td
                className={`hidden py-2 text-end sm:table-cell ${spent > line.planned ? 'text-negative' : 'text-ink-muted'}`}
              >
                {fmt.money(spent, currency)}
              </td>
              <td className="w-40 py-2 ps-3">
                <MoneyInput
                  aria-label={t('plan.budget.plannedFor', { category: label })}
                  currency={currency}
                  value={line.planned}
                  onChange={(v) => {
                    onChange(
                      lines.map((l) =>
                        l.categoryId === line.categoryId ? { ...l, planned: v ?? 0 } : l,
                      ),
                    );
                  }}
                />
              </td>
              <td className="w-10 py-2 text-end">
                <button
                  type="button"
                  className="text-ink-subtle hover:text-negative rounded p-1"
                  aria-label={t('plan.budget.removeLine', { category: label })}
                  onClick={() => {
                    onChange(lines.filter((l) => l.categoryId !== line.categoryId));
                  }}
                >
                  <Icon name="trash" className="size-4" />
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
