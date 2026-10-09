import { describe, expect, it } from 'vitest';
import { spendByAccount, type OutflowTxn } from './spendByAccount';

const t = (type: OutflowTxn['type'], amountPaise: number, accountId: string | null): OutflowTxn => ({ type, amountPaise, accountId });

describe('spendByAccount', () => {
  it('adds spend per account, largest first', () => {
    expect(spendByAccount([t('spend', 100, 'a'), t('spend', 500, 'b'), t('spend', 50, 'a')])).toEqual([
      { accountId: 'b', paise: 500 },
      { accountId: 'a', paise: 150 },
    ]);
  });

  it('leaves out transfers and money in', () => {
    expect(spendByAccount([t('transfer', 200, 'a'), t('credit', 700, 'a'), t('spend', 40, 'a')])).toEqual([{ accountId: 'a', paise: 40 }]);
  });

  it('is empty when nothing was spent', () => {
    expect(spendByAccount([])).toEqual([]);
  });
});
