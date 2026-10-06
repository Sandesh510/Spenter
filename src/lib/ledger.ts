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
  deletedAt?: string | null;
}

export interface MonthInput {
  /** YYYY-MM */
  month: string;
  openingPaise: number;
  txns: Txn[];
}

export interface MonthTotals {
  openingPaise: number;
  incomePaise: number;
  /** Spend in Need and Want categories. */
  spendPaise: number;
  /** Spend in the Save bucket (e.g. SIP). */
  savingsPaise: number;
  /** Spendable balance = opening + income − spend − savings − external transfers. */
  spendableBalancePaise: number;
  /** Savings shown as its own balance line. */
  savingsBalancePaise: number;
  spentByCategory: Record<string, number>;
}

const live = (t: Txn) => !t.deletedAt;
const inMonth = (t: Txn, month: string) => t.txnDate.startsWith(month);

export function monthTotals({ month, openingPaise, txns }: MonthInput): MonthTotals {
  const rows = txns.filter(live).filter(t => inMonth(t, month));

  let incomePaise = 0;
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
      incomePaise += t.amountPaise;
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
    openingPaise + incomePaise - spendPaise - savingsPaise - externalPaise;

  return {
    openingPaise,
    incomePaise,
    spendPaise,
    savingsPaise,
    spendableBalancePaise,
    savingsBalancePaise: savingsPaise,
    spentByCategory,
  };
}
