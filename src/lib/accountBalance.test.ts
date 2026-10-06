import { describe, expect, it } from 'vitest';
import {
  accountBalance,
  accountBalances,
  cardView,
  flipCardSign,
  openingForActual,
  type BalanceAccount,
  type BalanceLoan,
  type BalanceTxn,
} from './accountBalance';

const BANK = 'bank';
const CARD = 'card';
const OTHER = 'other';

const t = (over: Partial<BalanceTxn>): BalanceTxn => ({
  type: 'spend',
  amountPaise: 1000,
  txnDate: '2026-10-05',
  accountId: BANK,
  toAccountId: null,
  ...over,
});

const bank: BalanceAccount = { id: BANK, openingPaise: 5_000_000, openingOn: '2026-10-01' };

describe('accountBalance', () => {
  it('is null when no opening balance is set', () => {
    expect(accountBalance({ id: BANK, openingPaise: null, openingOn: null }, [t({})], [])).toBeNull();
  });

  it('is the opening balance when nothing has happened since', () => {
    expect(accountBalance(bank, [], [])).toBe(5_000_000);
  });

  it('adds credits in and takes spends out', () => {
    const txns = [t({ type: 'credit', amountPaise: 300_000 }), t({ type: 'spend', amountPaise: 64_000 })];
    expect(accountBalance(bank, txns, [])).toBe(5_000_000 + 300_000 - 64_000);
  });

  it('takes transfers out and adds transfers in', () => {
    const txns = [
      t({ type: 'transfer', amountPaise: 200_000, accountId: BANK, toAccountId: OTHER }),
      t({ type: 'transfer', amountPaise: 50_000, accountId: OTHER, toAccountId: BANK }),
      t({ type: 'transfer', amountPaise: 10_000, accountId: BANK, toAccountId: null }), // to outside
    ];
    expect(accountBalance(bank, txns, [])).toBe(5_000_000 - 200_000 + 50_000 - 10_000);
  });

  it('takes out money lent from the account', () => {
    const loans: BalanceLoan[] = [
      { amountPaise: 100_000, lentOn: '2026-10-02', debitAccountId: BANK },
      { amountPaise: 999_999, lentOn: '2026-10-02', debitAccountId: OTHER },
      { amountPaise: 999_999, lentOn: '2026-10-02', debitAccountId: null },
    ];
    expect(accountBalance(bank, [], loans)).toBe(5_000_000 - 100_000);
  });

  it('counts only entries on or after the opening date', () => {
    const txns = [
      t({ txnDate: '2026-09-30', amountPaise: 777 }),
      t({ txnDate: '2026-10-01', amountPaise: 1000 }),
    ];
    const loans: BalanceLoan[] = [
      { amountPaise: 5, lentOn: '2026-09-30', debitAccountId: BANK },
      { amountPaise: 7, lentOn: '2026-10-01', debitAccountId: BANK },
    ];
    expect(accountBalance(bank, txns, loans)).toBe(5_000_000 - 1000 - 7);
  });

  it('ignores deleted entries and other accounts', () => {
    const txns = [t({ deletedAt: '2026-10-06T00:00:00Z' }), t({ accountId: OTHER })];
    expect(accountBalance(bank, txns, [])).toBe(5_000_000);
  });

  it('runs a credit card: purchases add to what is owed, a bill payment brings it down', () => {
    const card: BalanceAccount = { id: CARD, openingPaise: -1_200_000, openingOn: '2026-10-01' };
    const txns = [
      t({ accountId: CARD, amountPaise: 300_000 }), // purchase on the card
      t({ type: 'transfer', accountId: BANK, toAccountId: CARD, amountPaise: 1_000_000 }), // bill payment
    ];
    const balance = accountBalance(card, txns, []);
    expect(balance).toBe(-1_200_000 - 300_000 + 1_000_000);
    expect(cardView('credit_card', balance)).toEqual({ outstandingPaise: 500_000 });
  });
});

describe('accountBalances', () => {
  it('matches accountBalance for every account in one pass', () => {
    const accounts: BalanceAccount[] = [
      bank,
      { id: CARD, openingPaise: -50_000, openingOn: '2026-10-03' },
      { id: OTHER, openingPaise: null, openingOn: null },
    ];
    const txns = [
      t({ txnDate: '2026-10-02', accountId: CARD, amountPaise: 1 }),
      t({ accountId: CARD, amountPaise: 20_000 }),
      t({ type: 'transfer', accountId: BANK, toAccountId: CARD, amountPaise: 40_000 }),
      t({ type: 'credit', accountId: BANK, amountPaise: 90_000 }),
      t({ type: 'credit', accountId: OTHER, amountPaise: 90_000 }),
      t({ deletedAt: 'x', amountPaise: 123 }),
    ];
    const loans: BalanceLoan[] = [{ amountPaise: 3_000, lentOn: '2026-10-04', debitAccountId: BANK }];
    const all = accountBalances(accounts, txns, loans);
    for (const a of accounts) expect(all.get(a.id)).toBe(accountBalance(a, txns, loans));
    expect(all.get(OTHER)).toBeNull();
  });
});

describe('openingForActual (Match my bank)', () => {
  it('sets an opening so the balance shown equals the actual balance', () => {
    const today = '2026-10-07';
    const txns = [
      t({ txnDate: '2026-10-07', amountPaise: 40_000 }),
      t({ type: 'credit', txnDate: '2026-10-07', amountPaise: 10_000 }),
      t({ txnDate: '2026-10-06', amountPaise: 99_999 }),
    ];
    const loans: BalanceLoan[] = [{ amountPaise: 5_000, lentOn: today, debitAccountId: BANK }];
    const opening = openingForActual(BANK, 2_345_600, today, txns, loans);
    expect(opening).toBe(2_345_600 + 40_000 - 10_000 + 5_000);
    expect(accountBalance({ id: BANK, openingPaise: opening, openingOn: today }, txns, loans)).toBe(2_345_600);
  });
});

describe('cardView', () => {
  it('is null for other kinds and when no balance is set', () => {
    expect(cardView('bank', -100)).toBeNull();
    expect(cardView('credit_card', null)).toBeNull();
  });

  it('reads older free-text card kinds', () => {
    expect(cardView('Credit card', -2_500)).toEqual({ outstandingPaise: 2_500 });
  });

  it('owes nothing when the card is paid ahead', () => {
    expect(cardView('credit_card', 10_000)).toEqual({ outstandingPaise: 0 });
  });
});

describe('flipCardSign', () => {
  it('turns what is owed into a negative balance and back for cards', () => {
    expect(flipCardSign('2500', true)).toBe('-2500');
    expect(flipCardSign('-2500', true)).toBe('2500');
    expect(flipCardSign('−2500', true)).toBe('2500');
    expect(flipCardSign(' ', true)).toBe('');
  });

  it('leaves other accounts as typed', () => {
    expect(flipCardSign('-2500', false)).toBe('-2500');
    expect(flipCardSign('2500', false)).toBe('2500');
  });
});
