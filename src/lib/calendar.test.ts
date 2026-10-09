import { describe, expect, it } from 'vitest';
import { isoDay, monthGrid, shortDate } from './calendar';

describe('calendar', () => {
  it('lays out October 2026 (starts on a Thursday, 31 days)', () => {
    expect(monthGrid('2026-10')).toEqual({ blanks: 4, days: 31 });
  });

  it('knows a 30-day month and February in a leap year', () => {
    expect(monthGrid('2026-09')).toEqual({ blanks: 2, days: 30 });
    expect(monthGrid('2028-02').days).toBe(29);
  });

  it('builds ISO days and short labels', () => {
    expect(isoDay('2026-10', 3)).toBe('2026-10-03');
    expect(shortDate('2026-10-03')).toBe('Sat, 3 Oct');
  });
});
