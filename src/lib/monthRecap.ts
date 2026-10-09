import { daysInMonth, shiftMonth } from './dates';

/**
 * This month so far, set against the same days of last month.
 * Spending means spend entries outside Savings categories (savings are tracked against their own budget).
 * Comparing the same days, not the whole of last month, keeps the first weeks of a month fair.
 */

export interface RecapTxn {
  type: 'spend' | 'credit' | 'transfer';
  amount_paise: number;
  txn_date: string;
  category_id: string | null;
}

export interface RecapCategory {
  id: string;
  name: string;
  bucket: 'need' | 'want' | 'save';
}

export interface CategoryChange {
  categoryId: string;
  name: string;
  thisPaise: number;
  lastPaise: number;
  diffPaise: number;
}

export interface MonthRecap {
  /** Day of the month today is, so how many days are compared. */
  day: number;
  thisPaise: number;
  /** Last month, first `day` days. */
  lastSamePaise: number;
  /** Last month, the whole month. */
  lastFullPaise: number;
  /** Change since the same days last month, in percent. Null when last month had nothing to compare. */
  changePct: number | null;
  perDayThisPaise: number;
  perDayLastPaise: number;
  /** Categories that moved most, biggest rupee change first. */
  changes: CategoryChange[];
}

export function monthRecap(args: {
  today: string;
  thisMonth: RecapTxn[];
  lastMonth: RecapTxn[];
  categories: RecapCategory[];
  maxChanges?: number;
}): MonthRecap | null {
  const { today, thisMonth, lastMonth, categories, maxChanges = 4 } = args;
  const day = Number(today.slice(8, 10));
  const nonSaving = new Map(categories.filter(c => c.bucket !== 'save').map(c => [c.id, c.name]));
  const spendOf = (t: RecapTxn) => t.type === 'spend' && t.category_id !== null && nonSaving.has(t.category_id);
  const dayOf = (t: RecapTxn) => Number(t.txn_date.slice(8, 10));

  const thisBy = new Map<string, number>();
  const lastSameBy = new Map<string, number>();
  let thisPaise = 0;
  let lastSamePaise = 0;
  let lastFullPaise = 0;
  for (const t of thisMonth) {
    if (!spendOf(t)) continue;
    thisPaise += t.amount_paise;
    thisBy.set(t.category_id as string, (thisBy.get(t.category_id as string) ?? 0) + t.amount_paise);
  }
  for (const t of lastMonth) {
    if (!spendOf(t)) continue;
    lastFullPaise += t.amount_paise;
    if (dayOf(t) <= day) {
      lastSamePaise += t.amount_paise;
      lastSameBy.set(t.category_id as string, (lastSameBy.get(t.category_id as string) ?? 0) + t.amount_paise);
    }
  }
  if (thisPaise === 0 && lastFullPaise === 0) return null;

  const prevMonth = shiftMonth(today.slice(0, 7), -1);

  const ids = new Set([...thisBy.keys(), ...lastSameBy.keys()]);
  const changes = [...ids]
    .map(id => ({
      categoryId: id,
      name: nonSaving.get(id) ?? '',
      thisPaise: thisBy.get(id) ?? 0,
      lastPaise: lastSameBy.get(id) ?? 0,
      diffPaise: (thisBy.get(id) ?? 0) - (lastSameBy.get(id) ?? 0),
    }))
    .filter(c => c.diffPaise !== 0)
    .sort((a, b) => Math.abs(b.diffPaise) - Math.abs(a.diffPaise))
    .slice(0, maxChanges);

  return {
    day,
    thisPaise,
    lastSamePaise,
    lastFullPaise,
    changePct: lastSamePaise > 0 ? Math.round(((thisPaise - lastSamePaise) / lastSamePaise) * 100) : null,
    // Whole rupees: a daily average to the paisa reads as false precision.
    perDayThisPaise: Math.round(thisPaise / day / 100) * 100,
    perDayLastPaise: Math.round(lastFullPaise / daysInMonth(prevMonth) / 100) * 100,
    changes,
  };
}
