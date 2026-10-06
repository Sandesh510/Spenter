import { describe, expect, it } from 'vitest';
import { monthTotals, type Txn } from './ledger';

const base = { month: '2026-10', openingPaise: 9_240_000 };

const spend = (over: Partial<Txn>): Txn => ({
  id: over.id ?? 'x',
  type: 'spend',
  amountPaise: 1000,
  txnDate: '2026-10-03',
  categoryId: 'food-wants',
  bucket: 'want',
  ...over,
});

describe('monthTotals', () => {
  it('derives balance from opening minus spend (no stored totals)', () => {
    const t = monthTotals({
      ...base,
      txns: [spend({ id: 'a', amountPaise: 64000 })],
    });
    expect(t.spendableBalancePaise).toBe(9_240_000 - 64000);
    expect(t.spentByCategory['food-wants']).toBe(64000);
  });

  it('counts savings against balance and exposes it as its own line', () => {
    const t = monthTotals({
      ...base,
      txns: [spend({ id: 'sip', amountPaise: 500_000, categoryId: 'invest', bucket: 'save' })],
    });
    expect(t.savingsPaise).toBe(500_000);
    expect(t.savingsBalancePaise).toBe(500_000);
    expect(t.spendableBalancePaise).toBe(9_240_000 - 500_000);
  });

  it('credits increase balance; refunds also reduce category spend', () => {
    const t = monthTotals({
      ...base,
      txns: [
        spend({ id: 'a', amountPaise: 30000 }),
        { id: 'r', type: 'credit', amountPaise: 10000, txnDate: '2026-10-05', categoryId: 'food-wants' },
        { id: 's', type: 'credit', amountPaise: 500000, txnDate: '2026-10-01' }, // salary, no category
      ],
    });
    expect(t.spentByCategory['food-wants']).toBe(20000);
    expect(t.incomePaise).toBe(510000);
    expect(t.spendableBalancePaise).toBe(9_240_000 + 510000 - 30000);
  });

  it('internal transfers do not change the total; external transfers do', () => {
    const internal = monthTotals({
      ...base,
      txns: [{ id: 't1', type: 'transfer', amountPaise: 100000, txnDate: '2026-10-02', fromAccountId: 'hdfc', toAccountId: 'paytm' }],
    });
    expect(internal.spendableBalancePaise).toBe(9_240_000);

    const external = monthTotals({
      ...base,
      txns: [{ id: 't2', type: 'transfer', external: true, amountPaise: 100000, txnDate: '2026-10-02', fromAccountId: 'hdfc' }],
    });
    expect(external.spendableBalancePaise).toBe(9_240_000 - 100000);
  });

  it('ignores deleted rows and rows outside the month', () => {
    const t = monthTotals({
      ...base,
      txns: [
        spend({ id: 'gone', amountPaise: 50000, deletedAt: '2026-10-04T00:00:00Z' }),
        spend({ id: 'sept', amountPaise: 50000, txnDate: '2026-09-30' }),
      ],
    });
    expect(t.spendableBalancePaise).toBe(9_240_000);
    expect(t.spentByCategory['food-wants']).toBeUndefined();
  });

  it('can go negative and reports it honestly', () => {
    const t = monthTotals({
      month: '2026-10',
      openingPaise: 1000,
      txns: [spend({ amountPaise: 5000 })],
    });
    expect(t.spendableBalancePaise).toBe(-4000);
  });
});
