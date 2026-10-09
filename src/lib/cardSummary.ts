/**
 * What the month's credit card use means for the balance.
 *
 * Balance left to spend already subtracts every card purchase on the day it is made, and paying the
 * card bill is a transfer, so it changes nothing. Home therefore shows the same money two ways:
 * what is in your accounts (before the card bill) and what is left once the card is paid.
 *
 *   in your accounts = balance left to spend + card still to pay
 *
 * Spending and borrowing are kept apart. Money lent from a card, or moved out of it to someone, is owed
 * on the bill but is not spending, so it never counts as card spend (Trends), even after it has come back.
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
  categoryId?: string | null;
}

export interface CardLoan {
  amountPaise: number;
  debitAccountId: string | null;
}

export interface CardSummary {
  /** Spent on cards this month: spend and savings entries only. */
  spentPaise: number;
  /** Owed on the bill but not spending: money lent from a card, and money moved out of a card. */
  otherPaise: number;
  /** Card bill payments this month (transfers into a card account). */
  paidPaise: number;
  /** Still to pay: spent plus other, less paid, never below zero. */
  duePaise: number;
  /** Card spend by category id, for Trends. */
  byCategoryPaise: Record<string, number>;
}

/** Null when there are no card accounts, so Home shows nothing extra. */
export function cardSummary(cardIds: Set<string>, txns: CardTxn[], loans: CardLoan[]): CardSummary | null {
  if (cardIds.size === 0) return null;
  const onCard = (id: string | null) => id !== null && cardIds.has(id);

  let spent = 0;
  let other = 0;
  let paid = 0;
  const byCategory: Record<string, number> = {};
  for (const t of txns) {
    if (t.type === 'spend' && onCard(t.accountId)) {
      spent += t.amountPaise;
      if (t.categoryId) byCategory[t.categoryId] = (byCategory[t.categoryId] ?? 0) + t.amountPaise;
    } else if (t.type === 'transfer') {
      if (onCard(t.toAccountId) && !onCard(t.accountId)) paid += t.amountPaise;
      // Money moved out of a card (a cash advance, or a payment to someone) is owed too, but it is not spending.
      else if (onCard(t.accountId) && !onCard(t.toAccountId)) other += t.amountPaise;
    }
  }
  for (const l of loans) if (onCard(l.debitAccountId)) other += l.amountPaise;

  return { spentPaise: spent, otherPaise: other, paidPaise: paid, duePaise: Math.max(0, spent + other - paid), byCategoryPaise: byCategory };
}
