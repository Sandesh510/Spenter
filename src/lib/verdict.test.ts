import { describe, expect, it } from 'vitest';
import { checkPurchase } from './verdict';

const base = { bucket: 'want' as const, planPaise: 300000, spentPaise: 220000, spendableBalancePaise: 5_000_000 };

describe('checkPurchase', () => {
  it('fits when the amount is within the remaining category plan', () => {
    const v = checkPurchase({ ...base, amountPaise: 60000 });
    expect(v.status).toBe('fits');
    expect(v.remainingPaise).toBe(80000);
    expect(v.afterPaise).toBe(20000);
    expect(v.overByPaise).toBe(0);
    expect(v.cannotAfford).toBe(false);
  });

  it('fits exactly when the amount equals the remaining plan', () => {
    expect(checkPurchase({ ...base, amountPaise: 80000 }).status).toBe('fits');
  });

  it('is over plan by the amount beyond what is left', () => {
    const v = checkPurchase({ ...base, amountPaise: 100000 });
    expect(v.status).toBe('over_plan');
    expect(v.overByPaise).toBe(20000);
  });

  it('when the category is already over, the whole amount is over', () => {
    const v = checkPurchase({ ...base, spentPaise: 350000, amountPaise: 10000 });
    expect(v.status).toBe('over_plan');
    expect(v.remainingPaise).toBe(-50000);
    expect(v.overByPaise).toBe(10000);
  });

  it('with no budget set, it says so instead of reporting over-by-full-amount', () => {
    const v = checkPurchase({ ...base, planPaise: null, amountPaise: 50000 });
    expect(v.status).toBe('no_budget');
    expect(v.overByPaise).toBe(0);
  });

  it('flags cannot-afford independently of the category budget', () => {
    const v = checkPurchase({ ...base, spendableBalancePaise: 40000, amountPaise: 60000 });
    expect(v.status).toBe('fits');
    expect(v.cannotAfford).toBe(true);
  });

  it('savings bucket asks about the goal, not the spend plan', () => {
    const v = checkPurchase({ ...base, bucket: 'save', amountPaise: 999999 });
    expect(v.status).toBe('savings');
    expect(v.overByPaise).toBe(0);
  });
});
