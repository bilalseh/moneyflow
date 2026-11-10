import {
  CURRENCIES,
  DATE_FORMATS,
  mapRows,
  type ColumnMapping,
  type CurrencyCode,
  type DateFormat,
  type ParsedCsv,
} from '@moneyflow/shared';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Field, SelectInput } from '@/components/ui/Field';
import { useFormatters } from '@/lib/format';

interface Props {
  csv: ParsedCsv;
  mapping: ColumnMapping;
  onChange: (m: ColumnMapping) => void;
  onNext: () => void;
}

/** Column mapping with a live preview of how the first rows will be read. */
export function MappingForm({ csv, mapping, onChange, onNext }: Props) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const split = mapping.amount === null;
  const preview = mapRows({ ...csv, rows: csv.rows.slice(0, 5) }, mapping).rows;
  const column = (value: number | null, set: (v: number) => void, label: string) => (
    <Field label={label}>
      {({ id }) => (
        <SelectInput
          id={id}
          value={value ?? ''}
          onChange={(e) => {
            set(Number(e.target.value));
          }}
        >
          {csv.headers.map((h, i) => (
            <option key={i} value={i}>
              {h}
            </option>
          ))}
        </SelectInput>
      )}
    </Field>
  );

  return (
    <Card>
      <CardHeader
        title={t('import.mapTitle')}
        description={t('import.mapHint', { count: csv.rows.length })}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {column(
          mapping.date,
          (v) => {
            onChange({ ...mapping, date: v });
          },
          t('import.columns.date'),
        )}
        {column(
          mapping.description,
          (v) => {
            onChange({ ...mapping, description: v });
          },
          t('import.columns.description'),
        )}
        <Field label={t('import.amountLayout')}>
          {({ id }) => (
            <SelectInput
              id={id}
              value={split ? 'split' : 'single'}
              onChange={(e) => {
                onChange(
                  e.target.value === 'split'
                    ? {
                        ...mapping,
                        amount: null,
                        debit: mapping.debit ?? 0,
                        credit: mapping.credit ?? Math.min(1, csv.headers.length - 1),
                      }
                    : { ...mapping, amount: mapping.debit ?? 0, debit: null, credit: null },
                );
              }}
            >
              <option value="single">{t('import.layouts.single')}</option>
              <option value="split">{t('import.layouts.split')}</option>
            </SelectInput>
          )}
        </Field>
        {split ? (
          <>
            {column(
              mapping.debit,
              (v) => {
                onChange({ ...mapping, debit: v });
              },
              t('import.columns.debit'),
            )}
            {column(
              mapping.credit,
              (v) => {
                onChange({ ...mapping, credit: v });
              },
              t('import.columns.credit'),
            )}
          </>
        ) : (
          <>
            {column(
              mapping.amount,
              (v) => {
                onChange({ ...mapping, amount: v });
              },
              t('import.columns.amount'),
            )}
            <Field label={t('import.sign')}>
              {({ id }) => (
                <SelectInput
                  id={id}
                  value={mapping.negativeIsExpense ? 'neg' : 'pos'}
                  onChange={(e) => {
                    onChange({ ...mapping, negativeIsExpense: e.target.value === 'neg' });
                  }}
                >
                  <option value="neg">{t('import.signs.negativeIsExpense')}</option>
                  <option value="pos">{t('import.signs.positiveIsExpense')}</option>
                </SelectInput>
              )}
            </Field>
          </>
        )}
        <Field label={t('import.dateFormat')}>
          {({ id }) => (
            <SelectInput
              id={id}
              value={mapping.dateFormat}
              onChange={(e) => {
                onChange({ ...mapping, dateFormat: e.target.value as DateFormat });
              }}
            >
              {DATE_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {t(`import.dateFormats.${f}`)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
        <Field label={t('import.decimal')}>
          {({ id }) => (
            <SelectInput
              id={id}
              value={mapping.decimalSeparator}
              onChange={(e) => {
                onChange({ ...mapping, decimalSeparator: e.target.value as '.' | ',' });
              }}
            >
              <option value=".">1,234.56</option>
              <option value=",">1.234,56</option>
            </SelectInput>
          )}
        </Field>
        <Field label={t('import.currency')}>
          {({ id }) => (
            <SelectInput
              id={id}
              value={mapping.currency}
              onChange={(e) => {
                onChange({ ...mapping, currency: e.target.value as CurrencyCode });
              }}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
      </div>
      <h3 className="mb-2 mt-6 text-sm font-semibold">{t('import.preview')}</h3>
      <div className="overflow-x-auto">
        <table className="tabular w-full text-sm">
          <thead>
            <tr className="text-ink-muted border-line border-b text-start">
              <th className="py-1.5 text-start font-medium">{t('import.columns.date')}</th>
              <th className="py-1.5 text-start font-medium">{t('import.columns.description')}</th>
              <th className="py-1.5 text-end font-medium">{t('import.columns.amount')}</th>
            </tr>
          </thead>
          <tbody>
            {preview.map((r) => (
              <tr key={r.rowIndex} className="border-line border-b last:border-0">
                <td className="py-1.5">{fmt.date(r.date)}</td>
                <td className="max-w-48 truncate py-1.5">{r.description}</td>
                <td className={`py-1.5 text-end ${r.type === 'income' ? 'text-positive' : ''}`}>
                  {fmt.money(r.type === 'income' ? r.amount : -r.amount, r.currency, {
                    signed: true,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {preview.length === 0 && (
          <p className="text-warning py-3 text-sm">{t('import.previewEmpty')}</p>
        )}
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={onNext}>{t('import.toReview')}</Button>
      </div>
    </Card>
  );
}
