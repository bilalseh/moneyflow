import { divRound, fromMain, MissingRateError, rateSchema, sumInMain, toMain } from './convert';

describe('currency conversion', () => {
  it('returns the same amount for the main currency', () => {
    expect(toMain(1234, 'USD', 'USD', {})).toBe(1234);
  });

  it('converts between currencies with the same minor units', () => {
    expect(toMain(10000, 'EUR', 'USD', { EUR: '1.08' })).toBe(10800);
  });

  it('handles different minor-unit exponents', () => {
    // 1,000,000 LBP (no minor units) at 0.0000112 USD each = 11.20 USD
    expect(toMain(1_000_000, 'LBP', 'USD', { LBP: '0.0000112' })).toBe(1120);
    // 1.500 JOD (3 minor units) at 1.41 USD = 2.115 USD, rounds to 2.12
    expect(toMain(1500, 'JOD', 'USD', { JOD: '1.41' })).toBe(212);
    // 10 USD into LBP main currency at 89500 LBP per USD
    expect(toMain(1000, 'USD', 'LBP', { USD: '89500' })).toBe(895000);
  });

  it('round-trips through the main currency', () => {
    const rates = { EUR: '1.0845' };
    expect(fromMain(toMain(50000, 'EUR', 'USD', rates), 'EUR', 'USD', rates)).toBe(50000);
  });

  it('never loses precision on large amounts', () => {
    expect(toMain(9_000_000_000_000, 'EUR', 'USD', { EUR: '1.5' })).toBe(13_500_000_000_000);
  });

  it('throws a typed error when a rate is missing', () => {
    expect(() => toMain(100, 'GBP', 'USD', {})).toThrow(MissingRateError);
  });

  it('sums mixed currencies and reports missing rates', () => {
    const result = sumInMain(
      [
        { amount: 1000, currency: 'USD' },
        { amount: 1000, currency: 'EUR' },
        { amount: 1000, currency: 'GBP' },
      ],
      'USD',
      { EUR: '1.1' },
    );
    expect(result).toEqual({ total: 2100, missing: ['GBP'] });
  });

  it('rounds half away from zero in BigInt division', () => {
    expect(divRound(5n, 2n)).toBe(3n);
    expect(divRound(-5n, 2n)).toBe(-3n);
    expect(divRound(4n, 3n)).toBe(1n);
  });

  it('validates rate strings', () => {
    expect(rateSchema.safeParse('1.08').success).toBe(true);
    expect(rateSchema.safeParse('0').success).toBe(false);
    expect(rateSchema.safeParse('1,08').success).toBe(false);
    expect(rateSchema.safeParse('-1').success).toBe(false);
  });
});
