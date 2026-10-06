/**
 * Single source of truth for all totals. Home, Log, Trends and the verdict
 * all read from these functions — nothing stores a running total.
 */

export type Bucket = 'need' | 'want' | 'save';

export interface Txn {
  id: string;
  type: 'spend' | 'credit' | 'transfer';
  amountPaise: number;
  /** YYYY-MM-DD in Asia/Kolkata */
  txnDate: string;
  /** Required for spend. Optional for credit: if set, it's a refund against that category. */
  categoryId?: string;
  bucket?: Bucket;
  fromAccountId?: string;
  toAccountId?: string;
  /** Transfer to a destination outside the tracked accounts (e.g. a UPI payment to a person). Counts as spend. */
  external?: boolean;
  /**
   * For credits: what kind of money came in. Only 'income' (salary, others, refunds) is income.
   * 'returned' is money lent and got back; 'borrowed' is a loan received. Both still add to the balance.
   */
  creditKind?: CreditKind;
  deletedAt?: string | null;
}

export type CreditKind = 'income' | 'returned' | 'borrowed';

export interface MonthInput {
  /** YYYY-MM */
  month: string;
  openingPaise: number;
  txns: Txn[];
  /** Money lent to people this month. It leaves the balance; Got back credits bring it back. */
  lentOutPaise?: number;
}

export interface MonthTotals {
  openingPaise: number;
  /** Earned money only: salary, others and refunds. Not got back, not borrowed. */
  incomePaise: number;
  /** Lent money that came back this month. */
  returnedPaise: number;
  /** Loans received this month. */
  borrowedPaise: number;
  /** Money lent this month. */
  lentOutPaise: number;
  /** Spend in Need and Want categories. */
  spendPaise: number;
  /** Spend in the Save bucket (e.g. SIP). */
  savingsPaise: number;
  /** Spendable balance = opening + income + got back + borrowed − spend − savings − external transfers − lent out. */
  spendableBalancePaise: number;
  /** Savings shown as its own balance line. */
  savingsBalancePaise: number;
  spentByCategory: Record<string, number>;
}

const live = (t: Txn) => !t.deletedAt;
const inMonth = (t: Txn, month: string) => t.txnDate.startsWith(month);

export function monthTotals({ month, openingPaise, txns, lentOutPaise = 0 }: MonthInput): MonthTotals {
  const rows = txns.filter(live).filter(t => inMonth(t, month));

  let incomePaise = 0;
  let returnedPaise = 0;
  let borrowedPaise = 0;
  let spendPaise = 0;
  let savingsPaise = 0;
  let externalPaise = 0;
  const spentByCategory: Record<string, number> = {};

  for (const t of rows) {
    if (t.type === 'credit') {
      if (t.categoryId) {
        // Refund: reduces what was spent in that category, and returns money to the balance.
        spentByCategory[t.categoryId] = (spentByCategory[t.categoryId] ?? 0) - t.amountPaise;
      }
      if (t.creditKind === 'returned') returnedPaise += t.amountPaise;
      else if (t.creditKind === 'borrowed') borrowedPaise += t.amountPaise;
      else incomePaise += t.amountPaise;
    } else if (t.type === 'spend') {
      if (t.bucket === 'save') savingsPaise += t.amountPaise;
      else spendPaise += t.amountPaise;
      if (t.categoryId) {
        spentByCategory[t.categoryId] = (spentByCategory[t.categoryId] ?? 0) + t.amountPaise;
      }
    } else if (t.type === 'transfer' && t.external) {
      // Money leaving the tracked accounts is a real outflow.
      externalPaise += t.amountPaise;
    }
    // Internal transfers (between tracked accounts) move money but don't change the total.
  }

  const spendableBalancePaise =
    openingPaise + incomePaise + returnedPaise + borrowedPaise - spendPaise - savingsPaise - externalPaise - lentOutPaise;

  return {
    openingPaise,
    incomePaise,
    returnedPaise,
    borrowedPaise,
    lentOutPaise,
    spendPaise,
    savingsPaise,
    spendableBalancePaise,
    savingsBalancePaise: savingsPaise,
    spentByCategory,
  };
}
