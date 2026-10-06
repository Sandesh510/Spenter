import { HttpError } from './response';

const ZONE = 'Asia/Kolkata';

/** Current month as YYYY-MM in Asia/Kolkata. */
export function currentMonthIST(now: Date = new Date()): string {
  return currentMonth(now);
}

/** Current month as YYYY-MM in the user's zone (the app is India-only). */
export function currentMonth(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(now)
    .slice(0, 7);
}

/** Validates YYYY-MM and returns it, or throws a 400. */
export function parseMonth(value: string | undefined | null): string {
  const month = value ?? currentMonth();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new HttpError(400, 'month must be YYYY-MM');
  return month;
}

/** First and last-plus-one day of a month, for date range filters: [start, end). */
export function monthRange(month: string): { start: string; end: string; firstDay: string } {
  const [y, m] = month.split('-').map(Number);
  const next = m === 12 ? [y + 1, 1] : [y, m + 1];
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    firstDay: `${month}-01`,
    start: `${month}-01`,
    end: `${next[0]}-${pad(next[1])}-01`,
  };
}
