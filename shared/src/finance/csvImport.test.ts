import { suggestCategory } from './categorize';
import { parseCsv } from './csv';
import {
  detectDateFormat,
  guessMapping,
  mapRows,
  markDuplicates,
  parseAmount,
  parseDate,
  transactionHash,
} from './csvImport';

describe('dates and amounts', () => {
  it('parses the three date formats', () => {
    expect(parseDate('2026-10-31', 'YMD')).toBe('2026-10-31');
    expect(parseDate('31/10/2026', 'DMY')).toBe('2026-10-31');
    expect(parseDate('10/31/2026', 'MDY')).toBe('2026-10-31');
    expect(parseDate('31.10.26', 'DMY')).toBe('2026-10-31');
    expect(parseDate('31/02/2026', 'DMY')).toBeNull();
    expect(parseDate('yesterday', 'YMD')).toBeNull();
  });

  it('detects the date format from samples', () => {
    expect(detectDateFormat(['2026-10-01', '2026-10-15'])).toBe('YMD');
    expect(detectDateFormat(['13/10/2026', '01/10/2026'])).toBe('DMY');
    expect(detectDateFormat(['10/13/2026', '10/01/2026'])).toBe('MDY');
    expect(detectDateFormat([])).toBeNull();
  });

  it('parses amounts in many notations into signed minor units', () => {
    expect(parseAmount('1,234.56', '.', 'USD')).toBe(123456);
    expect(parseAmount('1.234,56', ',', 'EUR')).toBe(123456);
    expect(parseAmount('-12,5', ',', 'EUR')).toBe(-1250);
    expect(parseAmount('(45.00)', '.', 'USD')).toBe(-4500);
    expect(parseAmount('$ 12', '.', 'USD')).toBe(1200);
    expect(parseAmount('150000', '.', 'LBP')).toBe(150000);
    expect(parseAmount('abc', '.', 'USD')).toBeNull();
    expect(parseAmount('', '.', 'USD')).toBeNull();
  });
});

describe('mapping', () => {
  it('guesses a signed amount layout', () => {
    const csv = parseCsv(
      'Date,Description,Amount\n31/10/2026,Coffee,-4.50\n01/11/2026,Salary,4000.00\n',
    );
    const m = guessMapping(csv, 'USD');
    expect(m).toMatchObject({
      date: 0,
      description: 1,
      amount: 2,
      debit: null,
      dateFormat: 'DMY',
      decimalSeparator: '.',
    });
    const { rows, errors } = mapRows(csv, m);
    expect(errors).toEqual([]);
    expect(rows.map((r) => [r.date, r.type, r.amount])).toEqual([
      ['2026-10-31', 'expense', 450],
      ['2026-11-01', 'income', 400000],
    ]);
  });

  it('guesses a debit/credit layout with comma decimals', () => {
    const csv = parseCsv(
      'Posted;Payee;Debit;Credit\n2026-10-01;Bakery;3,20;\n2026-10-02;Refund;;10,00\n',
    );
    const m = guessMapping(csv, 'EUR');
    expect(m).toMatchObject({
      date: 0,
      description: 1,
      amount: null,
      debit: 2,
      credit: 3,
      decimalSeparator: ',',
    });
    const { rows } = mapRows(csv, m);
    expect(rows.map((r) => [r.type, r.amount])).toEqual([
      ['expense', 320],
      ['income', 1000],
    ]);
  });

  it('reports rows it cannot read', () => {
    const csv = parseCsv(
      'Date,Description,Amount\nnot a date,X,1\n2026-10-01,Y,abc\n2026-10-01,Z,0\n',
    );
    const { rows, errors } = mapRows(csv, guessMapping(csv, 'USD'));
    expect(rows).toEqual([]);
    expect(errors.map((e) => e.reason)).toEqual(['date', 'amount', 'empty']);
  });

  it('flips signs when expenses are positive', () => {
    const csv = parseCsv('Date,Description,Amount\n2026-10-01,Coffee,4.50\n');
    const m = { ...guessMapping(csv, 'USD'), negativeIsExpense: false };
    expect(mapRows(csv, m).rows[0]?.type).toBe('expense');
  });
});

describe('duplicates', () => {
  it('hashes identical transactions identically regardless of merchant noise', () => {
    expect(transactionHash('2026-10-01', 450, 'expense', 'STARBUCKS #123')).toBe(
      transactionHash('2026-10-01', 450, 'expense', 'Starbucks 999'),
    );
    expect(transactionHash('2026-10-01', 450, 'expense', 'A')).not.toBe(
      transactionHash('2026-10-02', 450, 'expense', 'A'),
    );
  });

  it('flags rows matching stored transactions within a day, and repeats inside the file', () => {
    const csv = parseCsv(
      'Date,Description,Amount\n2026-10-01,Coffee,-4.50\n2026-10-01,Coffee,-4.50\n2026-10-05,Lunch,-12\n',
    );
    const { rows } = mapRows(csv, guessMapping(csv, 'USD'));
    const marked = markDuplicates(rows, [
      { date: '2026-10-06', amount: 1200, type: 'expense', note: 'LUNCH' },
    ]);
    expect(marked.map((r) => r.duplicate)).toEqual([null, 'file', 'existing']);
  });
});

describe('suggestCategory', () => {
  it('categorizes common merchants in English and Arabic', () => {
    expect(suggestCategory('CARREFOUR CITY', 'expense').categoryId).toBe('groceries');
    expect(suggestCategory('Netflix.com', 'expense').categoryId).toBe('subscriptions');
    expect(suggestCategory('UBER *TRIP', 'expense').categoryId).toBe('transport');
    expect(suggestCategory('دفع إيجار الشقة', 'expense').categoryId).toBe('housing');
    expect(suggestCategory('Salary October', 'income')).toEqual({
      categoryId: 'income',
      confidence: 0.9,
    });
    expect(suggestCategory('zzz', 'expense')).toEqual({ categoryId: 'other', confidence: 0.2 });
  });
});
