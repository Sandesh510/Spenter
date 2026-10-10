import type { NewOffer, OfferKind, CapPeriod } from './offers';

/**
 * Popular credit cards and the offers they are known for, so a card can be picked from a list instead of
 * typing every offer. These come from public card pages and review sites and were checked in October
 * 2026; banks change rewards without notice, so every offer can be edited and the sources are listed.
 * Where sources disagreed, the note says so.
 */

export const CATALOG_AS_OF = 'October 2026';

export interface CatalogOffer {
  title: string;
  kind: OfferKind;
  /** Percent (cashback), points per ₹100 (points) or rupees (flat). */
  rate: number;
  /** One offer is made for each merchant word. */
  merchants?: string[];
  /** One offer is made for each of the user's categories whose name contains one of these words. */
  categoryHints?: string[];
  /** Categories (by name word) the offer does not apply to. */
  excludeHints?: string[];
  capRupees?: number;
  capPer?: CapPeriod;
  minSpendRupees?: number;
  /** What one point is worth, in rupees. */
  pointValueRupees?: number;
  note?: string;
}

export interface CatalogCard {
  id: string;
  /** What the card is called; used as the account nickname when it is added from the list. */
  name: string;
  bank: string;
  /** Words that appear in an account nickname for this card, to recognise it. */
  words: string[];
  source: string;
  offers: CatalogOffer[];
}

const FUEL_RENT_EMI = ['fuel', 'petrol', 'rent', 'emi'];

