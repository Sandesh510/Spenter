import { describe, expect, it } from 'vitest';
import { dailyAllowance } from './dailyAllowance';

describe('dailyAllowance', () => {
  it('divides what is safe over the days left, today included', () => {
    // 9 Oct: 23 days left of 31 (9th to 31st).
    expect(dailyAllowance(2_300_000, '2026-10-09')).toEqual({ perDayPaise: 100_000, daysLeft: 23 });
  });

  it('on the last day, everything is for today', () => {
    expect(dailyAllowance(50_000, '2026-10-31')).toEqual({ perDayPaise: 50_000, daysLeft: 1 });
  });

  it('rounds down to whole rupees', () => {
    expect(dailyAllowance(1_075_100, '2026-10-09')).toEqual({ perDayPaise: 46_700, daysLeft: 23 });
  });

  it('is null when nothing is safe to spend', () => {
    expect(dailyAllowance(0, '2026-10-09')).toBeNull();
    expect(dailyAllowance(-100, '2026-10-09')).toBeNull();
  });
});
