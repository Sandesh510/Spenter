import { describe, expect, it } from 'vitest';
import { dueMonths, emiSplit, nextDue, rateToBps, reverseEmiSplit } from './commitments';

describe('dueMonths', () => {
  it('posts the start month when its day has not passed yet', () => {
    expect(dueMonths({ startsOn: '2026-10-03', day: 5, today: '2026-10-06' })).toEqual(['2026-10']);
  });

  it('skips the start month when the day is before the start date', () => {
    expect(dueMonths({ startsOn: '2026-10-10', day: 5, today: '2026-10-12' })).toEqual([]);
  });

  it('does not post a day that has not arrived yet this month', () => {
    expect(dueMonths({ startsOn: '2026-08-01', day: 20, today: '2026-10-06' })).toEqual(['2026-08', '2026-09']);
  });

  it('posts every month since the start, oldest first', () => {
    expect(dueMonths({ startsOn: '2026-07-01', day: 5, today: '2026-10-06' })).toEqual(['2026-07', '2026-08', '2026-09', '2026-10']);
  });

  it('caps the number of months', () => {
    expect(dueMonths({ startsOn: '2024-01-01', day: 1, today: '2026-10-06', maxMonths: 3 })).toHaveLength(3);
  });
});

describe('nextDue', () => {
  it('is this month when the day is still ahead', () => {
    expect(nextDue({ startsOn: '2026-01-01', day: 20, today: '2026-10-06' })).toBe('2026-10-20');
  });

  it('is next month when this month has passed', () => {
    expect(nextDue({ startsOn: '2026-01-01', day: 5, today: '2026-10-06' })).toBe('2026-11-05');
  });
});

describe('emiSplit', () => {
  it('splits the first EMI on a 10% loan into interest and principal', () => {
    // ₹1,00,000 at 10% a year: interest for one month is ₹833.33.
    const { interestPaise, principalPaise } = emiSplit({ outstandingPaise: 10_000_000, rateBps: 1000, emiPaise: 2_000_000 });
    expect(interestPaise).toBe(83_333);
    expect(principalPaise).toBe(1_916_667);
  });

  it('never reduces principal below zero on the last EMI', () => {
    const { principalPaise } = emiSplit({ outstandingPaise: 50_000, rateBps: 1000, emiPaise: 200_000 });
    expect(principalPaise).toBe(50_000);
  });

  it('takes no principal when the EMI does not cover the interest', () => {
    const { principalPaise } = emiSplit({ outstandingPaise: 10_000_000, rateBps: 1200, emiPaise: 1000 });
    expect(principalPaise).toBe(0);
  });

  it('is interest-free at 0%', () => {
    expect(emiSplit({ outstandingPaise: 300_000, rateBps: 0, emiPaise: 100_000 })).toEqual({ interestPaise: 0, principalPaise: 100_000 });
  });
});

describe('rateToBps', () => {
  it('converts a percentage to basis points', () => {
    expect(rateToBps('10.5')).toBe(1050);
    expect(rateToBps('0')).toBe(0);
  });

  it('rejects rates outside 0–60%', () => {
    expect(() => rateToBps('-1')).toThrow();
    expect(() => rateToBps('61')).toThrow();
    expect(() => rateToBps('abc')).toThrow();
  });
});

describe('long-running commitments', () => {
  it('keeps posting after 24 months, returning the most recent months', () => {
    const months = dueMonths({ startsOn: '2026-01-05', day: 5, today: '2028-06-10' });
    expect(months).toHaveLength(24);
    expect(months[months.length - 1]).toBe('2028-06');
  });
});

describe('reverseEmiSplit', () => {
  it('recovers the principal an EMI paid off', () => {
    const before = 1_000_000_00;
    const emi = 25_000_00;
    const rateBps = 1050;
    const { principalPaise } = emiSplit({ outstandingPaise: before, rateBps, emiPaise: emi });
    const back = reverseEmiSplit({ outstandingAfterPaise: before - principalPaise, rateBps, emiPaise: emi });
    expect(Math.abs(back - principalPaise)).toBeLessThanOrEqual(1);
  });

  it('is the whole EMI on a loan with no interest', () => {
    expect(reverseEmiSplit({ outstandingAfterPaise: 50_000_00, rateBps: 0, emiPaise: 5_000_00 })).toBe(5_000_00);
  });
});
