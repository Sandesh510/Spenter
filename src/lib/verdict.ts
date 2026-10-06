import type { Bucket } from './ledger';

export interface VerdictInput {
  amountPaise: number;
  bucket: Bucket;
  /** Monthly plan for the category. null or 0 means no budget is set. */
  planPaise: number | null;
  /** Spent in this category so far this month (already net of refunds). */
  spentPaise: number;
  /** Spendable balance for this month, from monthTotals(). */
  spendableBalancePaise: number;
}

export type VerdictStatus = 'fits' | 'over_plan' | 'no_budget' | 'savings';

export interface Verdict {
  status: VerdictStatus;
  /** True when the amount exceeds the whole spendable balance, regardless of category budget. */
  cannotAfford: boolean;
  /** Left in the category plan before this purchase (negative if already over). */
  remainingPaise: number | null;
  /** How far past the plan this purchase takes the category. 0 if it fits. */
  overByPaise: number;
  /** Category remaining after this purchase. */
  afterPaise: number | null;
}

/**
 * "Should I buy this?" — advisory only. It never blocks saving.
 *
 *  - Savings bucket: the question is whether it reduces the savings goal, so no plan check.
 *  - No plan set: we do NOT report "over by the full amount"; we say no budget exists.
 *  - Balance check is independent of the category check (cannotAfford can be true alongside fits).
 */
export function checkPurchase(input: VerdictInput): Verdict {
  const { amountPaise, bucket, planPaise, spentPaise, spendableBalancePaise } = input;
  const cannotAfford = amountPaise > spendableBalancePaise;

  if (bucket === 'save') {
    return { status: 'savings', cannotAfford, remainingPaise: null, overByPaise: 0, afterPaise: null };
  }

  if (!planPaise || planPaise <= 0) {
    return { status: 'no_budget', cannotAfford, remainingPaise: null, overByPaise: 0, afterPaise: null };
  }

  const remainingPaise = planPaise - spentPaise;
  const afterPaise = remainingPaise - amountPaise;

  if (amountPaise <= remainingPaise) {
    return { status: 'fits', cannotAfford, remainingPaise, overByPaise: 0, afterPaise };
  }

  const overByPaise = amountPaise - Math.max(remainingPaise, 0);
  return { status: 'over_plan', cannotAfford, remainingPaise, overByPaise, afterPaise };
}
