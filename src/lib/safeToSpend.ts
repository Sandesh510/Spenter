import { dueDate } from './commitments';
import { shiftMonth } from './dates';

/**
 * Safe to spend = balance left to spend − bills still to come this month.
 * Bills still to come: commitments (subscriptions, SIPs, EMIs) whose day is after today, and
 * insurance premiums due by the month's end that are not yet recorded (including overdue ones).
 */

export interface CommitmentDue {
  name: string;
  amountPaise: number;
  day: number;
  startsOn: string;
  active: boolean;
  /** Loans only: no EMI is due once nothing is owed or no instalments remain. */
  isLoan?: boolean;
  outstandingPaise?: number | null;
  tenureRemaining?: number | null;
}

export interface PolicyDue {
  name: string;
  premiumPaise: number;
  nextDueOn: string;
  active: boolean;
}

export interface UpcomingBill {
  name: string;
  amountPaise: number;
  dueOn: string;
}

export function billsStillDue({ today, commitments, policies }: { today: string; commitments: CommitmentDue[]; policies: PolicyDue[] }): UpcomingBill[] {
  const month = today.slice(0, 7);
  const nextMonthStart = `${shiftMonth(month, 1)}-01`;
  const bills: UpcomingBill[] = [];

  for (const c of commitments) {
    if (!c.active) continue;
    if (c.isLoan && ((c.outstandingPaise ?? 0) <= 0 || (c.tenureRemaining ?? 0) <= 0)) continue;
    const due = dueDate(month, c.day);
    // Due today or earlier has already posted, so it is in the balance.
    if (due <= today || due < c.startsOn) continue;
    bills.push({ name: c.name, amountPaise: c.amountPaise, dueOn: due });
  }

  for (const p of policies) {
    if (!p.active || p.nextDueOn >= nextMonthStart) continue;
    bills.push({ name: p.name, amountPaise: p.premiumPaise, dueOn: p.nextDueOn });
  }

  return bills.sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}

export function safeToSpend(balancePaise: number, bills: UpcomingBill[]): number {
  return balancePaise - bills.reduce((s, b) => s + b.amountPaise, 0);
}
