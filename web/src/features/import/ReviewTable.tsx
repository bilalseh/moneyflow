import {
  categorizeResponseSchema,
  EXPENSE_CATEGORY_IDS,
  type CategoryId,
  type Locale,
} from '@moneyflow/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Feedback';
import { toast } from '@/components/ui/toast';
import { applySuggestions, type ReviewRow } from '@/features/import/buildImport';
import { ApiError, apiRequest } from '@/lib/api';
import { useFormatters } from '@/lib/format';

const BATCH = 100;

export function ReviewTable({
  rows,
  onChange,
  locale,
}: {
  rows: ReviewRow[];
  onChange: (rows: ReviewRow[]) => void;
  locale: Locale;
}) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const [suggesting, setSuggesting] = useState(false);
  const duplicates = rows.filter((r) => r.duplicate !== null).length;
  const update = (index: number, patch: Partial<ReviewRow>) => {
    onChange(rows.map((r) => (r.rowIndex === index ? { ...r, ...patch } : r)));
  };

  /** Ask the API for categories in batches; keyword rules stay in place for anything it cannot answer. */
  const suggest = async () => {
    setSuggesting(true);
    let next = rows;
    try {
      const expenses = rows.filter(
        (r) => r.type === 'expense' && r.include && r.categorySource !== 'user',
      );
      for (let i = 0; i < expenses.length; i += BATCH) {
        const chunk = expenses.slice(i, i + BATCH);
        const response = await apiRequest('/ai/categorize', {
          method: 'POST',
          schema: categorizeResponseSchema,
          body: {
            locale,
            categories: [...EXPENSE_CATEGORY_IDS],
            transactions: chunk.map((r) => ({
              id: String(r.rowIndex),
              description: r.description || '-',
              amount: r.amount,
              currency: r.currency,
              type: r.type,
            })),
          },
        });
        next = applySuggestions(next, response.suggestions);
      }
      onChange(next);
      toast.success(t('import.aiDone'));
    } catch (error) {
      onChange(next);
      toast.error(
        error instanceof ApiError && error.isQuota
          ? t('import.aiQuota')
          : t('import.aiUnavailable'),
      );
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title={t('import.reviewTitle', { count: rows.length })}
        description={
          duplicates > 0
            ? t('import.duplicatesFound', { count: duplicates })
            : t('import.noDuplicates')
        }
        action={
          <Button size="sm" variant="secondary" loading={suggesting} onClick={() => void suggest()}>
            <Icon name="sparkles" className="size-4" />
            {t('import.suggest')}
          </Button>
        }
      />
      <div className="max-h-[60vh] overflow-auto">
        <table className="tabular w-full text-sm">
          <caption className="sr-only">{t('import.reviewCaption')}</caption>
          <thead className="bg-surface-raised sticky top-0">
            <tr className="text-ink-muted border-line border-b">
              <th scope="col" className="py-2 pe-2 text-start font-medium">
                {t('import.include')}
              </th>
              <th scope="col" className="py-2 pe-2 text-start font-medium">
                {t('import.columns.date')}
              </th>
              <th scope="col" className="py-2 pe-2 text-start font-medium">
                {t('import.columns.description')}
              </th>
              <th scope="col" className="py-2 pe-2 text-end font-medium">
                {t('import.columns.amount')}
              </th>
              <th scope="col" className="py-2 text-start font-medium">
                {t('common.category')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.rowIndex}
                className={`border-line border-b last:border-0 ${r.include ? '' : 'opacity-60'}`}
              >
                <td className="py-2 pe-2">
                  <input
                    type="checkbox"
                    className="accent-brand size-4"
                    checked={r.include}
                    aria-label={t('import.includeRow', { description: r.description })}
                    onChange={(e) => {
                      update(r.rowIndex, { include: e.target.checked });
                    }}
                  />
                </td>
                <td className="whitespace-nowrap py-2 pe-2">{fmt.date(r.date)}</td>
                <td className="max-w-56 py-2 pe-2">
                  <span className="block truncate">{r.description}</span>
                  {r.duplicate && (
                    <Badge tone="warning" className="mt-0.5">
                      {t(`import.duplicate.${r.duplicate}`)}
                    </Badge>
                  )}
                </td>
                <td
                  className={`whitespace-nowrap py-2 pe-2 text-end ${r.type === 'income' ? 'text-positive' : ''}`}
                >
                  {fmt.money(r.type === 'income' ? r.amount : -r.amount, r.currency, {
                    signed: true,
                  })}
                </td>
                <td className="py-2">
                  {r.type === 'income' ? (
                    <span className="text-ink-muted">{t('categories.income')}</span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <select
                        aria-label={t('import.categoryFor', { description: r.description })}
                        className="border-line bg-surface-raised rounded-md border px-2 py-1 text-sm"
                        value={r.categoryId}
                        onChange={(e) => {
                          update(r.rowIndex, {
                            categoryId: e.target.value as CategoryId,
                            categorySource: 'user',
                          });
                        }}
                      >
                        {EXPENSE_CATEGORY_IDS.map((c) => (
                          <option key={c} value={c}>
                            {t(`categories.${c}`)}
                          </option>
                        ))}
                      </select>
                      {r.categorySource === 'ai' && (
                        <Badge tone="brand" className="whitespace-nowrap">
                          {t('import.aiBadge', { percent: fmt.percent(r.aiConfidence ?? 0) })}
                        </Badge>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
