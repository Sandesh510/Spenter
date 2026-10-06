/** Insurance premium rules. Pure, so the server posting and the Home reminder agree on dates. */

export const POLICY_TYPES = ['health', 'life', 'vehicle', 'other'] as const;
export type PolicyType = (typeof POLICY_TYPES)[number];

export const FREQUENCIES = ['monthly', 'quarterly', 'yearly'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const POLICY_TYPE_LABEL: Record<PolicyType, string> = { health: 'Health', life: 'Life', vehicle: 'Vehicle', other: 'Other' };
export const FREQUENCY_LABEL: Record<Frequency, string> = { monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' };

const FREQUENCY_MONTHS: Record<Frequency, number> = { monthly: 1, quarterly: 3, yearly: 12 };

/** Days before a due date when the reminder appears on Home. */
export const REMINDER_DAYS = 7;

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number);
  return [y, m, d];
}

/** Adds whole months to a YYYY-MM-DD date, keeping the day. A day past the month's end moves to the last day. */
export function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = parts(iso);
  const target = m - 1 + months;
  const year = y + Math.floor(target / 12);
  const month = ((target % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** The next due date after a premium falls due. */
export function advanceDue(iso: string, frequency: Frequency): string {
  return addMonthsIso(iso, FREQUENCY_MONTHS[frequency]);
}

/** The first due date on or after today, stepping from a past due date by the frequency. */
export function nextDueFrom(iso: string, frequency: Frequency, today: string): string {
  let due = iso;
  for (let i = 0; due < today && i < 600; i++) due = advanceDue(due, frequency);
  return due;
}

/** Whole days from today to the due date: negative when overdue. */
export function daysUntil(iso: string, today: string): number {
  const [y1, m1, d1] = parts(iso);
  const [y2, m2, d2] = parts(today);
  return Math.round((Date.UTC(y1, m1 - 1, d1) - Date.UTC(y2, m2 - 1, d2)) / 86_400_000);
}

/** True when the premium is due within the reminder window, including overdue premiums that are still open. */
export function inReminderWindow(iso: string, today: string): boolean {
  return daysUntil(iso, today) <= REMINDER_DAYS;
}
