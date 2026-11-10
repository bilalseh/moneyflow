import {
  bpsToInput,
  normalizeDigits,
  parseMajorInput,
  parsePercentToBps,
  toInputString,
} from '@/lib/numberInput';

describe('parseMajorInput', () => {
  it('parses plain and decimal amounts into minor units', () => {
    expect(parseMajorInput('12', 'USD')).toBe(1200);
    expect(parseMajorInput('12.5', 'USD')).toBe(1250);
    expect(parseMajorInput('12,50', 'EUR')).toBe(1250);
    expect(parseMajorInput('.5', 'USD')).toBe(50);
  });

  it('understands thousands separators', () => {
    expect(parseMajorInput('1,234.56', 'USD')).toBe(123456);
    expect(parseMajorInput('1.234,56', 'EUR')).toBe(123456);
    expect(parseMajorInput('1,234', 'USD')).toBe(123400);
    expect(parseMajorInput('1,500,000', 'LBP')).toBe(1500000);
  });

  it('accepts Arabic-Indic digits and separators', () => {
    expect(normalizeDigits('١٢٣٫٤٥')).toBe('123.45');
    expect(parseMajorInput('١٢٣٫٤٥', 'SAR')).toBe(12345);
  });

  it('respects the currency minor units', () => {
    expect(parseMajorInput('1.500', 'JOD')).toBe(1500);
    expect(parseMajorInput('1.5', 'LBP')).toBeNull();
    expect(parseMajorInput('1.234', 'USD')).toBe(123400);
    expect(parseMajorInput('1.23', 'USD')).toBe(123);
  });

  it('rejects garbage', () => {
    expect(parseMajorInput('', 'USD')).toBeNull();
    expect(parseMajorInput('abc', 'USD')).toBeNull();
    expect(parseMajorInput('12a', 'USD')).toBeNull();
    expect(parseMajorInput('-5', 'USD')).toBeNull();
  });
});

describe('round trips and percentages', () => {
  it('formats minor units back for editing', () => {
    expect(toInputString(123450, 'USD')).toBe('1234.5');
    expect(toInputString(1500, 'LBP')).toBe('1500');
    expect(toInputString(null, 'USD')).toBe('');
    expect(parseMajorInput(toInputString(98765, 'USD'), 'USD')).toBe(98765);
  });

  it('converts percentages to basis points', () => {
    expect(parsePercentToBps('24.99')).toBe(2499);
    expect(parsePercentToBps('6,9')).toBe(690);
    expect(parsePercentToBps('101')).toBeNull();
    expect(parsePercentToBps('x')).toBeNull();
    expect(bpsToInput(690)).toBe('6.9');
  });
});
