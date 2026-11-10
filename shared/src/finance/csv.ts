/**
 * Small RFC 4180 style CSV parser: quoted fields, escaped quotes, CRLF or LF,
 * a leading BOM, and delimiter sniffing between comma, semicolon, tab and pipe.
 */
export interface ParsedCsv {
  delimiter: string;
  headers: string[];
  rows: string[][];
}

export const MAX_CSV_ROWS = 5000;

const CANDIDATE_DELIMITERS = [',', ';', '\t', '|'] as const;

export class CsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CsvError';
  }
}

/** Count delimiter occurrences outside quotes on the first few lines. */
export function sniffDelimiter(text: string): string {
  const sample = text
    .split(/\r?\n/)
    .slice(0, 10)
    .filter((l) => l.trim() !== '');
  let best = ',';
  let bestScore = -1;
  for (const d of CANDIDATE_DELIMITERS) {
    const counts = sample.map((line) => {
      let inQuotes = false;
      let n = 0;
      for (const ch of line) {
        if (ch === '"') inQuotes = !inQuotes;
        else if (ch === d && !inQuotes) n += 1;
      }
      return n;
    });
    const first = counts[0] ?? 0;
    const consistent = counts.every((c) => c === first);
    const score = first === 0 ? 0 : first * (consistent ? 10 : 1);
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

export function parseCsvRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') inQuotes = false;
      else field += ch;
      continue;
    }
    if (ch === '"' && field === '') inQuotes = true;
    else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (inQuotes) throw new CsvError('Unclosed quote in CSV');
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

export function parseCsv(input: string): ParsedCsv {
  const text = input.startsWith('﻿') ? input.slice(1) : input;
  if (text.trim() === '') throw new CsvError('The file is empty');
  const delimiter = sniffDelimiter(text);
  const all = parseCsvRows(text, delimiter);
  const [headerRow, ...rows] = all;
  if (headerRow === undefined || rows.length === 0) {
    throw new CsvError('Expected a header row and at least one data row');
  }
  if (rows.length > MAX_CSV_ROWS) {
    throw new CsvError(`Too many rows: the limit is ${String(MAX_CSV_ROWS)}`);
  }
  const width = headerRow.length;
  return {
    delimiter,
    headers: headerRow.map((h, i) => h.trim() || `Column ${String(i + 1)}`),
    rows: rows.map((r) => Array.from({ length: width }, (_, i) => (r[i] ?? '').trim())),
  };
}

/** Quote a value for CSV export when needed. Also neutralises spreadsheet formula injection. */
export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s) && typeof value === 'string') s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: readonly string[], rows: readonly (readonly unknown[])[]): string {
  const line = (cells: readonly unknown[]) =>
    cells.map((c) => csvCell(c as string | number | boolean | null | undefined)).join(',');
  return [line(headers), ...rows.map(line)].join('\r\n') + '\r\n';
}
