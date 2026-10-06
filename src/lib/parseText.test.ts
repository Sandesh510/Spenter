import { describe, expect, it } from 'vitest';
import { matchAccount, parseDate, parseLines } from './parseText';

const today = '2026-10-07';

describe('parseDate', () => {
  it('reads ISO and day-first dates', () => {
    expect(parseDate('2026-10-03')).toBe('2026-10-03');
    expect(parseDate('03-10-2026')).toBe('2026-10-03');
    expect(parseDate('3/10/26')).toBe('2026-10-03');
    expect(parseDate('03.10.2026')).toBe('2026-10-03');
    expect(parseDate('3 Oct 2026')).toBe('2026-10-03');
    expect(parseDate('03-Oct-26')).toBe('2026-10-03');
    expect(parseDate('3rd October 2026')).toBe('2026-10-03');
  });

  it('rejects impossible dates', () => {
    expect(parseDate('31-02-2026')).toBeNull();
    expect(parseDate('2026-13-01')).toBeNull();
    expect(parseDate('yesterday')).toBeNull();
  });
});

describe('parseLines', () => {
  it('reads date, account, amount', () => {
    const [l] = parseLines('2026-10-03, Savings, 450', today);
    expect(l).toMatchObject({ error: null, date: '2026-10-03', accountHint: 'Savings', amount: '450', kind: 'spend', description: '' });
  });

  it('keeps an optional description', () => {
    const [l] = parseLines('03/10/2026,Credit card,1299.50,Amazon order, shoes', today);
    expect(l.amount).toBe('1299.50');
    expect(l.description).toBe('Amazon order, shoes');
  });

  it('joins thousands commas back into the amount', () => {
    expect(parseLines('03/10/2026,Savings,1,500', today)[0].amount).toBe('1500');
    expect(parseLines('03/10/2026,Savings,1,50,000,Rent', today)[0]).toMatchObject({ amount: '150000', description: 'Rent' });
    expect(parseLines('03/10/2026,Savings,"12,000",Fees', today)[0]).toMatchObject({ amount: '12000', description: 'Fees' });
  });

  it('strips rupee signs and reads money in', () => {
    expect(parseLines('03/10/2026,Savings,₹2500', today)[0]).toMatchObject({ amount: '2500', kind: 'spend' });
    expect(parseLines('03/10/2026,Savings,Rs. 2500 Cr', today)[0]).toMatchObject({ amount: '2500', kind: 'credit' });
    expect(parseLines('03/10/2026,Savings,+60000,Salary', today)[0]).toMatchObject({ amount: '60000', kind: 'credit' });
  });

  it('skips blank lines and a header row', () => {
    const rows = parseLines('Date,Account,Amount\n\n2026-10-01,Wallet,100\n', today);
    expect(rows).toHaveLength(1);
    expect(rows[0].line).toBe(3);
  });

  it('flags lines it cannot read, so they can be entered by hand', () => {
    const rows = parseLines('hello\n2026-10-01,Wallet,abc\nsomeday,Wallet,100\n2026-12-01,Wallet,100\n2026-10-01,Wallet,0', today);
    expect(rows.map(r => r.error)).toEqual([
      'Expected date, account, amount',
      'Amount not readable',
      'Date not readable',
      'Date is in the future',
      'Amount not readable',
    ]);
  });
});

describe('matchAccount', () => {
  const accounts = [
    { id: 'a', nickname: 'Salary', bank: 'HDFC Bank', kind: 'bank' },
    { id: 'b', nickname: 'Rewards', bank: 'ICICI', kind: 'Credit card' },
    { id: 'c', nickname: 'Paytm', bank: 'Paytm', kind: 'wallet' },
    { id: 'd', nickname: 'SBI', bank: 'SBI', kind: 'savings' },
  ];

  it('matches a nickname or bank first', () => {
    expect(matchAccount('rewards', accounts)).toBe('b');
    expect(matchAccount('HDFC Bank', accounts)).toBe('a');
  });

  it('matches an account type, including older type text', () => {
    expect(matchAccount('Credit Card', accounts)).toBe('b');
    expect(matchAccount('cc', accounts)).toBe('b');
    expect(matchAccount('Savings', accounts)).toBe('d');
    expect(matchAccount('wallet', accounts)).toBe('c');
  });

  it('returns null when nothing matches', () => {
    expect(matchAccount('Kotak', accounts)).toBeNull();
    expect(matchAccount('', accounts)).toBeNull();
  });
});
