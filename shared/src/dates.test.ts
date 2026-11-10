import {
  addDays,
  addMonths,
  addMonthsToDate,
  currentMonth,
  daysInMonth,
  diffDays,
  isoDateSchema,
  isValidDate,
  lastDayOf,
  lastMonths,
  monthRange,
  monthsBetween,
  todayIso,
} from './dates';

describe('dates', () => {
  it('validates calendar dates', () => {
    expect(isValidDate('2024-02-29')).toBe(true);
    expect(isValidDate('2025-02-29')).toBe(false);
    expect(isoDateSchema.safeParse('2026-13-01').success).toBe(false);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(diffDays('2026-01-01', '2026-03-01')).toBe(59);
  });

  it('adds months and counts months between', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(monthsBetween('2026-11', '2027-02')).toBe(3);
    expect(monthsBetween('2027-02', '2026-11')).toBe(-3);
  });

  it('clamps day-of-month when adding months', () => {
    expect(addMonthsToDate('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsToDate('2024-01-31', 1)).toBe('2024-02-29');
  });

  it('builds month ranges', () => {
    expect(monthRange('2026-10', '2027-01')).toEqual(['2026-10', '2026-11', '2026-12', '2027-01']);
    expect(monthRange('2027-01', '2026-10')).toEqual([]);
    expect(lastMonths('2026-02', 3)).toEqual(['2025-12', '2026-01', '2026-02']);
  });

  it('knows month lengths', () => {
    expect(daysInMonth('2026-02')).toBe(28);
    expect(lastDayOf('2026-04')).toBe('2026-04-30');
  });

  it('formats today from a local date', () => {
    const now = new Date(2026, 10, 9, 23, 59);
    expect(todayIso(now)).toBe('2026-11-09');
    expect(currentMonth(now)).toBe('2026-11');
  });
});
