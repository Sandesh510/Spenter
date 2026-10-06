import { describe, expect, it } from 'vitest';
import {
  amountLeft, averageMonthlySpend, averageWindowStart, displayProgress, emergencySuggestion, isOnTrack,
  monthsCovered, monthsRemaining, monthsUntil, parsePlanAmount, progressRatio, sortPlans,
} from './savings';

describe('progress', () => {
  it('is saved over target', () => {
    expect(progressRatio(25_000, 100_000)).toBe(0.25);
  });

  it('can exceed 1, but the bar is capped', () => {
    expect(progressRatio(150_000, 100_000)).toBe(1.5);
    expect(displayProgress(150_000, 100_000)).toBe(1);
  });

  it('is 0 for a missing target', () => {
    expect(progressRatio(10, 0)).toBe(0);
  });
});

describe('amountLeft', () => {
  it('is target less saved', () => {
    expect(amountLeft(30_000, 100_000)).toBe(70_000);
  });

  it('is never negative', () => {
    expect(amountLeft(120_000, 100_000)).toBe(0);
  });
});

describe('monthsRemaining', () => {
  it('rounds up to whole months', () => {
    expect(monthsRemaining(100_000, 30_000)).toBe(4);
    expect(monthsRemaining(90_000, 30_000)).toBe(3);
  });

  it('is null with no monthly contribution', () => {
    expect(monthsRemaining(100_000, null)).toBeNull();
    expect(monthsRemaining(100_000, 0)).toBeNull();
  });

  it('is 0 once reached', () => {
    expect(monthsRemaining(0, null)).toBe(0);
    expect(monthsRemaining(0, 5_000)).toBe(0);
  });
});

describe('monthsUntil', () => {
  it('counts whole months', () => {
    expect(monthsUntil('2027-04-07', '2026-10-07')).toBe(6);
    expect(monthsUntil('2027-04-06', '2026-10-07')).toBe(5);
    expect(monthsUntil('2027-04-30', '2026-10-07')).toBe(6);
  });

  it('is 0 for a past date', () => {
    expect(monthsUntil('2026-01-01', '2026-10-07')).toBe(0);
  });
});

describe('isOnTrack', () => {
  const today = '2026-10-07';

  it('is on track when the contribution covers what is left by the date', () => {
    expect(isOnTrack({ leftPaise: 60_000, monthlyPaise: 10_000, targetDate: '2027-04-07', today })).toBe(true);
  });

  it('is behind when it does not', () => {
    expect(isOnTrack({ leftPaise: 70_000, monthlyPaise: 10_000, targetDate: '2027-04-07', today })).toBe(false);
    expect(isOnTrack({ leftPaise: 70_000, monthlyPaise: null, targetDate: '2027-04-07', today })).toBe(false);
  });

  it('is unknown without a target date', () => {
    expect(isOnTrack({ leftPaise: 70_000, monthlyPaise: 10_000, targetDate: null, today })).toBeNull();
  });

  it('is on track once reached', () => {
    expect(isOnTrack({ leftPaise: 0, monthlyPaise: null, targetDate: '2026-01-01', today })).toBe(true);
  });
});

describe('averageMonthlySpend', () => {
  it('averages the last 3 complete months', () => {
    expect(averageMonthlySpend({ '2026-07': 30_000, '2026-08': 40_000, '2026-09': 50_000, '2026-10': 999_999 }, '2026-10')).toBe(40_000);
  });

  it('skips complete months with no spend', () => {
    expect(averageMonthlySpend({ '2026-08': 40_000, '2026-09': 60_000 }, '2026-10')).toBe(50_000);
  });

  it('ignores months before the window', () => {
    expect(averageMonthlySpend({ '2026-06': 1_000_000, '2026-09': 60_000 }, '2026-10')).toBe(60_000);
  });

  it('falls back to the current month when no complete month has spend', () => {
    expect(averageMonthlySpend({ '2026-10': 12_345 }, '2026-10')).toBe(12_345);
    expect(averageMonthlySpend({}, '2026-10')).toBe(0);
  });

  it('rounds to whole paise', () => {
    expect(averageMonthlySpend({ '2026-07': 1, '2026-08': 1, '2026-09': 2 }, '2026-10')).toBe(1);
  });

  it('crosses a year boundary', () => {
    expect(averageWindowStart('2027-01')).toBe('2026-10-01');
    expect(averageMonthlySpend({ '2026-12': 30_000, '2026-11': 30_000, '2026-10': 30_000 }, '2027-01')).toBe(30_000);
  });
});

describe('emergency fund', () => {
  it('suggests months × average monthly spend', () => {
    expect(emergencySuggestion(4_500_000, 6)).toBe(27_000_000);
  });

  it('shows months of expenses covered, to one decimal', () => {
    expect(monthsCovered(10_000_000, 4_000_000)).toBe(2.5);
    expect(monthsCovered(10_000_000, 3_000_000)).toBe(3.3);
    expect(monthsCovered(10_000_000, 0)).toBeNull();
  });
});

describe('sortPlans', () => {
  const plans = [
    { name: 'Car', priority: 2, saved_paise: 90, target_paise: 100, target_date: null },
    { name: 'Trip', priority: 0, saved_paise: 10, target_paise: 100, target_date: '2027-03-01' },
    { name: 'Fund', priority: 1, saved_paise: 50, target_paise: 100, target_date: '2026-12-01' },
  ];

  it('sorts by priority', () => {
    expect(sortPlans(plans, 'priority').map(p => p.name)).toEqual(['Trip', 'Fund', 'Car']);
  });

  it('sorts by progress, furthest along first', () => {
    expect(sortPlans(plans, 'progress').map(p => p.name)).toEqual(['Car', 'Fund', 'Trip']);
  });

  it('sorts by target date with no date last', () => {
    expect(sortPlans(plans, 'targetDate').map(p => p.name)).toEqual(['Fund', 'Trip', 'Car']);
  });

  it('does not change the input', () => {
    sortPlans(plans, 'progress');
    expect(plans[0].name).toBe('Car');
  });
});

describe('parsePlanAmount', () => {
  it('parses rupees to paise', () => {
    expect(parsePlanAmount('1,50,000.5')).toBe(15_000_050);
  });

  it('allows zero only where asked', () => {
    expect(parsePlanAmount('0', { allowZero: true })).toBe(0);
    expect(() => parsePlanAmount('0')).toThrow();
  });

  it('allows targets above ₹1 crore', () => {
    expect(parsePlanAmount('25000000')).toBe(2_500_000_000);
  });

  it('rejects bad input', () => {
    expect(() => parsePlanAmount('12.345')).toThrow();
    expect(() => parsePlanAmount('-5')).toThrow();
  });
});
