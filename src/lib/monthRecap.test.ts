import { describe, expect, it } from 'vitest';
import { monthRecap, type RecapCategory, type RecapTxn } from './monthRecap';

const cats: RecapCategory[] = [
  { id: 'food', name: 'Food', bucket: 'need' },
  { id: 'fun', name: 'Fun', bucket: 'want' },
  { id: 'sip', name: 'SIP', bucket: 'save' },
];
const spend = (date: string, paise: number, category: string): RecapTxn => ({ type: 'spend', amount_paise: paise, txn_date: date, category_id: category });

describe('monthRecap', () => {
  const today = '2026-10-10';

  it('compares this month with the same days last month, and the whole of last month', () => {
    const r = monthRecap({
      today,
      thisMonth: [spend('2026-10-02', 60_000, 'food'), spend('2026-10-09', 40_000, 'fun')],
      lastMonth: [spend('2026-09-03', 50_000, 'food'), spend('2026-09-10', 30_000, 'fun'), spend('2026-09-20', 120_000, 'food')],
      categories: cats,
    });
    expect(r).toMatchObject({ day: 10, thisPaise: 100_000, lastSamePaise: 80_000, lastFullPaise: 200_000, changePct: 25 });
    expect(r?.perDayThisPaise).toBe(10_000);
    expect(r?.perDayLastPaise).toBe(6_700); // 200000 over 30 days, to the rupee
  });

  it('leaves out savings, income and transfers', () => {
    const r = monthRecap({
      today,
      thisMonth: [spend('2026-10-02', 90_000, 'sip'), { type: 'credit', amount_paise: 500_000, txn_date: '2026-10-01', category_id: null }, spend('2026-10-03', 10_000, 'food')],
      lastMonth: [],
      categories: cats,
    });
    expect(r?.thisPaise).toBe(10_000);
    expect(r?.changePct).toBeNull();
  });

  it('lists the biggest category changes first, with the direction', () => {
    const r = monthRecap({
      today,
      thisMonth: [spend('2026-10-02', 90_000, 'food'), spend('2026-10-03', 5_000, 'fun')],
      lastMonth: [spend('2026-09-02', 30_000, 'food'), spend('2026-09-03', 45_000, 'fun')],
      categories: cats,
    });
    expect(r?.changes.map(c => [c.name, c.diffPaise])).toEqual([['Food', 60_000], ['Fun', -40_000]]);
  });

  it('is null when neither month has spending', () => {
    expect(monthRecap({ today, thisMonth: [], lastMonth: [], categories: cats })).toBeNull();
  });
});
