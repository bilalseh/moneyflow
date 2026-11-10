import { getCurrency, type CurrencyCode } from '../currency';
import { diffDays, isValidDate } from '../dates';
import type { ParsedCsv } from './csv';
import { normalizeMerchant } from './recurring';

export const DATE_FORMATS = ['YMD', 'DMY', 'MDY'] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export interface ColumnMapping {
  date: number;
  description: number;
  /** Single signed amount column, or... */
  amount: number | null;
  /** ...separate debit (money out) and credit (money in) columns. */
  debit: number | null;
  credit: number | null;
  dateFormat: DateFormat;
  decimalSeparator: '.' | ',';
  currency: CurrencyCode;
  /** With a single amount column: are expenses written as negative numbers? */
  negativeIsExpense: boolean;
}

export interface ImportRow {
  rowIndex: number;
  date: string;
  amount: number;
  type: 'expense' | 'income';
  description: string;
  currency: CurrencyCode;
  hash: string;
}

export interface RowError {
  rowIndex: number;
  reason: 'date' | 'amount' | 'empty';
}

const HEADER_HINTS: Record<'date' | 'description' | 'amount' | 'debit' | 'credit', RegExp> = {
  date: /date|posted|time|تاريخ/i,
  description: /desc|memo|narr|detail|payee|merchant|name|reference|وصف|بيان/i,
  amount: /^amount$|amount|value|sum|مبلغ|قيمة/i,
  debit: /debit|withdraw|out|paid|مدين|سحب/i,
  credit: /credit|deposit|in$|received|دائن|إيداع/i,
};

function findColumn(headers: readonly string[], hint: RegExp, exclude: Set<number>): number | null {
  const index = headers.findIndex((h, i) => !exclude.has(i) && hint.test(h));
  return index === -1 ? null : index;
}

