import { describe, expect, it } from 'vitest';
import { addMonthsIso, advanceDue, daysUntil, inReminderWindow } from './insurance';

describe('insurance dates', () => {
  it('keeps the day when adding months', () => {
    expect(addMonthsIso('2026-10-15', 1)).toBe('2026-11-15');
    expect(addMonthsIso('2026-10-15', 12)).toBe('2027-10-15');
  });

  it('moves to the last day of a shorter month', () => {
    expect(addMonthsIso('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsIso('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('wraps across the year', () => {
    expect(addMonthsIso('2026-11-20', 3)).toBe('2027-02-20');
  });

  it('advances by the frequency', () => {
    expect(advanceDue('2026-10-07', 'monthly')).toBe('2026-11-07');
    expect(advanceDue('2026-10-07', 'quarterly')).toBe('2027-01-07');
    expect(advanceDue('2026-10-07', 'yearly')).toBe('2027-10-07');
  });

  it('counts days until due, negative when overdue', () => {
    expect(daysUntil('2026-10-14', '2026-10-07')).toBe(7);
    expect(daysUntil('2026-10-07', '2026-10-07')).toBe(0);
    expect(daysUntil('2026-10-01', '2026-10-07')).toBe(-6);
  });

  it('shows the reminder 7 days before and while overdue, not earlier', () => {
    expect(inReminderWindow('2026-10-14', '2026-10-07')).toBe(true);
    expect(inReminderWindow('2026-10-15', '2026-10-07')).toBe(false);
    expect(inReminderWindow('2026-10-01', '2026-10-07')).toBe(true);
  });
});

describe('resuming a paused policy', () => {
  it('skips premiums that fell due while paused', async () => {
    const { nextDueFrom } = await import('./insurance');
    expect(nextDueFrom('2026-01-10', 'monthly', '2026-04-05')).toBe('2026-04-10');
    expect(nextDueFrom('2025-03-01', 'yearly', '2026-10-07')).toBe('2027-03-01');
    expect(nextDueFrom('2026-11-01', 'quarterly', '2026-10-07')).toBe('2026-11-01');
  });
});

describe('premiums due on the 29th to 31st', () => {
  it('returns to the real day after a short month when anchored', () => {
    const feb = advanceDue('2026-01-31', 'monthly', 31);
    expect(feb).toBe('2026-02-28');
    expect(advanceDue(feb, 'monthly', 31)).toBe('2026-03-31');
    expect(advanceDue('2026-03-31', 'monthly', 31)).toBe('2026-04-30');
    expect(advanceDue('2026-04-30', 'monthly', 31)).toBe('2026-05-31');
  });

  it('without an anchor the day stays where it was moved (the old behaviour)', () => {
    expect(advanceDue('2026-02-28', 'monthly')).toBe('2026-03-28');
  });

  it('yearly leap-day premiums come back to 29 Feb in leap years', () => {
    const next = advanceDue('2028-02-29', 'yearly', 29);
    expect(next).toBe('2029-02-28');
    expect(advanceDue(next, 'yearly', 29)).toBe('2030-02-28');
    expect(advanceDue('2031-02-28', 'yearly', 29)).toBe('2032-02-29');
  });

  it('resuming steps along the anchored day', async () => {
    const { nextDueFrom, dayOf } = await import('./insurance');
    expect(dayOf('2026-01-31')).toBe(31);
    expect(nextDueFrom('2026-01-31', 'monthly', '2026-03-10', 31)).toBe('2026-03-31');
  });
});
