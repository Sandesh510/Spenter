import { describe, expect, it } from 'vitest';
import { cardsOwedBefore, type BalanceTxn } from './accountBalance';
import { cardSummary, type CardTxn } from './cardSummary';
import { monthTotals, type Txn } from './ledger';

/** The path Home takes: raw rows → card debt at month start → balance and card bill. */
const card = { id: 'card', openingPaise: 0, openingOn: '2026-10-01' };
const row = (type: BalanceTxn['type'], amountPaise: number, txnDate: string, accountId: string, toAccountId: string | null = null): BalanceTxn => ({ type, amountPaise, txnDate, accountId, toAccountId });

function home(month: string, opening: number, rows: BalanceTxn[], cardAcc = card, rollbackUntil = '2026-12-01') {
  const first = `${month}-01`;
  const carried = cardsOwedBefore([cardAcc], first, rows, [], rollbackUntil);
  const inMonth = rows.filter(r => r.txnDate.startsWith(month));
  const ledger: Txn[] = inMonth.map((r, i) => ({ id: String(i), type: r.type, amountPaise: r.amountPaise, txnDate: r.txnDate, categoryId: r.type === 'spend' ? 'c' : undefined, fromAccountId: r.accountId ?? undefined, toAccountId: r.toAccountId ?? undefined }));
  const cardTxns: CardTxn[] = inMonth.map(r => ({ type: r.type, amountPaise: r.amountPaise, accountId: r.accountId, toAccountId: r.toAccountId, external: false }));
  return {
    left: monthTotals({ month, openingPaise: opening, txns: ledger, cardDebtPaise: carried }).spendableBalancePaise,
    card: cardSummary(new Set(['card']), cardTxns, [], carried)!,
    carried,
  };
}

describe('card debt carried across months, from raw rows', () => {
  const oct = [row('spend', 3_500_000, '2026-10-12', 'card')];

  it('the example: typed 50,000, 35,000 owed from October, paid by transfer in November', () => {
    const pay = row('transfer', 3_500_000, '2026-11-05', 'bank', 'card');
    const before = home('2026-11', 5_000_000, oct);
    const after = home('2026-11', 5_000_000, [...oct, pay]);
    expect(before.left).toBe(1_500_000);
    expect(before.card.duePaise).toBe(3_500_000);
    expect(after.left).toBe(1_500_000);
    expect(after.card.duePaise).toBe(0);
  });

  it('a card matched to the bank part-way through the month still carries its debt in', () => {
    // Match my bank on 10 Nov: the card owes 20,000 that day; 5,000 was spent on it on 3 Nov.
    const matched = { id: 'card', openingPaise: -2_000_000, openingOn: '2026-11-10' };
    const rows = [row('spend', 500_000, '2026-11-03', 'card')];
    expect(home('2026-11', 5_000_000, rows, matched, '2026-12-01').carried).toBe(1_500_000);
  });

  it('this month\'s bill still to pay equals next month\'s carried debt, with refunds and payments', () => {
    const rows = [
      row('spend', 3_500_000, '2026-10-12', 'card'),
      row('spend', 800_000, '2026-11-02', 'card'),
      row('credit', 300_000, '2026-11-09', 'card'),
      row('transfer', 1_000_000, '2026-11-15', 'bank', 'card'),
    ];
    const nov = home('2026-11', 5_000_000, rows);
    expect(nov.card.refundedPaise).toBe(300_000);
    expect(nov.card.duePaise).toBe(3_500_000 + 800_000 - 300_000 - 1_000_000);
    expect(cardsOwedBefore([card], '2026-12-01', rows, [])).toBe(nov.card.duePaise);
  });
});
