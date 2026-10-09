import { daysInMonth, shiftMonth } from './dates';

/**
 * A credit card's billing cycle: the statement is generated on one day of the month and its payment is
 * due on a later day. A purchase made on or before the statement day goes on that month's statement;
 * one made after it waits for the next. A day past the end of a short month falls on its last day.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD for `day` of `month`, held to the month's last day. */
export function dayIn(month: string, day: number): string {
  return `${month}-${pad(Math.min(day, daysInMonth(month)))}`;
}

/** The latest statement date on or before `today`. */
export function lastStatement(today: string, statementDay: number): string {
  const month = today.slice(0, 7);
  const thisMonth = dayIn(month, statementDay);
  return thisMonth <= today ? thisMonth : dayIn(shiftMonth(month, -1), statementDay);
}

/** The first statement date after `today`. */
export function nextStatement(today: string, statementDay: number): string {
  const month = today.slice(0, 7);
  const thisMonth = dayIn(month, statementDay);
  return thisMonth > today ? thisMonth : dayIn(shiftMonth(month, 1), statementDay);
}

/** When the statement generated on `statementDate` has to be paid: the next time the due day comes round. */
export function dueFor(statementDate: string, statementDay: number, dueDay: number): string {
  const month = statementDate.slice(0, 7);
  return dayIn(dueDay > statementDay ? month : shiftMonth(month, 1), dueDay);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  const ms = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
  return Math.round((ms(to) - ms(from)) / 86_400_000);
}