export const CARD_CATALOG: CatalogCard[] = [
  {
    id: 'icici-rupay-upi',
    name: 'ICICI RuPay Credit Card',
    bank: 'ICICI Bank',
    words: ['icici', 'rupay'],
    source: 'https://www.icicibank.com/personal-banking/cards/credit-card/coral-rupay-card',
    offers: [
      {
        title: '2 points per ₹100, on card and UPI',
        kind: 'points_per_100',
        rate: 2,
        pointValueRupees: 0.25,
        minSpendRupees: 100,
        excludeHints: ['fuel', 'petrol', 'utilit', 'insurance'],
        note: 'About 0.5% when redeemed. Same on UPI. Purchases under ₹100 earn nothing.',
      },
      {
        title: '1 point per ₹100 on utilities and insurance',
        kind: 'points_per_100',
        rate: 1,
        pointValueRupees: 0.25,
        categoryHints: ['utilit', 'insurance', 'bill'],
        note: 'Lower rate on these categories.',
      },
    ],
  },
  {
    id: 'icici-amazon-pay',
    name: 'ICICI Amazon Pay Credit Card',
    bank: 'ICICI Bank',
    words: ['icici', 'amazon'],
    source: 'https://aboutamazon.in/news/retail/amazon-icici-co-branded-credit-card-benefits',
    offers: [
      { title: '5% back on Amazon', kind: 'cashback_pct', rate: 5, merchants: ['Amazon'], note: 'For Prime members. 3% without Prime: edit the rate.' },
      {
        title: '2% on Amazon Pay partners',
        kind: 'cashback_pct',
        rate: 2,
        merchants: ['Swiggy', 'BigBasket', 'BookMyShow'],
        note: 'Partner list changes. Some sources say Prime members only.',
      },
      { title: '2% on bill payments', kind: 'cashback_pct', rate: 2, categoryHints: ['bill', 'utilit'], note: 'Bills paid through Amazon Pay.' },
      {
        title: '1% on everything else',
        kind: 'cashback_pct',
        rate: 1,
        excludeHints: FUEL_RENT_EMI,
        note: 'Not on fuel, rent, EMI or gold. Points go to Amazon Pay balance, 1 point = ₹1.',
      },
    ],
  },
  {
    id: 'axis-flipkart',
    name: 'Axis Flipkart Credit Card',
    bank: 'Axis Bank',
    words: ['axis', 'flipkart'],
    source: 'https://www.flipkart.com/pages/cbc-axis-benefits',
    offers: [
      { title: '5% back on Flipkart', kind: 'cashback_pct', rate: 5, merchants: ['Flipkart'], capRupees: 4000, capPer: 'quarter', note: 'Axis terms: ₹4,000 per quarter. Flipkart pages say unlimited. Check.' },
      { title: '7.5% back on Myntra', kind: 'cashback_pct', rate: 7.5, merchants: ['Myntra'], capRupees: 4000, capPer: 'quarter', note: 'Axis terms say 7.5%; Flipkart pages say 5%. Check.' },
      { title: '5% back on Cleartrip', kind: 'cashback_pct', rate: 5, merchants: ['Cleartrip'], capRupees: 4000, capPer: 'quarter' },
      {
        title: '4% back on preferred merchants',
        kind: 'cashback_pct',
        rate: 4,
        merchants: ['Swiggy', 'Zomato', 'Uber', 'PVR', 'Netmeds', 'MakeMyTrip', 'Goibibo'],
        capRupees: 4000,
        capPer: 'quarter',
        note: 'The merchant list can change at any time.',
      },
      { title: '1% on everything else', kind: 'cashback_pct', rate: 1, excludeHints: FUEL_RENT_EMI, note: 'Some sources say 1.5%. Not on fuel, EMI, wallet loads or gold.' },
    ],
  },
  {
    id: 'hdfc-pixel-play',
    name: 'HDFC Pixel Play Credit Card',
    bank: 'HDFC Bank',
    words: ['hdfc', 'pixel'],
    source: 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/pixel-play-credit-card',
    offers: [
      {
        title: '5% on your two chosen packs',
        kind: 'cashback_pct',
        rate: 5,
        merchants: ['BookMyShow', 'Zomato', 'MakeMyTrip', 'Uber', 'Blinkit', 'Croma', 'Nykaa', 'Myntra'],
        capRupees: 500,
        capPer: 'month',
        note: 'Only two of the five packs earn 5%. Delete the merchants of the packs you did not choose.',
      },
      { title: '3% on your chosen shopping app', kind: 'cashback_pct', rate: 3, merchants: ['Amazon', 'Flipkart', 'PayZapp'], capRupees: 500, capPer: 'month', note: 'One of these three. Delete the other two.' },
      { title: '1% on everything else, including RuPay UPI', kind: 'cashback_pct', rate: 1, excludeHints: FUEL_RENT_EMI, note: 'UPI earns 1% on the RuPay variant only.' },
    ],
  },
  {
    id: 'hdfc-millennia',
    name: 'HDFC Millennia Credit Card',
    bank: 'HDFC Bank',
    words: ['hdfc', 'millennia', 'millenia'],
    source: 'https://hdfcbank.com/personal/pay/cards/millennia-cards/millennia-cc-new',
    offers: [
      {
        title: '5% on partner brands',
        kind: 'cashback_pct',
        rate: 5,
        merchants: ['Amazon', 'BookMyShow', 'Cult.fit', 'Flipkart', 'Myntra', 'Sony LIV', 'Swiggy', 'Tata CLiQ', 'Uber', 'Zomato'],
        capRupees: 1000,
        capPer: 'month',
        note: 'Cap of 1,000 CashPoints a month is from a review site, not the bank page. Check.',
      },
      { title: '1% on everything else', kind: 'cashback_pct', rate: 1, excludeHints: ['fuel', 'petrol', 'rent'], capRupees: 1000, capPer: 'month', note: 'Not on fuel, rent or government payments.' },
    ],
  },
  {
    id: 'sbi-cashback',
    name: 'Cashback SBI Credit Card',
    bank: 'SBI Card',
    words: ['sbi', 'cashback'],
    source: 'https://cardadvisor.in/cards/sbi-cashback',
    offers: [
      {
        title: '5% on online spends',
        kind: 'cashback_pct',
        rate: 5,
        capRupees: 2000,
        capPer: 'cycle',
        excludeHints: ['fuel', 'petrol', 'rent', 'utilit', 'insurance', 'emi', 'education', 'wallet', 'jewel', 'railway', 'toll'],
        note: 'Online only; offline spends earn 1%. ₹4,000 a cycle in all (changed April 2026). Edit the rate to 1% for shops you pay in person.',
      },
    ],
  },
  {
    id: 'tata-neu-infinity-sbi',
    name: 'Tata Neu Infinity SBI Credit Card',
    bank: 'SBI Card',
    words: ['tata', 'neu', 'sbi'],
    source: 'https://www.sbicard.com/en/blog/detail/tata-neu',
    offers: [
      {
        title: '5% NeuCoins on Tata brands',
        kind: 'cashback_pct',
        rate: 5,
        merchants: ['Tata Neu', 'BigBasket', 'Croma', 'Tata CLiQ', '1mg', 'Westside', 'Air India'],
        note: 'NeuCoins, 1 = ₹1, usable on the Tata Neu platform. Partner list changes.',
      },
      {
        title: '1.5% NeuCoins on everything else',
        kind: 'cashback_pct',
        rate: 1.5,
        excludeHints: ['fuel', 'petrol', 'emi', 'wallet'],
        note: 'RuPay variant earns up to 1.5% on UPI through the Tata Neu UPI ID. Check your variant.',
      },
    ],
  },
  {
    id: 'bpcl-sbi',
    name: 'BPCL SBI Credit Card',
    bank: 'SBI Card',
    words: ['bpcl', 'sbi'],
    source: 'https://www.sbicard.com/sbi-card-en/assets/docs/pdf/personal/credit-cards/travel/bpcl-tnc.pdf',
    offers: [
      {
        title: '13X points at BPCL pumps',
        kind: 'points_per_100',
        rate: 13,
        pointValueRupees: 0.25,
        merchants: ['BPCL'],
        capRupees: 325,
        capPer: 'cycle',
        note: 'About 3.25% (1,300 points a cycle), plus a 1% fuel surcharge waiver on up to ₹4,000. Name the pump in the item.',
      },
      {
        title: '5X points on groceries, dining and movies',
        kind: 'points_per_100',
        rate: 5,
        pointValueRupees: 0.25,
        categoryHints: ['grocer', 'supermarket', 'dining', 'restaurant', 'movie', 'food'],
        capRupees: 1250,
        capPer: 'month',
        note: 'About 1.25%, capped at 5,000 points a month across these. Departmental stores also earn 5X.',
      },
      { title: '1 point per ₹100 elsewhere', kind: 'points_per_100', rate: 1, pointValueRupees: 0.25, excludeHints: ['fuel', 'petrol'], note: 'Fuel away from BPCL earns nothing.' },
    ],
  },
];

