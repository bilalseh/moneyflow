import { formatMoney, money, toMajorUnits, toMinorUnits } from './money';

describe('money', () => {
  it('converts major units to minor units with rounding', () => {
    expect(toMinorUnits(12.34, 'USD')).toBe(1234);
    expect(toMinorUnits(0.1 + 0.2, 'USD')).toBe(30);
    expect(toMinorUnits(1500, 'LBP')).toBe(1500);
    expect(toMinorUnits(1.5, 'JOD')).toBe(1500);
  });

  it('converts minor units back to major units', () => {
    expect(toMajorUnits(1234, 'USD')).toBe(12.34);
    expect(toMajorUnits(1500, 'JOD')).toBe(1.5);
  });

  it('rejects non-integer amounts', () => {
    expect(() => money(12.5, 'USD')).toThrow();
  });

  it('formats per locale', () => {
    expect(formatMoney(money(123456, 'USD'), 'en-US')).toBe('$1,234.56');
    expect(formatMoney(money(1500, 'JOD'), 'en-US')).toContain('1.500');
  });
});
