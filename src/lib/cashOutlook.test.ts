import { describe, expect, it } from 'vitest';
import { cardOutlook, cashOutlook, incomeArrivals, type CardInput } from './cashOutlook';

const card = (over: Partial<CardInput> = {}): CardInput => ({
  id: 'c', nickname: 'Rewards', limitPaise: 10_000_000, owedPaise: 4_000_000, statementDay: 5, dueDay: 25, charges: [], ...over,
});

describe('cardOutlook', () => {
  it('splits what is owed into the last statement and what was bought since', () => {
    const o = cardOutlook(card({ charges: [{ date: '2026-10-07', paise: 600_000 }, { date: '2026-10-02', paise: 900_000 }] }), '2026-10-10');
    expect(o).toMatchObject({ unbilledPaise: 600_000, billedPaise: 3_400_000, billDue: '2026-10-25', nextStatement: '2026-11-05', newPurchaseDue: '2026-11-25', availablePaise: 6_000_000, usedPct: 40, billOverdue: false });
  });

  it('marks a bill overdue once its due date has passed', () => {
    expect(cardOutlook(card(), '2026-10-27').billOverdue).toBe(true);
  });

  it('has no billed amount when nothing is owed', () => {
    expect(cardOutlook(card({ owedPaise: 0 }), '2026-10-10')).toMatchObject({ billedPaise: 0, billDue: null });
  });

  it('shows only the balance figures without a billing cycle or a balance', () => {
    expect(cardOutlook(card({ statementDay: null }), '2026-10-10')).toMatchObject({ unbilledPaise: null, billedPaise: null, nextStatement: null, availablePaise: 6_000_000 });
    expect(cardOutlook(card({ owedPaise: null }), '2026-10-10')).toMatchObject({ billedPaise: null, availablePaise: null, usedPct: null });
  });
});

describe('incomeArrivals', () => {
  it('counts the income day after today and up to the date', () => {
    expect(incomeArrivals('2026-10-10', '2026-11-25', 1)).toBe(1); // 1 Nov
    expect(incomeArrivals('2026-10-10', '2026-11-25', 28)).toBe(1); // 28 Oct; 28 Nov is after 25 Nov
    expect(incomeArrivals('2026-10-10', '2026-12-31', 15)).toBe(3); // 15 Oct, 15 Nov, 15 Dec
  });
});

describe('cashOutlook', () => {
  const base = { today: '2026-10-10', cashBalances: [10_000_000, 500_000], billsPaise: 1_000_000, expectedIncomePaise: 6_000_000, incomeDay: 1 };

  it('free = cash less what the cards owe less bills still due', () => {
    const o = cashOutlook({ ...base, cards: [card({ owedPaise: 4_000_000 })] });
    expect(o).toMatchObject({ cashPaise: 10_500_000, owedPaise: 4_000_000, freePaise: 5_500_000 });
  });

  it('can put on cards: free plus income before the next due date, held to the credit left', () => {
    // A purchase today is due 25 Nov. Income on 1 Nov arrives before that: 5,500,000 + 6,000,000 = 11,500,000; credit left 6,000,000.
    const o = cashOutlook({ ...base, cards: [card({ owedPaise: 4_000_000 })] });
    expect(o).toMatchObject({ horizon: '2026-11-25', incomeBeforeHorizonPaise: 6_000_000, canPutOnCardsPaise: 6_000_000, limitUnknown: false });
  });

  it('is capped by free money plus income when that is less than the credit left', () => {
    const o = cashOutlook({ ...base, cashBalances: [1_000_000], expectedIncomePaise: null, incomeDay: null, cards: [card({ owedPaise: 400_000, limitPaise: 50_000_000 })] });
    expect(o.canPutOnCardsPaise).toBe(0); // free = 1,000,000 - 400,000 - 1,000,000 is below zero
  });

  it('without a billing cycle there is no date to plan to', () => {
    expect(cashOutlook({ ...base, cards: [card({ statementDay: null })] }).canPutOnCardsPaise).toBeNull();
  });

  it('names cards whose balance is missing', () => {
    expect(cashOutlook({ ...base, cards: [card({ owedPaise: null })] }).cardsWithoutBalance).toEqual(['Rewards']);
  });
});
