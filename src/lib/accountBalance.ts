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
 * An account's balance at the start of `before` (YYYY-MM-DD), before that day's entries. Null when the
 * account has no opening balance, or the opening is dated on or after `before` and no `rollbackUntil` is given.
 *
 * Match my bank stores the opening "from today", so a card matched part-way through a month has an opening
 * dated inside it. With `rollbackUntil` (the end of that month), an opening dated before it is wound back:
 * the opening less the entries from `before` up to the opening date.
 */
export function balanceBefore(account: BalanceAccount, before: string, txns: BalanceTxn[], loans: BalanceLoan[], rollbackUntil?: string): number | null {
  if (account.openingPaise === null || account.openingOn === null) return null;
  if (account.openingOn >= before) {
    if (!rollbackUntil || account.openingOn >= rollbackUntil) return null;
    let net = 0;
    for (const t of txns) if (t.txnDate >= before && t.txnDate < account.openingOn) net += effectOn(account.id, t);
    for (const l of loans) if (l.debitAccountId === account.id && l.lentOn >= before && l.lentOn < account.openingOn) net -= l.amountPaise;
    return account.openingPaise - net;
  }
  let net = 0;
  for (const t of txns) if (t.txnDate >= account.openingOn && t.txnDate < before) net += effectOn(account.id, t);
  for (const l of loans) if (l.debitAccountId === account.id && l.lentOn >= account.openingOn && l.lentOn < before) net -= l.amountPaise;
  return account.openingPaise + net;
}

/** What the given card accounts owed in total at the start of `before`; a card in credit counts as 0. */
export function cardsOwedBefore(cards: BalanceAccount[], before: string, txns: BalanceTxn[], loans: BalanceLoan[], rollbackUntil?: string): number {
  let owed = 0;
  for (const c of cards) {
    const b = balanceBefore(c, before, txns, loans, rollbackUntil);
    if (b !== null && b < 0) owed += -b;
  }
  return owed;
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
  /** Limit − owed, or null when no limit is set. Negative when the card is over its limit. */
  availablePaise: number | null;
}

/** For a credit card, the amount owed and the credit left. Null for other kinds or when no balance is set. */
export function cardView(kind: unknown, balancePaise: number | null, limitPaise: number | null = null): CardView | null {
  if (!isCreditCard(kind) || balancePaise === null) return null;
  const outstandingPaise = Math.max(0, -balancePaise);
  return { outstandingPaise, availablePaise: limitPaise === null ? null : limitPaise - outstandingPaise };
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
