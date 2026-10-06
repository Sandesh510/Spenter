/**
 * Savings plan rules, shared by the savings function and the Savings screen.
 * Saved amounts are derived (already saved + live contributions), never stored.
 */

import { shiftMonth } from './dates';

export type PlanKind = 'goal' | 'emergency';
export type PlanSort = 'priority' | 'progress' | 'targetDate';

export const PLAN_KINDS: readonly PlanKind[] = ['goal', 'emergency'];
export const PLAN_SORTS: readonly PlanSort[] = ['priority', 'progress', 'targetDate'];
export const PLAN_SORT_LABEL: Record<PlanSort, string> = { priority: 'Priority', progress: 'Progress', targetDate: 'Target date' };

export const DEFAULT_EMERGENCY_MONTHS = 6;
export const MIN_EMERGENCY_MONTHS = 1;
export const MAX_EMERGENCY_MONTHS = 24;
/** Complete months averaged for the emergency fund suggestion. */
export const AVERAGE_MONTHS = 3;
/** Largest plan target or already-saved amount: ₹100 crore, in paise. */
export const MAX_PLAN_PAISE = 100_00_00_000 * 100;

/** Saved over target. Can exceed 1 once the goal is passed; 0 for a missing target. */
export function progressRatio(savedPaise: number, targetPaise: number): number {
  if (targetPaise <= 0) return 0;
  return Math.max(0, savedPaise) / targetPaise;
}

/** Progress for a bar: between 0 and 1. */
export function displayProgress(savedPaise: number, targetPaise: number): number {
  return Math.min(1, progressRatio(savedPaise, targetPaise));
}

/** Amount still to save. Never negative. */
export function amountLeft(savedPaise: number, targetPaise: number): number {
  return Math.max(0, targetPaise - savedPaise);
}

/**
 * Months of contributions needed to finish. 0 once reached; null when there is no monthly contribution
 * (there is no end in sight).
 */
export function monthsRemaining(leftPaise: number, monthlyPaise: number | null): number | null {
  if (leftPaise <= 0) return 0;
  if (!monthlyPaise || monthlyPaise <= 0) return null;
  return Math.ceil(leftPaise / monthlyPaise);
}

/** Whole months from today until a YYYY-MM-DD date. 0 when the date is this month's day or already past. */
export function monthsUntil(targetDate: string, today: string): number {
  const [ty, tm, td] = targetDate.split('-').map(Number);
  const [y, m, d] = today.split('-').map(Number);
  let months = (ty - y) * 12 + (tm - m);
  if (td < d) months -= 1;
  return Math.max(0, months);
}

/**
 * On track when the monthly contribution, paid every month until the target date, covers what is left.
 * Null without a target date. A plan that is already reached is always on track.
 */
export function isOnTrack(opts: { leftPaise: number; monthlyPaise: number | null; targetDate: string | null; today: string }): boolean | null {
  const { leftPaise, monthlyPaise, targetDate, today } = opts;
  if (leftPaise <= 0) return true;
  if (!targetDate) return null;
  return (monthlyPaise ?? 0) * monthsUntil(targetDate, today) >= leftPaise;
}

/**
 * Average monthly Needs + Wants spend, in whole paise. Uses the last AVERAGE_MONTHS complete months
 * (before the current month) that have any spend; with none, the current month's spend so far.
 * byMonth maps YYYY-MM to that month's Needs + Wants spend.
 */
export function averageMonthlySpend(byMonth: Record<string, number>, currentMonth: string): number {
  const months: number[] = [];
  for (let i = 1; i <= AVERAGE_MONTHS; i++) {
    const total = byMonth[shiftMonth(currentMonth, -i)] ?? 0;
    if (total > 0) months.push(total);
  }
  if (months.length === 0) return Math.max(0, Math.round(byMonth[currentMonth] ?? 0));
  return Math.round(months.reduce((s, v) => s + v, 0) / months.length);
}

/** Suggested emergency fund: average monthly Needs + Wants spend × months. */
export function emergencySuggestion(averageMonthlyPaise: number, months: number): number {
  return Math.round(averageMonthlyPaise * months);
}

/** How many months of expenses a saved amount covers, to one decimal. Null without spending to compare. */
export function monthsCovered(savedPaise: number, averageMonthlyPaise: number): number | null {
  if (averageMonthlyPaise <= 0) return null;
  return Math.floor((Math.max(0, savedPaise) / averageMonthlyPaise) * 10) / 10;
}

/** First day of the earliest month the average looks at (YYYY-MM-DD), for the server's date filter. */
export function averageWindowStart(currentMonth: string): string {
  return `${shiftMonth(currentMonth, -AVERAGE_MONTHS)}-01`;
}

interface Sortable {
  name: string;
  priority: number;
  saved_paise: number;
  target_paise: number;
  target_date: string | null;
}

/**
 * Sorted copy of the plans. Priority: lowest number first. Progress: furthest along first.
 * Target date: soonest first, plans without a date last. Ties fall back to priority, then name.
 */
export function sortPlans<T extends Sortable>(plans: T[], by: PlanSort): T[] {
  const byPriority = (a: T, b: T) => a.priority - b.priority || a.name.localeCompare(b.name);
  return [...plans].sort((a, b) => {
    if (by === 'progress') {
      const diff = progressRatio(b.saved_paise, b.target_paise) - progressRatio(a.saved_paise, a.target_paise);
      return diff || byPriority(a, b);
    }
    if (by === 'targetDate') {
      if (a.target_date !== b.target_date) {
        if (a.target_date === null) return 1;
        if (b.target_date === null) return -1;
        return a.target_date < b.target_date ? -1 : 1;
      }
      return byPriority(a, b);
    }
    return byPriority(a, b);
  });
}

/**
 * Parses a rupee amount for a plan field. Zero is allowed where allowZero is set
 * (already saved, monthly contribution). Throws with a message the form can show.
 */
export function parsePlanAmount(input: string, opts: { allowZero?: boolean } = {}): number {
  const trimmed = input.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) throw new Error(`Invalid amount: "${input}"`);
  const [whole, frac = ''] = trimmed.split('.');
  const paise = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  if (paise === 0 && !opts.allowZero) throw new Error('Amount must be greater than zero');
  if (paise > MAX_PLAN_PAISE) throw new Error('Amount exceeds ₹100 crore limit');
  return paise;
}
