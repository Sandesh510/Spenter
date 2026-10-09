/**
 * What was spent from each account this month: spend and savings entries only.
 * Money lent and transfers to someone outside your accounts are not spending (they have their own lines
 * in Money in and out and still change the account's balance), and transfers between your own accounts
 * move money without spending it.
 */

export interface OutflowTxn {
  type: 'spend' | 'credit' | 'transfer';
  amountPaise: number;
  accountId: string | null;
}

export interface AccountSpend {
  accountId: string;
  paise: number;
}

/** Accounts with spending, largest first. */
export function spendByAccount(txns: OutflowTxn[]): AccountSpend[] {
  const totals = new Map<string, number>();
  for (const t of txns) {
    if (t.type === 'spend' && t.accountId) totals.set(t.accountId, (totals.get(t.accountId) ?? 0) + t.amountPaise);
  }
  return [...totals.entries()].map(([accountId, paise]) => ({ accountId, paise })).filter(a => a.paise > 0).sort((a, b) => b.paise - a.paise);
}
