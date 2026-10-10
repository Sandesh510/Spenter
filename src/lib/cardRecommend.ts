import { daysBetween } from './cardCycle';
import { dayIn } from './cardCycle';
import { shiftMonth } from './dates';
import type { CardOffer } from './offers';

/**
 * Which card to use for a purchase. Deterministic: it works out, for each card, the best offer that
 * applies, what it is worth in rupees after the cap, how many days the card gives before the bill is due,
 * and whether the card can take the amount at all. The one-line reason is built from those numbers.
 */

export interface Purchase {
  amountPaise: number;
  categoryId: string | null;
  /** What the user typed for "What is it?", matched against an offer's merchant word. */
  item: string;
  today: string;
}

export interface CardCandidate {
  id: string;
  nickname: string;
  limitPaise: number | null;
  owedPaise: number | null;
  /** When a purchase made today has to be paid by, from the card's billing cycle. Null without one. */
  newPurchaseDue: string | null;
  /** The card's statement day, for offers capped per statement cycle. */
  statementDay: number | null;
}

/** Spending already made on a card, used to see how much of an offer's cap is left. */
export interface CardSpend {
  accountId: string;
  date: string;
  paise: number;
  categoryId: string | null;
  description: string | null;
}

export interface Recommendation {
  cardId: string;
  nickname: string;
  /** What the best offer gives on this purchase, in paise, after its cap. */
  benefitPaise: number;
  offer: CardOffer | null;
  /** Days until a purchase made today is due, or null without a billing cycle. */
  floatDays: number | null;
  /** Why the card cannot be used for this purchase, or null. */
  blocked: string | null;
  /** Share of the limit in use after this purchase, in percent. */
  utilisationPct: number | null;
  /** One line: what is good about this card for this purchase, or why not. */
  reason: string;
}

const inr = (paise: number) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;

/** First day of the period an offer's cap counts over, given today. */
function periodStart(offer: CardOffer, today: string, statementDay: number | null): string {
  const month = today.slice(0, 7);
  if (offer.cap_period === 'quarter') {
    const m = Number(month.slice(5, 7));
    const first = Math.floor((m - 1) / 3) * 3 + 1;
    return `${month.slice(0, 4)}-${String(first).padStart(2, '0')}-01`;
  }
  if (offer.cap_period === 'cycle' && statementDay !== null) {
    const thisMonth = dayIn(month, statementDay);
    return thisMonth <= today ? thisMonth : dayIn(shiftMonth(month, -1), statementDay);
  }
  return `${month}-01`;
}

/** Whether an offer applies to this purchase at all (date, minimum, category, merchant, exclusions). */
function applies(offer: CardOffer, p: Purchase): boolean {
  if (offer.valid_from && p.today < offer.valid_from) return false;
  if (offer.valid_to && p.today > offer.valid_to) return false;
  if (offer.min_spend_paise !== null && p.amountPaise < offer.min_spend_paise) return false;
  if (p.categoryId && offer.exclude_category_ids.includes(p.categoryId)) return false;
  if (offer.merchant && !p.item.toLowerCase().includes(offer.merchant.toLowerCase())) return false;
  // A category-only offer needs that category; with a merchant, the merchant is what matters.
  if (!offer.merchant && offer.category_id && offer.category_id !== p.categoryId) return false;
  return true;
}

/** Paise an offer gives on `amount`, before any cap. */
function gross(offer: CardOffer, amountPaise: number): number {
  if (offer.kind === 'cashback_pct') return Math.floor((amountPaise * offer.rate) / 100);
  if (offer.kind === 'points_per_100') return Math.floor((amountPaise / 10_000) * offer.rate * (offer.point_value_paise ?? 100));
  return Math.round(offer.rate * 100);
}

/** Paise of this offer's benefit already earned in its period, from the card's earlier spending. */
function earnedSoFar(offer: CardOffer, spends: CardSpend[], today: string, statementDay: number | null): number {
  const from = periodStart(offer, today, statementDay);
  let total = 0;
  for (const s of spends) {
    if (s.accountId !== offer.account_id || s.date < from) continue;
    if (offer.merchant) {
      if (!(s.description ?? '').toLowerCase().includes(offer.merchant.toLowerCase())) continue;
    } else if (offer.category_id && s.categoryId !== offer.category_id) continue;
    if (s.categoryId && offer.exclude_category_ids.includes(s.categoryId)) continue;
    total += gross(offer, s.paise);
  }
  return total;
}

function specificity(o: CardOffer): number {
  return (o.merchant ? 2 : 0) + (o.category_id ? 1 : 0);
}

export function recommendCards(args: { purchase: Purchase; cards: CardCandidate[]; offers: CardOffer[]; spends: CardSpend[] }): Recommendation[] {
  const { purchase: p } = args;
  const out: Recommendation[] = args.cards.map(card => {
    const floatDays = card.newPurchaseDue ? Math.max(0, daysBetween(p.today, card.newPurchaseDue)) : null;
    const available = card.limitPaise !== null && card.owedPaise !== null ? card.limitPaise - card.owedPaise : null;
    const utilisationPct =
      card.limitPaise !== null && card.owedPaise !== null ? Math.round(((card.owedPaise + p.amountPaise) / card.limitPaise) * 100) : null;

    let best: { offer: CardOffer; benefit: number; capLeft: number | null } | null = null;
    for (const offer of args.offers) {
      if (offer.account_id !== card.id || !applies(offer, p)) continue;
      let benefit = gross(offer, p.amountPaise);
      let capLeft: number | null = null;
      if (offer.cap_paise !== null) {
        capLeft = Math.max(0, offer.cap_paise - earnedSoFar(offer, args.spends, p.today, card.statementDay));
        benefit = Math.min(benefit, capLeft);
      }
      if (benefit <= 0) continue;
      if (!best || benefit > best.benefit || (benefit === best.benefit && specificity(offer) > specificity(best.offer))) best = { offer, benefit, capLeft };
    }

    const blocked = available !== null && available < p.amountPaise ? `Only ${inr(Math.max(0, available))} credit left` : null;
    const bits: string[] = [];
    if (best) {
      const what = best.offer.merchant ?? best.offer.title;
      bits.push(`${inr(best.benefit)} back on ${what}`);
      if (best.capLeft !== null) bits.push(`${inr(best.capLeft)} of cap left`);
    } else {
      bits.push('No offer for this');
    }
    if (floatDays !== null) bits.push(`${floatDays} days to pay`);
    if (utilisationPct !== null && utilisationPct > 30 && !blocked) bits.push(`uses ${utilisationPct}% of limit`);

    return {
      cardId: card.id,
      nickname: card.nickname,
      benefitPaise: best?.benefit ?? 0,
      offer: best?.offer ?? null,
      floatDays,
      blocked,
      utilisationPct,
      reason: blocked ?? bits.join(', '),
    };
  });

  return out.sort(
    (a, b) =>
      Number(a.blocked !== null) - Number(b.blocked !== null) ||
      b.benefitPaise - a.benefitPaise ||
      (b.floatDays ?? -1) - (a.floatDays ?? -1) ||
      a.nickname.localeCompare(b.nickname),
  );
}
