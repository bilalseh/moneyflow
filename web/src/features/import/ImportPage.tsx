import {
  CsvError,
  guessMapping,
  mapRows,
  markDuplicates,
  parseCsv,
  type ColumnMapping,
  type ParsedCsv,
} from '@moneyflow/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { Icon } from '@/components/Icon';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/Page';
import { toast } from '@/components/ui/toast';
import { useCollection, useCommitWrites, useProfile } from '@/data/hooks';
import { toReviewRows, toTransactions, type ReviewRow } from '@/features/import/buildImport';
import { MappingForm } from '@/features/import/MappingForm';
import { ReviewTable } from '@/features/import/ReviewTable';
import { nowIso } from '@/lib/ids';

const SAMPLE =
  'Date,Description,Amount\n2026-10-01,Salary October,4200.00\n2026-10-02,CARREFOUR CITY,-54.30\n2026-10-03,Uber trip,-12.40\n2026-10-05,NETFLIX.COM,-15.99\n';

export function ImportPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const profile = useProfile();
  const existing = useCollection('transactions');
  const commit = useCommitWrites();
  const [csv, setCsv] = useState<ParsedCsv | null>(null);
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currency = profile.data?.mainCurrency ?? 'USD';

  const onFile = async (file: File) => {
    setError(null);
    if (file.size > 2_000_000) {
      setError(t('import.tooLarge'));
      return;
    }
    try {
      const parsed = parseCsv(await file.text());
      setCsv(parsed);
      setFileName(file.name);
      setMapping(guessMapping(parsed, currency));
      setRows(null);
    } catch (e) {
      setError(
        e instanceof CsvError
          ? t('import.parseError', { reason: e.message })
          : t('import.readError'),
      );
    }
  };

  const review = () => {
    if (!csv || !mapping) return;
    const mapped = mapRows(csv, mapping);
    if (mapped.rows.length === 0) {
      setError(t('import.noRows'));
      return;
    }
    setError(
      mapped.errors.length > 0 ? t('import.skippedRows', { count: mapped.errors.length }) : null,
    );
    setRows(toReviewRows(markDuplicates(mapped.rows, existing.data ?? [])));
  };

  const doImport = () => {
    if (!rows) return;
    const txs = toTransactions(rows, nowIso(), (r) => `csv_${r.hash}_${String(r.rowIndex)}`);
    commit.mutate(
      txs.map((value) => ({ kind: 'set', name: 'transactions', value })),
      {
        onSuccess: () => {
          toast.success(t('import.done', { count: txs.length }));
          void navigate('/app/transactions');
        },
        onError: () => {
          toast.error(t('common.saveFailed'));
        },
      },
    );
  };

  return (
    <>
      <PageHeader title={t('import.title')} description={t('import.description')} />
      <ol
        className="text-ink-muted mb-6 flex flex-wrap gap-4 text-sm"
        aria-label={t('import.stepsLabel')}
      >
        {(['upload', 'map', 'review'] as const).map((s, i) => {
          const step = rows ? 'review' : csv ? 'map' : 'upload';
          const active = s === step;
          return (
            <li
              key={s}
              aria-current={active ? 'step' : undefined}
              className={active ? 'text-brand font-semibold' : ''}
            >
              {i + 1}. {t(`import.steps.${s}`)}
            </li>
          );
        })}
      </ol>
      {error && (
        <p role="alert" className="bg-warning-soft text-warning mb-4 rounded-lg p-3 text-sm">
          {error}
        </p>
      )}

      {!rows && (
        <Card className="mb-6">
          <CardHeader title={t('import.uploadTitle')} description={t('import.uploadHint')} />
          <label className="border-line hover:border-brand flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-center">
            <Icon name="file" className="text-brand size-8" />
            <span className="font-medium">{fileName || t('import.choose')}</span>
            <span className="text-ink-muted text-xs">{t('import.privacy')}</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
          </label>
          <a
            className="text-brand mt-3 inline-block text-sm hover:underline"
            download="moneyflow-sample.csv"
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE)}`}
          >
            {t('import.sample')}
          </a>
        </Card>
      )}

      {csv && mapping && !rows && (
        <MappingForm csv={csv} mapping={mapping} onChange={setMapping} onNext={review} />
      )}

      {rows && (
        <>
          <ReviewTable rows={rows} onChange={setRows} locale={profile.data?.locale ?? 'en'} />
          <div className="mt-4 flex flex-wrap justify-between gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                setRows(null);
              }}
            >
              {t('import.backToMapping')}
            </Button>
            <Button
              onClick={doImport}
              loading={commit.isPending}
              disabled={!rows.some((r) => r.include)}
            >
              {t('import.importCount', { count: rows.filter((r) => r.include).length })}
            </Button>
          </div>
        </>
      )}
    </>
  );
}
