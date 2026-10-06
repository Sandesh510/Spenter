/** Dates are shown and stored in Asia/Kolkata, matching the server. */

export function todayIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Moves a YYYY-MM month by whole months, e.g. shiftMonth('2026-01', -1) is '2025-12'. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function currentMonth(now: Date = new Date()): string {
  return todayIST(now).slice(0, 7);
}

/** "August 2026" */
export function monthTitle(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** "Today", "Yesterday", or "Fri, 1 Aug" for a YYYY-MM-DD date. */
export function dayLabel(date: string, now: Date = new Date()): string {
  const today = todayIST(now);
  if (date === today) return 'Today';
  const yesterday = todayIST(new Date(now.getTime() - 86_400_000));
  if (date === yesterday) return 'Yesterday';
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** Day of month in IST, for "day 21 / 31" */
export function dayOfMonth(now: Date = new Date()): number {
  return Number(todayIST(now).slice(8, 10));
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
