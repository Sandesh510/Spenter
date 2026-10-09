import { describe, expect, it } from 'vitest';
import { daysBetween, dayIn, dueFor, lastStatement, nextStatement } from './cardCycle';

describe('cardCycle', () => {
  it('finds the statement before and after today', () => {
    expect(lastStatement('2026-10-10', 5)).toBe('2026-10-05');
    expect(nextStatement('2026-10-10', 5)).toBe('2026-11-05');
    expect(lastStatement('2026-10-03', 5)).toBe('2026-09-05');
    expect(nextStatement('2026-10-03', 5)).toBe('2026-10-05');
  });

  it('on the statement day itself, today is already on that statement', () => {
    expect(lastStatement('2026-10-05', 5)).toBe('2026-10-05');
    expect(nextStatement('2026-10-05', 5)).toBe('2026-11-05');
  });

  it('holds a long day to the end of a short month', () => {
    expect(dayIn('2026-02', 31)).toBe('2026-02-28');
    expect(nextStatement('2026-02-10', 31)).toBe('2026-02-28');
    expect(lastStatement('2026-03-10', 31)).toBe('2026-02-28');
  });

  it('puts the due date in the same month when the due day is later, else the next month', () => {
    expect(dueFor('2026-10-05', 5, 25)).toBe('2026-10-25');
    expect(dueFor('2026-10-20', 20, 8)).toBe('2026-11-08');
    expect(dueFor('2026-12-20', 20, 8)).toBe('2027-01-08');
  });

  it('counts days between dates', () => {
    expect(daysBetween('2026-10-10', '2026-10-25')).toBe(15);
    expect(daysBetween('2026-10-10', '2026-10-08')).toBe(-2);
    expect(daysBetween('2026-10-30', '2026-11-02')).toBe(3);
  });
});
