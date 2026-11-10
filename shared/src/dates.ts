import { z } from 'zod';

/**
 * Calendar helpers on plain strings. Dates are `YYYY-MM-DD`, months `YYYY-MM`.
 * Everything is computed in UTC so results never depend on the viewer's time zone.
 */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'Expected YYYY-MM-DD')
  .refine((v) => isValidDate(v), 'Invalid calendar date');

export const monthKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Expected YYYY-MM');

const DAY_MS = 86_400_000;

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

function parts(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number);
  return [y ?? 0, m ?? 1, d ?? 1];
}

export function isValidDate(date: string): boolean {
  const [y, m, d] = parts(date);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function toUtcMs(date: string): number {
  const [y, m, d] = parts(date);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): string {
  const dt = new Date(ms);
  return `${String(dt.getUTCFullYear())}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Local calendar date of `now` as YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function currentMonth(now: Date = new Date()): string {
  return monthOf(todayIso(now));
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function addDays(date: string, days: number): string {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

export function diffDays(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

export function addMonths(month: string, count: number): string {
  const [y, m] = parts(`${month}-01`);
  const index = y * 12 + (m - 1) + count;
  return `${String(Math.floor(index / 12))}-${pad((index % 12) + 1)}`;
}

/** Number of months from `from` to `to` (positive when `to` is later). */
export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = parts(`${from}-01`);
  const [ty, tm] = parts(`${to}-01`);
  return (ty - fy) * 12 + (tm - fm);
}

export function daysInMonth(month: string): number {
  const [y, m] = parts(`${month}-01`);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Same day-of-month in a later month, clamped to that month's length. */
export function addMonthsToDate(date: string, count: number): string {
  const [, , d] = parts(date);
  const month = addMonths(monthOf(date), count);
  return `${month}-${pad(Math.min(d, daysInMonth(month)))}`;
}

/** Inclusive list of months from `from` to `to`. Empty when `to` is earlier. */
export function monthRange(from: string, to: string): string[] {
  const count = monthsBetween(from, to);
  return Array.from({ length: Math.max(0, count + 1) }, (_, i) => addMonths(from, i));
}

/** The `count` months ending at `month`, oldest first. */
export function lastMonths(month: string, count: number): string[] {
  return monthRange(addMonths(month, -(count - 1)), month);
}

export function firstDayOf(month: string): string {
  return `${month}-01`;
}

export function lastDayOf(month: string): string {
  return `${month}-${pad(daysInMonth(month))}`;
}
