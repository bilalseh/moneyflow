import { getCurrency, type CurrencyCode } from '@moneyflow/shared';

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';

/** Turn Arabic-Indic and Persian digits and separators into ASCII. */
export function normalizeDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(PERSIAN.indexOf(d)))
    .replace(/٫/g, '.')
    .replace(/٬/g, ',');
}

/** Split typed text into whole and fraction digits, deciding which separator is decimal. */
function splitDecimal(value: string, minorUnits: number): { whole: string; fraction: string } {
  const dot = value.lastIndexOf('.');
  const comma = value.lastIndexOf(',');
  if (dot !== -1 && comma !== -1) {
    // Both present: the later one is the decimal separator.
    const at = Math.max(dot, comma);
    return { whole: value.slice(0, at).replace(/[.,]/g, ''), fraction: value.slice(at + 1) };
  }
  const sep = dot !== -1 ? '.' : comma !== -1 ? ',' : null;
  if (sep === null) return { whole: value, fraction: '' };
  const count = value.split(sep).length - 1;
  const tail = value.slice(value.lastIndexOf(sep) + 1);
  const looksLikeThousands = count > 1 || (tail.length === 3 && minorUnits !== 3);
  if (looksLikeThousands) return { whole: value.split(sep).join(''), fraction: '' };
  return { whole: value.slice(0, value.lastIndexOf(sep)), fraction: tail };
}

/**
 * Parse what a person typed into minor units. Accepts "1,234.56", "1234,5",
 * "١٢٣٫٥" and similar. Returns null for empty or unreadable input, negative
 * numbers, and more decimals than the currency supports.
 */
export function parseMajorInput(raw: string, currency: CurrencyCode): number | null {
  const value = normalizeDigits(raw).replace(/\s/g, '');
  if (value === '') return null;
  const { minorUnits } = getCurrency(currency);
  const { whole, fraction } = splitDecimal(value, minorUnits);
  if (!/^\d*$/.test(whole) || !/^\d*$/.test(fraction)) return null;
  if (whole === '' && fraction === '') return null;
  if (fraction.length > minorUnits) return null;
  const minor =
    Number(whole || '0') * 10 ** minorUnits + Number(fraction.padEnd(minorUnits, '0') || '0');
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Minor units to a plain editable string ("1234.5" style, no grouping). */
export function toInputString(minor: number | null, currency: CurrencyCode): string {
  if (minor === null) return '';
  const { minorUnits } = getCurrency(currency);
  if (minorUnits === 0) return String(minor);
  const abs = Math.abs(minor);
  const scale = 10 ** minorUnits;
  const fraction = String(abs % scale)
    .padStart(minorUnits, '0')
    .replace(/0+$/, '');
  return `${minor < 0 ? '-' : ''}${String(Math.floor(abs / scale))}${fraction ? `.${fraction}` : ''}`;
}

/** Percent input like "24.99" to basis points (2499). */
export function parsePercentToBps(raw: string): number | null {
  const value = normalizeDigits(raw).trim().replace(',', '.');
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(value)) return null;
  const bps = Math.round(Number(value) * 100);
  return bps <= 10_000 ? bps : null;
}

export function bpsToInput(bps: number | null): string {
  return bps === null ? '' : (bps / 100).toString();
}