export function parseDate(value: string, format: DateFormat): string | null {
  const m = /^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})/.exec(value.trim());
  if (!m) return null;
  const [a = '', b = '', c = ''] = [m[1], m[2], m[3]];
  const [y, mo, d] = format === 'YMD' ? [a, b, c] : format === 'DMY' ? [c, b, a] : [c, a, b];
  const year = y.length === 2 ? `20${y}` : y;
  if (year.length !== 4) return null;
  const iso = `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  return isValidDate(iso) ? iso : null;
}

/** Pick the first format that parses every sample; YMD wins ties, then DMY, then MDY. */
export function detectDateFormat(samples: readonly string[]): DateFormat | null {
  const values = samples.filter((s) => s.trim() !== '').slice(0, 50);
  if (values.length === 0) return null;
  return DATE_FORMATS.find((f) => values.every((v) => parseDate(v, f) !== null)) ?? null;
}

/** Parse "1,234.56", "-12,5", "(45.00)", "$ 12" into signed minor units. */
export function parseAmount(
  value: string,
  decimal: '.' | ',',
  currency: CurrencyCode,
): number | null {
  let s = value.trim();
  if (s === '') return null;
  const negative = /^\(.*\)$/.test(s) || s.includes('-');
  s = s.replace(/[()\-+\s]/g, '').replace(/[^\d.,]/g, '');
  const thousands = decimal === '.' ? ',' : '.';
  s = s.split(thousands).join('');
  if (decimal === ',') s = s.replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const minor = Math.round(Number(s) * 10 ** getCurrency(currency).minorUnits);
  return negative ? -minor : minor;
}

export function guessMapping(csv: ParsedCsv, currency: CurrencyCode): ColumnMapping {
  const used = new Set<number>();
  const take = (i: number | null) => {
    if (i !== null) used.add(i);
    return i;
  };
  const date = take(findColumn(csv.headers, HEADER_HINTS.date, used)) ?? 0;
  const debit = take(findColumn(csv.headers, HEADER_HINTS.debit, used));
  const credit = take(findColumn(csv.headers, HEADER_HINTS.credit, used));
  const split = debit !== null && credit !== null;
  const amount = split ? null : take(findColumn(csv.headers, HEADER_HINTS.amount, used));
  const description =
    take(findColumn(csv.headers, HEADER_HINTS.description, used)) ??
    csv.headers.findIndex((_, i) => !used.has(i));
  const sample = csv.rows.map((r) => r[amount ?? debit ?? 0] ?? '').join(' ');
  const decimalSeparator =
    /\d,\d{2}(\D|$)/.test(sample) && !/\d\.\d{2}(\D|$)/.test(sample) ? ',' : '.';
  return {
    date,
    description: Math.max(0, description),
    amount: split ? null : amount,
    debit: split ? debit : null,
    credit: split ? credit : null,
    dateFormat: detectDateFormat(csv.rows.map((r) => r[date] ?? '')) ?? 'YMD',
    decimalSeparator,
    currency,
    negativeIsExpense: true,
  };
}

/** Stable FNV-1a hash of the fields that identify a transaction. */
export function transactionHash(
  date: string,
  amount: number,
  type: string,
  description: string,
): string {
  const input = `${date}|${String(amount)}|${type}|${normalizeMerchant(description)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function mapRows(
  csv: ParsedCsv,
  mapping: ColumnMapping,
): { rows: ImportRow[]; errors: RowError[] } {
  const rows: ImportRow[] = [];
  const errors: RowError[] = [];
  csv.rows.forEach((cells, rowIndex) => {
    const date = parseDate(cells[mapping.date] ?? '', mapping.dateFormat);
    if (date === null) return errors.push({ rowIndex, reason: 'date' });
    const read = (i: number | null) =>
      i === null ? null : parseAmount(cells[i] ?? '', mapping.decimalSeparator, mapping.currency);
    let signed: number | null;
    if (mapping.amount !== null) {
      const raw = read(mapping.amount);
      signed = raw === null ? null : mapping.negativeIsExpense ? raw : -raw;
    } else {
      const out = Math.abs(read(mapping.debit) ?? 0);
      const inn = Math.abs(read(mapping.credit) ?? 0);
      signed = out === 0 && inn === 0 ? null : inn - out;
    }
    if (signed === null) return errors.push({ rowIndex, reason: 'amount' });
    if (signed === 0) return errors.push({ rowIndex, reason: 'empty' });
    const type = signed < 0 ? 'expense' : 'income';
    const amount = Math.abs(signed);
    const description = (cells[mapping.description] ?? '').slice(0, 200);
    rows.push({
      rowIndex,
      date,
      amount,
      type,
      description,
      currency: mapping.currency,
      hash: transactionHash(date, amount, type, description),
    });
  });
  return { rows, errors };
}

export interface ExistingTransaction {
  date: string;
  amount: number;
  type: 'expense' | 'income';
  note: string;
}

export type DuplicateKind = 'existing' | 'file' | null;

/**
 * Flag rows that look like transactions already stored (same amount, type and
 * merchant within one day) or that repeat an earlier row of the same file.
 */
export function markDuplicates(
  rows: readonly ImportRow[],
  existing: readonly ExistingTransaction[],
) {
  const seen = new Set<string>();
  const byKey = new Map<string, string[]>();
  for (const e of existing) {
    const key = `${String(e.amount)}|${e.type}|${normalizeMerchant(e.note)}`;
    byKey.set(key, [...(byKey.get(key) ?? []), e.date]);
  }
  return rows.map((row) => {
    let duplicate: DuplicateKind = null;
    const key = `${String(row.amount)}|${row.type}|${normalizeMerchant(row.description)}`;
    if ((byKey.get(key) ?? []).some((d) => Math.abs(diffDays(d, row.date)) <= 1))
      duplicate = 'existing';
    else if (seen.has(row.hash)) duplicate = 'file';
    seen.add(row.hash);
    return { ...row, duplicate };
  });
}
