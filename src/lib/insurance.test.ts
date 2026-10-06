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
