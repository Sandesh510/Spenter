import { describe, expect, it } from 'vitest';
import { direction, escapeCell, exportFileName, guardFormula, numeric, toCsv, transactionsCsv, type ExportRow } from './csv';
import { monthSpan } from './dates';

describe('escapeCell (RFC 4180)', () => {
  it('leaves plain text alone', () => {
    expect(escapeCell('Groceries')).toBe('Groceries');
    expect(escapeCell(null)).toBe('');
    expect(escapeCell(undefined)).toBe('');
  });

  it('quotes cells with commas, quotes and line breaks, doubling inner quotes', () => {
    expect(escapeCell('Rent, October')).toBe('"Rent, October"');
    expect(escapeCell('The "big" shop')).toBe('"The ""big"" shop"');
    expect(escapeCell('line one\nline two')).toBe('"line one\nline two"');
    expect(escapeCell('a\r\nb')).toBe('"a\r\nb"');
  });
});

describe('formula guard', () => {
  it('prefixes an apostrophe to text that a spreadsheet would run', () => {
    expect(guardFormula('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(guardFormula('+91 98765')).toBe("'+91 98765");
    expect(guardFormula('-refund')).toBe("'-refund");
    expect(guardFormula('@cmd')).toBe("'@cmd");
    expect(guardFormula('\tTab')).toBe("'\tTab");
    expect(guardFormula('Lunch = 200')).toBe('Lunch = 200');
  });

  it('guards and still quotes when both are needed', () => {
    expect(escapeCell('=HYPERLINK("x","y")')).toBe(`"'=HYPERLINK(""x"",""y"")"`);
  });

  it('never guards a numeric amount cell', () => {
    expect(escapeCell(numeric('-1234.50'))).toBe('-1234.50');
    expect(escapeCell(numeric('640.00'))).toBe('640.00');
  });

  it('treats a numeric cell that is not a number as text', () => {
    expect(escapeCell(numeric('=1+1'))).toBe("'=1+1");
  });
});

describe('toCsv', () => {
  it('joins rows with CRLF and ends with a line break', () => {
    expect(toCsv([['a', 'b'], ['c,d', numeric('1.00')]])).toBe('a,b\r\n"c,d",1.00\r\n');
  });
});

const row = (over: Partial<ExportRow>): ExportRow => ({
  date: '2026-10-03',
  type: 'spend',
  amountPaise: 64_000,
  external: false,
  categoryName: 'Food Wants',
  bucket: 'want',
  accountName: 'HDFC',
  toAccountName: null,
  description: null,
  reference: null,
  creditCategory: null,
  ...over,
});

describe('transactionsCsv', () => {
  it('writes the header and one line per transaction', () => {
    const csv = transactionsCsv([
      row({ description: 'Dinner, with friends' }),
      row({ type: 'credit', amountPaise: 6_000_000, categoryName: null, bucket: null, creditCategory: 'salary', reference: 'Oct pay' }),
      row({ type: 'transfer', amountPaise: 1_500_050, categoryName: null, bucket: null, toAccountName: 'Rewards card' }),
      row({ type: 'transfer', amountPaise: 2_000, categoryName: null, bucket: null, external: true, description: '-to Ravi' }),
    ]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Date,Type,Amount (₹),Direction,Category,Budget,Account,To account,Description,Reference,Money-in type');
    expect(lines[1]).toBe('2026-10-03,Spend,640.00,Out,Food Wants,Wants,HDFC,,"Dinner, with friends",,');
    expect(lines[2]).toBe('2026-10-03,Money in,60000.00,In,,,HDFC,,,Oct pay,Salary');
    expect(lines[3]).toBe('2026-10-03,Transfer,15000.50,Transfer,,,HDFC,Rewards card,,,');
    expect(lines[4]).toBe("2026-10-03,Transfer,20.00,Out,,,HDFC,Outside,'-to Ravi,,");
    expect(lines[5]).toBe('');
  });

  it('labels direction by type', () => {
    expect(direction({ type: 'credit', external: false })).toBe('In');
    expect(direction({ type: 'spend', external: false })).toBe('Out');
    expect(direction({ type: 'transfer', external: false })).toBe('Transfer');
    expect(direction({ type: 'transfer', external: true })).toBe('Out');
  });

  it('names the file after the range', () => {
    expect(exportFileName('2026-01', '2026-10')).toBe('spendcheck-2026-01-to-2026-10.csv');
  });
});

describe('monthSpan', () => {
  it('counts months inclusively, across years', () => {
    expect(monthSpan('2026-10', '2026-10')).toBe(1);
    expect(monthSpan('2025-11', '2026-10')).toBe(12);
    expect(monthSpan('2024-11', '2026-10')).toBe(24);
    expect(monthSpan('2026-10', '2026-09')).toBe(0);
  });
});
