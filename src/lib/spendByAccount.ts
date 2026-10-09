/**
 * Money that went out of each account this month: spend and savings entries, transfers to someone
 * outside your accounts, and money lent from the account. Transfers between your own accounts are
 * not spending, so they are left out.
 */

export interface OutflowTxn {
  type: 'spend' | 'credit' | 'transfer';
  amountPaise: number;
  accountId: string | null;
  external: boolean;
}

export interface OutflowLoan {
  amountPaise: number;
  debitAccountId: string | null;
}

export interface AccountSpend {
  accountId: string;
  paise: number;
}

/** Accounts with money out, largest first. */
export function spendByAccount(txns: OutflowTxn[], loans: OutflowLoan[]): AccountSpend[] {
  const totals = new Map<string, number>();
  const add = (id: string | null, paise: number) => {
    if (id) totals.set(id, (totals.get(id) ?? 0) + paise);
  };
  for (const t of txns) {
    if (t.type === 'spend' || (t.type === 'transfer' && t.external)) add(t.accountId, t.amountPaise);
  }
  for (const l of loans) add(l.debitAccountId, l.amountPaise);
  return [...totals.entries()].map(([accountId, paise]) => ({ accountId, paise })).filter(a => a.paise > 0).sort((a, b) => b.paise - a.paise);
}
