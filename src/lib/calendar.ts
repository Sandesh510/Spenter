/** Layout of one month on a calendar that starts on Sunday. */
export function monthGrid(month: string): { blanks: number; days: number } {
  const [y, m] = month.split('-').map(Number);
  return {
    blanks: new Date(Date.UTC(y, m - 1, 1)).getUTCDay(),
    days: new Date(Date.UTC(y, m, 0)).getUTCDate(),
  };
}

/** YYYY-MM-DD for a day of a YYYY-MM month. */
export function isoDay(month: string, day: number): string {
  return `${month}-${String(day).padStart(2, '0')}`;
}

/** "Sat, 3 Oct" */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}
