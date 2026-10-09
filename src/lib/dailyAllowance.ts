import { daysInMonth } from './dates';

/**
 * What safe to spend allows per day for the rest of the month, today included.
 * Null when less than a rupee a day is safe to spend, so the screen says nothing instead of showing zero or a negative.
 */
export function dailyAllowance(safePaise: number, today: string): { perDayPaise: number; daysLeft: number } | null {
  if (safePaise <= 0) return null;
  const daysLeft = daysInMonth(today.slice(0, 7)) - Number(today.slice(8, 10)) + 1;
  // Whole rupees, rounded down, so the figure never promises more than is safe.
  const perDayPaise = Math.floor(safePaise / daysLeft / 100) * 100;
  return perDayPaise > 0 ? { perDayPaise, daysLeft } : null;
}
