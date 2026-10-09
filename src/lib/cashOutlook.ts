import { dayIn, dueFor, lastStatement, nextStatement } from './cardCycle';
import { shiftMonth } from './dates';

/**
 * Cash outlook: what is really yours right now, what the cards will ask for and when, and how much more
 * could go on the cards and still be paid on time. It is an estimate from figures you keep, not a promise.
 *
 *   cash             = balances of accounts that are not cards (savings plans are a separate pot, left out)
 *   free             = cash - everything the cards owe - bills still due this month
 *   can put on cards = the smaller of the credit left and (free + income expected before the next due date)
 *
 * A purchase made today lands on the next statement, so the date it has to be paid by is that statement's
 * due date. Income that arrives before then can pay for it.
 */

export interface CardInput {
  id: string;
  nickname: string;
  limitPaise: number | null;
  /** What the card owes now, from its balance. Null when the card has no opening balance. */
  owedPaise: number | null;
  statementDay: number | null;
  dueDay: number | null;
  /** Charges on this card (spend, money lent, transfers out), each with its date. */
  charges: { date: string; paise: number }[];
}

export interface CardOutlook {
  id: string;
  nickname: string;
  owedPaise: number | null;
  limitPaise: number | null;
  /** Credit left: limit less owed. Null without a limit or a balance. */
  availablePaise: number | null;
  /** Share of the limit in use, in whole percent. */
  usedPct: number | null;
  /** Bought since the last statement, so on the next one. Null without a billing cycle. */
  unbilledPaise: number | null;
  /** On the last statement and still to pay. Null without a billing cycle or a balance. */
  billedPaise: number | null;
  nextStatement: string | null;
  /** When the billed amount is due. Null when nothing is billed. */
  billDue: string | null;
  billOverdue: boolean;
  /** When a purchase made today would have to be paid by. */
  newPurchaseDue: string | null;
}

export function cardOutlook(card: CardInput, today: string): CardOutlook {
  const owed = card.owedPaise;
  const availablePaise = card.limitPaise !== null && owed !== null ? card.limitPaise - owed : null;
  const usedPct = card.limitPaise !== null && owed !== null ? Math.round((owed / card.limitPaise) * 100) : null;
  const base: CardOutlook = {
    id: card.id,
    nickname: card.nickname,
    owedPaise: owed,
    limitPaise: card.limitPaise,
    availablePaise,
    usedPct,
    unbilledPaise: null,
    billedPaise: null,
    nextStatement: null,
    billDue: null,
    billOverdue: false,
    newPurchaseDue: null,
  };
  if (card.statementDay === null || card.dueDay === null) return base;

  const last = lastStatement(today, card.statementDay);
  const next = nextStatement(today, card.statementDay);
  const unbilled = card.charges.filter(c => c.date > last).reduce((s, c) => s + c.paise, 0);
  // What is owed beyond the new purchases is on a statement already.
  const billed = owed === null ? null : Math.max(0, owed - unbilled);
  const billDue = billed !== null && billed > 0 ? dueFor(last, card.statementDay, card.dueDay) : null;
  return {
    ...base,
    unbilledPaise: unbilled,
    billedPaise: billed,
    nextStatement: next,
    billDue,
    billOverdue: billDue !== null && billDue < today,
    newPurchaseDue: dueFor(next, card.statementDay, card.dueDay),
  };
}

/** How many times income arrives after `today` and up to `until`, counting the day it usually comes each month. */
export function incomeArrivals(today: string, until: string, incomeDay: number): number {
  let n = 0;
  for (let m = today.slice(0, 7); m <= until.slice(0, 7); m = shiftMonth(m, 1)) {
    const d = dayIn(m, incomeDay);
    if (d > today && d <= until) n += 1;
  }
  return n;
}

export interface Outlook {
  cashPaise: number;
  /** What every card with a known balance owes. */
  owedPaise: number;
  billsPaise: number;
  freePaise: number;
  cards: CardOutlook[];
  /** Cards whose balance is not known, so what they owe is missing from the total. */
  cardsWithoutBalance: string[];
  /** The earliest date a purchase made today would be due, over all cards. Null without a billing cycle. */
  horizon: string | null;
  incomeBeforeHorizonPaise: number;
  /** About how much more could go on cards and still be paid by the horizon. Null without a billing cycle. */
  canPutOnCardsPaise: number | null;
  /** True when no card has a limit and a balance, so the figure is not capped by credit left. */
  limitUnknown: boolean;
}

export function cashOutlook(args: {
  today: string;
  /** Balances of accounts that are not credit cards; those without a balance are left out. */
  cashBalances: number[];
  cards: CardInput[];
  /** Bills still to come this month (subscriptions, EMIs, premiums). */
  billsPaise: number;
  expectedIncomePaise: number | null;
  incomeDay: number | null;
}): Outlook {
  const cashPaise = args.cashBalances.reduce((s, b) => s + b, 0);
  const cards = args.cards.map(c => cardOutlook(c, args.today));
  const owedPaise = cards.reduce((s, c) => s + (c.owedPaise ?? 0), 0);
  const freePaise = cashPaise - owedPaise - args.billsPaise;

  const dues = cards.map(c => c.newPurchaseDue).filter((d): d is string => d !== null).sort();
  const horizon = dues[0] ?? null;
  const incomeBefore =
    horizon && args.expectedIncomePaise && args.incomeDay ? incomeArrivals(args.today, horizon, args.incomeDay) * args.expectedIncomePaise : 0;

  const known = cards.filter(c => c.availablePaise !== null);
  const credit = known.reduce((s, c) => s + (c.availablePaise as number), 0);
  const limitUnknown = known.length === 0;
  const canPut = horizon === null ? null : Math.max(0, limitUnknown ? freePaise + incomeBefore : Math.min(credit, freePaise + incomeBefore));

  return {
    cashPaise,
    owedPaise,
    billsPaise: args.billsPaise,
    freePaise,
    cards,
    cardsWithoutBalance: cards.filter(c => c.owedPaise === null).map(c => c.nickname),
    horizon,
    incomeBeforeHorizonPaise: incomeBefore,
    canPutOnCardsPaise: canPut,
    limitUnknown,
  };
}
