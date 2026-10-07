import { shiftMonth } from './dates';

/**
 * Rules for recurring commitments: subscriptions, SIP investments and loan EMIs.
 * Shared by the Netlify Functions (which post them) and the screens (which show them).
 */

export type CommitmentKind = 'subscription' | 'investment' | 'loan';

/** YYYY-MM-DD for a commitment's day in a month. Days are at most 28, so every month has them. */
export function dueDate(month: string, day: number): string {
  return `${month}-${String(day).padStart(2, '0')}`;
}

/**
 * Months that should post, oldest first: every month from the start up to today's, where the due
 * date falls on or after the start date and no later than today. When there are more than maxMonths,
 * only the most recent maxMonths are returned, so a long-running commitment never stops posting.
 */
export function dueMonths({ startsOn, day, today, maxMonths = 24 }: { startsOn: string; day: number; today: string; maxMonths?: number }): string[] {
  const months: string[] = [];
  const last = today.slice(0, 7);
  let month = startsOn.slice(0, 7);
  while (month <= last) {
    const due = dueDate(month, day);
    if (due >= startsOn && due <= today) months.push(month);
    month = shiftMonth(month, 1);
  }
  return months.slice(-maxMonths);
}

/** The next due date on or after today, for showing "next on …". */
export function nextDue({ startsOn, day, today }: { startsOn: string; day: number; today: string }): string {
  let month = today.slice(0, 7);
  for (let i = 0; i < 24; i++) {
    const due = dueDate(month, day);
    if (due >= startsOn && due >= today) return due;
    month = shiftMonth(month, 1);
  }
  return dueDate(month, day);
}

/**
 * Splits one EMI into interest and principal on a reducing balance. Interest is the monthly rate on
 * what is still owed; the rest of the EMI reduces the principal. Principal never goes below zero.
 */
export function emiSplit({ outstandingPaise, rateBps, emiPaise }: { outstandingPaise: number; rateBps: number; emiPaise: number }): { interestPaise: number; principalPaise: number } {
  const interestPaise = Math.round((outstandingPaise * rateBps) / (12 * 10_000));
  const principalPaise = Math.min(outstandingPaise, Math.max(0, emiPaise - interestPaise));
  return { interestPaise, principalPaise };
}

/**
 * Estimates the principal a past EMI paid off, from what is owed after it. Used only for EMIs posted before
 * each posting kept its own principal. The forward split is solved backwards: interest depends on the balance
 * before the EMI, which is the balance after plus that principal.
 */
export function reverseEmiSplit({ outstandingAfterPaise, rateBps, emiPaise }: { outstandingAfterPaise: number; rateBps: number; emiPaise: number }): number {
  let principal = emiPaise;
  for (let i = 0; i < 30; i++) {
    const interest = Math.round(((outstandingAfterPaise + principal) * rateBps) / (12 * 10_000));
    const next = Math.max(0, emiPaise - interest);
    if (next === principal) break;
    principal = next;
  }
  return principal;
}

/** Annual rate typed as a percentage ("10.5") to basis points (1050). Throws on anything outside 0–60%. */
export function rateToBps(percent: string): number {
  const n = Number(percent);
  if (!Number.isFinite(n) || n < 0 || n > 60) throw new Error('Interest rate must be between 0 and 60%');
  return Math.round(n * 100);
}
