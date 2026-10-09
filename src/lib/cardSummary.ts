/**
 * What the month's credit card use means for the balance.
 *
 * Balance left to spend already subtracts every card purchase on the day it is made, and paying the
 * card bill is a transfer, so it changes nothing. Home therefore shows the same money two ways:
 * what is in your accounts (before the card bill) and what is left once the card is paid.
 *
 *   in your accounts = balance left to spend + card still to pay
 *
 * This is worked out for one month at a time: entries on the card this month, less bill payments
 * made this month. It never goes below zero, so paying last month's bill does not add money.
 */

export interface CardTxn {
  type: 'spend' | 'credit' | 'transfer';
  amountPaise: number;
  accountId: string | null;
  toAccountId: string | null;
  external: boolean;
}

export interface CardLoan {
  amountPaise: number;
  debitAccountId: string | null;
}

export interface CardSummary {
  /** Put on cards this month: spend, savings, money lent and transfers out. */
  spentPaise: number;
  /** Card bill payments this month (transfers into a card account). */
  paidPaise: number;
  /** Still to pay: spent less paid, never below zero. */
  duePaise: number;
}

/** Null when there are no card accounts, so Home shows nothing extra. */
export function cardSummary(cardIds: Set<string>, txns: CardTxn[], loans: CardLoan[]): CardSummary | null {
  if (cardIds.size === 0) return null;
  const onCard = (id: string | null) => id !== null && cardIds.has(id);

  let spent = 0;
  let paid = 0;
  for (const t of txns) {
    if (t.type === 'spend' && onCard(t.accountId)) spent += t.amountPaise;
    else if (t.type === 'transfer') {
      if (onCard(t.toAccountId) && !onCard(t.accountId)) paid += t.amountPaise;
      // Money moved out of a card (a cash advance, or a payment to someone) is owed too.
      else if (onCard(t.accountId) && !onCard(t.toAccountId)) spent += t.amountPaise;
    }
  }
  for (const l of loans) if (onCard(l.debitAccountId)) spent += l.amountPaise;

  return { spentPaise: spent, paidPaise: paid, duePaise: Math.max(0, spent - paid) };
}
