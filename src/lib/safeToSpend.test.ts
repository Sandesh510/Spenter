import { describe, expect, it } from 'vitest';
import { billsStillDue, safeToSpend } from './safeToSpend';

const today = '2026-10-07';
const sub = { name: 'Netflix', amountPaise: 649_00, day: 15, startsOn: '2026-01-01', active: true };

describe('bills still due this month', () => {
  it('counts a commitment whose day is still ahead', () => {
    const bills = billsStillDue({ today, commitments: [sub], policies: [] });
    expect(bills).toEqual([{ name: 'Netflix', amountPaise: 649_00, dueOn: '2026-10-15' }]);
  });

  it('skips commitments already due (posted), paused, or not started', () => {
    const bills = billsStillDue({
      today,
      commitments: [
        { ...sub, day: 5 },
        { ...sub, day: 7 },
        { ...sub, active: false },
        { ...sub, startsOn: '2026-10-20' },
      ],
      policies: [],
    });
    expect(bills).toEqual([]);
  });

  it('skips a loan that is fully repaid', () => {
    const emi = { ...sub, name: 'Car EMI', isLoan: true, outstandingPaise: 0, tenureRemaining: 3 };
    expect(billsStillDue({ today, commitments: [emi], policies: [] })).toEqual([]);
  });

  it('counts insurance due this month and overdue unpaid premiums, not next month', () => {
    const bills = billsStillDue({
      today,
      commitments: [],
      policies: [
        { name: 'Health', premiumPaise: 12_000_00, nextDueOn: '2026-10-25', active: true },
        { name: 'Bike', premiumPaise: 2_000_00, nextDueOn: '2026-09-30', active: true },
        { name: 'Life', premiumPaise: 30_000_00, nextDueOn: '2026-11-01', active: true },
        { name: 'Paused', premiumPaise: 5_000_00, nextDueOn: '2026-10-20', active: false },
      ],
    });
    expect(bills.map(b => b.name)).toEqual(['Bike', 'Health']);
  });

  it('safe to spend is the balance less the bills', () => {
    expect(safeToSpend(50_000_00, [{ name: 'a', amountPaise: 15_000_00, dueOn: '2026-10-10' }])).toBe(35_000_00);
  });
});
