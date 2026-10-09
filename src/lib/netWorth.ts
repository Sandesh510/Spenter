/**
 * Net worth: what you hold, less what you owe, from the figures SpendCheck already tracks.
 *
 * Assets: account balances above zero, savings plans (their saved amount), and money lent that is still
 * to come back. Liabilities: what credit cards owe, loans still being paid off by EMIs, and any other
 * account that is below zero.
 *
 * Savings contributions leave the account they are paid from, so a plan's saved amount and that
 * account's balance never count the same money twice. Accounts without an opening balance have no
 * balance to count; they are reported separately so the total is not mistaken for complete.
 */

import { isCreditCard } from './accountTypes';

export interface NetWorthAccount {
  id: string;
  nickname: string;
  kind: string | null;
  balance_paise?: number | null;
}

export interface NetWorthPlan {
  id: string;
  name: string;
  saved_paise: number;
  active: boolean;
}

export interface NetWorthLoan {
  id: string;
  name: string;
  /** What is still owed on the loan. */
  outstandingPaise: number;
}

export interface Line {
  id: string;
  label: string;
  paise: number;
}

export interface NetWorth {
  assets: { accounts: Line[]; savings: Line[]; lentPaise: number; totalPaise: number };
  liabilities: { cards: Line[]; loans: Line[]; overdrawn: Line[]; totalPaise: number };
  netPaise: number;
  /** Accounts with no balance to count (no opening balance set). */
  untrackedAccounts: string[];
}

const sum = (lines: Line[]) => lines.reduce((s, l) => s + l.paise, 0);

export function netWorth(args: {
  accounts: NetWorthAccount[];
  plans: NetWorthPlan[];
  loans: NetWorthLoan[];
  /** Money lent that is still to come back, in total. */
  lentOutstandingPaise: number;
}): NetWorth {
  const accounts: Line[] = [];
  const cards: Line[] = [];
  const overdrawn: Line[] = [];
  const untracked: string[] = [];
  for (const a of args.accounts) {
    const b = a.balance_paise;
    if (b === null || b === undefined) {
      untracked.push(a.nickname);
    } else if (b >= 0) {
      if (b > 0) accounts.push({ id: a.id, label: a.nickname, paise: b });
    } else if (isCreditCard(a.kind)) {
      cards.push({ id: a.id, label: a.nickname, paise: -b });
    } else {
      overdrawn.push({ id: a.id, label: a.nickname, paise: -b });
    }
  }
  const savings: Line[] = args.plans.filter(p => p.active && p.saved_paise > 0).map(p => ({ id: p.id, label: p.name, paise: p.saved_paise }));
  const loans: Line[] = args.loans.filter(l => l.outstandingPaise > 0).map(l => ({ id: l.id, label: l.name, paise: l.outstandingPaise }));
  const lentPaise = Math.max(0, args.lentOutstandingPaise);

  const assetsTotal = sum(accounts) + sum(savings) + lentPaise;
  const liabilitiesTotal = sum(cards) + sum(loans) + sum(overdrawn);
  return {
    assets: { accounts, savings, lentPaise, totalPaise: assetsTotal },
    liabilities: { cards, loans, overdrawn, totalPaise: liabilitiesTotal },
    netPaise: assetsTotal - liabilitiesTotal,
    untrackedAccounts: untracked,
  };
}
