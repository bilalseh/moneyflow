import { csvCell, CsvError, parseCsv, sniffDelimiter, toCsv } from './csv';

describe('parseCsv', () => {
  it('parses a simple comma file with a header', () => {
    const csv = parseCsv(
      'Date,Description,Amount\n2026-10-01,Coffee,-4.50\n2026-10-02,Salary,4000\n',
    );
    expect(csv.headers).toEqual(['Date', 'Description', 'Amount']);
    expect(csv.rows).toEqual([
      ['2026-10-01', 'Coffee', '-4.50'],
      ['2026-10-02', 'Salary', '4000'],
    ]);
  });

  it('handles quotes, escaped quotes, embedded delimiters and newlines', () => {
    const csv = parseCsv('a,b\r\n"x, y","he said ""hi"""\r\n"multi\nline",2\r\n');
    expect(csv.rows).toEqual([
      ['x, y', 'he said "hi"'],
      ['multi\nline', '2'],
    ]);
  });

  it('strips a BOM, sniffs semicolons and pads short rows', () => {
    const csv = parseCsv('﻿Datum;Betrag;Text\n01.10.2026;-12,50;Bäcker\n02.10.2026;3\n');
    expect(csv.delimiter).toBe(';');
    expect(csv.headers[0]).toBe('Datum');
    expect(csv.rows[1]).toEqual(['02.10.2026', '3', '']);
  });

  it('skips blank lines and names empty headers', () => {
    const csv = parseCsv('Date,,Amount\n\n2026-10-01,x,1\n\n');
    expect(csv.headers[1]).toBe('Column 2');
    expect(csv.rows).toHaveLength(1);
  });

  it('rejects empty files, header-only files and unclosed quotes', () => {
    expect(() => parseCsv('   ')).toThrow(CsvError);
    expect(() => parseCsv('a,b\n')).toThrow(CsvError);
    expect(() => parseCsv('a,b\n"oops,1\n')).toThrow(CsvError);
  });

  it('sniffs tab and pipe delimiters', () => {
    expect(sniffDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t');
    expect(sniffDelimiter('a|b\n1|2')).toBe('|');
  });
});

describe('CSV export', () => {
  it('quotes when needed', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "x"')).toBe('"say ""x"""');
    expect(csvCell(null)).toBe('');
    expect(csvCell(-12)).toBe('-12');
  });

  it('neutralises spreadsheet formulas in text cells', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('writes CRLF rows', () => {
    expect(toCsv(['a', 'b'], [[1, 'x']])).toBe('a,b\r\n1,x\r\n');
  });
});
