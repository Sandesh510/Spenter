/**
 * Balance per account, derived and never stored. The user sets an opening balance at the start of one
 * day; the balance is that plus every live entry for the account dated on or after that day.
 * Used by the server (accounts list, Match my bank) and by tests. Shared by client and server.
 */

import { isCreditCard } from './accountTypes';

export interface BalanceTxn {
  type: 'spend' | 'credit' | 'transfer';
  amountPaise: number;
  /** YYYY-MM-DD */
  txnDate: string;
  /** The account money left (spend, transfer) or came into (credit). */
  accountId: string | null;
  /** The destination of an internal transfer. Null for spend, credit and transfers to outside. */
  toAccountId: string | null;
  deletedAt?: string | null;
}

export interface BalanceLoan {
  amountPaise: number;
  /** YYYY-MM-DD */
  lentOn: string;
  /** The account the lent money left from, when known. */
  debitAccountId: string | null;
}

export interface BalanceAccount {
  id: string;
  /** Balance at the start of openingOn, before that day's entries. Negative for an amount owed. */
  openingPaise: number | null;
  /** YYYY-MM-DD */
  openingOn: string | null;
}

/**
 * How an entry moves one account's balance, in paise. Credits in add; spends and transfers out take away;
 * transfers in add. Entries that don't touch the account are 0.
 */
export function effectOn(accountId: string, t: BalanceTxn): number {
  if (t.deletedAt) return 0;
  let delta = 0;
  if (t.accountId === accountId) {
    if (t.type === 'credit') delta += t.amountPaise;
    else delta -= t.amountPaise; // spend, or a transfer out (to another account or outside)
  }
  if (t.type === 'transfer' && t.toAccountId === accountId) delta += t.amountPaise;
  return delta;
}

/**
 * Net change to an account from entries and money lent dated on or after `from`.
 * `from` is YYYY-MM-DD; string comparison works because dates are zero-padded.
 */
export function netSince(accountId: string, from: string, txns: BalanceTxn[], loans: BalanceLoan[]): number {
  let net = 0;
  for (const t of txns) if (t.txnDate >= from) net += effectOn(accountId, t);
  for (const l of loans) if (l.debitAccountId === accountId && l.lentOn >= from) net -= l.amountPaise;
  return net;
}

/** An account's balance now, or null when it has no opening balance. */
export function accountBalance(account: BalanceAccount, txns: BalanceTxn[], loans: BalanceLoan[]): number | null {
  if (account.openingPaise === null || account.openingOn === null) return null;
  return account.openingPaise + netSince(account.id, account.openingOn, txns, loans);
}

/**
 * Balances for many accounts in one pass over the entries, for the accounts list.
 * Same result as calling accountBalance for each account.
 */
export function accountBalances(accounts: BalanceAccount[], txns: BalanceTxn[], loans: BalanceLoan[]): Map<string, number | null> {
  const out = new Map<string, number | null>();
  const opening = new Map<string, { paise: number; on: string }>();
  for (const a of accounts) {
    if (a.openingPaise === null || a.openingOn === null) {
      out.set(a.id, null);
    } else {
      opening.set(a.id, { paise: a.openingPaise, on: a.openingOn });
      out.set(a.id, a.openingPaise);
    }
  }
  const add = (id: string | null, date: string, delta: number) => {
    if (!id) return;
    const o = opening.get(id);
    if (!o || date < o.on) return;
    out.set(id, (out.get(id) ?? 0) + delta);
  };
  for (const t of txns) {
    if (t.deletedAt) continue;
    if (t.type === 'credit') add(t.accountId, t.txnDate, t.amountPaise);
    else add(t.accountId, t.txnDate, -t.amountPaise);
    if (t.type === 'transfer') add(t.toAccountId, t.txnDate, t.amountPaise);
  }
  for (const l of loans) add(l.debitAccountId, l.lentOn, -l.amountPaise);
  return out;
}

/**
 * Match my bank: the opening balance to store from `today` so the shown balance equals `actualPaise`.
 * Every entry dated today or later already counts in the balance, so it is taken back out of the opening.
 */
export function openingForActual(accountId: string, actualPaise: number, today: string, txns: BalanceTxn[], loans: BalanceLoan[]): number {
  return actualPaise - netSince(accountId, today, txns, loans);
}

export interface CardView {
  /** What is owed on the card: max(0, −balance). */
  outstandingPaise: number;
}

/** For a credit card, the amount owed. Null for other kinds or when no balance is set. */
export function cardView(kind: unknown, balancePaise: number | null): CardView | null {
  if (!isCreditCard(kind) || balancePaise === null) return null;
  return { outstandingPaise: Math.max(0, -balancePaise) };
}

/**
 * Cards are entered as what is owed (positive), and stored as a negative balance. This flips a typed
 * card figure to the stored sign and back: "2500" ↔ "-2500". Other kinds pass through unchanged.
 */
export function flipCardSign(input: string, card: boolean): string {
  const t = input.trim();
  if (!card || t === '') return t;
  if (/^[-−]/.test(t)) return t.slice(1).trim();
  return `-${t}`;
}