const norm = (s: string) => s.toLowerCase();

/** The catalogue card an account nickname most likely refers to: it must contain all of the card's words. */
export function findCatalogCard(nickname: string): CatalogCard | null {
  const n = norm(nickname);
  const hits = CARD_CATALOG.filter(c => c.words.filter(w => n.includes(w)).length >= Math.min(2, c.words.length));
  if (hits.length === 0) return null;
  // The one that matches the most words wins; a tie is not guessed.
  const score = (c: CatalogCard) => c.words.filter(w => n.includes(w)).length;
  const best = Math.max(...hits.map(score));
  const top = hits.filter(c => score(c) === best);
  return top.length === 1 ? top[0] : null;
}

/**
 * Turns a catalogue card's offers into offers for one of the user's card accounts, tied to the user's own
 * categories by name. An offer that needs a category the user does not have is reported, not guessed.
 */
export function offersForCard(
  card: CatalogCard,
  accountId: string,
  categories: { id: string; name: string }[],
): { offers: NewOffer[]; skipped: string[] } {
  const offers: NewOffer[] = [];
  const skipped: string[] = [];
  const named = (hints: string[]) => categories.filter(c => hints.some(h => norm(c.name).includes(h)));

  for (const o of card.offers) {
    const excluded = o.excludeHints ? named(o.excludeHints).map(c => c.id) : [];
    const base = {
      account_id: accountId,
      title: o.title,
      kind: o.kind,
      rate: o.rate,
      point_value_paise: o.kind === 'points_per_100' && o.pointValueRupees ? Math.max(1, Math.round(o.pointValueRupees * 100)) : null,
      cap_paise: o.capRupees ? Math.round(o.capRupees * 100) : null,
      cap_period: o.capRupees ? o.capPer ?? 'month' : null,
      min_spend_paise: o.minSpendRupees ? Math.round(o.minSpendRupees * 100) : null,
      exclude_category_ids: excluded,
      valid_from: null,
      valid_to: null,
      note: o.note ?? null,
    } satisfies Omit<NewOffer, 'category_id' | 'merchant'>;

    if (o.merchants && o.merchants.length > 0) {
      for (const m of o.merchants) offers.push({ ...base, category_id: null, merchant: m });
    } else if (o.categoryHints) {
      const matches = named(o.categoryHints);
      if (matches.length === 0) skipped.push(`${o.title}: you have no category like "${o.categoryHints[0]}"`);
      for (const c of matches) offers.push({ ...base, category_id: c.id, merchant: null });
    } else {
      offers.push({ ...base, category_id: null, merchant: null });
    }
  }
  return { offers, skipped };
}
