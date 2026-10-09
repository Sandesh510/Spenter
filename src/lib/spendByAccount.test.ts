import { describe, expect, it } from 'vitest';
import { spendByAccount, type OutflowTxn } from './spendByAccount';

const t = (type: OutflowTxn['type'], amountPaise: number, accountId: string | null, external = false): OutflowTxn => ({ type, amountPaise, accountId, external });

describe('spendByAccount', () => {
  it('adds spend per account, largest first', () => {
    expect(spendByAccount([t('spend', 100, 'a'), t('spend', 500, 'b'), t('spend', 50, 'a')], [])).toEqual([
      { accountId: 'b', paise: 500 },
      { accountId: 'a', paise: 150 },
    ]);
  });

  it('counts outside transfers and money lent, not transfers between your accounts or money in', () => {
    const r = spendByAccount([t('transfer', 200, 'a', true), t('transfer', 900, 'a'), t('credit', 700, 'a')], [{ amountPaise: 300, debitAccountId: 'a' }, { amountPaise: 80, debitAccountId: null }]);
    expect(r).toEqual([{ accountId: 'a', paise: 500 }]);
  });

  it('is empty when nothing went out', () => {
    expect(spendByAccount([], [])).toEqual([]);
  });
});
