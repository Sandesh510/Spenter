import { isCreditCard } from './accountTypes';
import { parseRupeesToPaise } from './money';

/**
 * Card offers: what a card gives back on a kind of purchase. Offers are entered by the user (or pasted
 * from a list in the JSON form below); nothing here is fetched from a bank.
 */

export type OfferKind = 'cashback_pct' | 'points_per_100' | 'flat';
export type CapPeriod = 'month' | 'cycle' | 'quarter';

export interface CardOffer {
  id: string;
  account_id: string;
  title: string;
  category_id: string | null;
  merchant: string | null;
  kind: OfferKind;
  /** Percent for cashback_pct, points per ₹100 for points_per_100, rupees for flat. */
  rate: number;
  point_value_paise: number | null;
  cap_paise: number | null;
  cap_period: CapPeriod | null;
  min_spend_paise: number | null;
  /** Categories this offer does not apply to. */
  exclude_category_ids: string[];
  valid_from: string | null;
  valid_to: string | null;
  note: string | null;
}

/** An offer ready to save: what the import produces, and what the server stores. */
export type NewOffer = Omit<CardOffer, 'id'>;

export const OFFER_KIND_LABEL: Record<OfferKind, string> = {
  cashback_pct: 'cashback',
  points_per_100: 'points',
  flat: 'flat off',
};

/** The JSON a user pastes: one object per offer. Field names are the short ones people would write. */
export const IMPORT_EXAMPLE = `[
  {
    "card": "ICICI Amazon Pay",
    "title": "5% on Amazon",
    "merchant": "Amazon",
    "type": "cashback",
    "rate": 5,
    "cap": 2000,
    "capPer": "month"
  },
  {
    "card": "HDFC Millennia",
    "title": "Online shopping",
    "category": "Shopping",
    "type": "points",
    "rate": 4,
    "pointValue": 0.5
  }
]`;

export interface ImportResult {
  offers: NewOffer[];
  /** One message per entry that could not be read, with its position. */
  errors: string[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Splits "ICICI Amazon Pay" into comparable words. */
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1);

/**
 * The credit card a name refers to: an exact nickname, then a nickname that contains the name (or the
 * other way round), then the card that shares the most words. Null when nothing is close.
 */
export function matchCard<T extends { id: string; nickname: string; kind: string | null }>(name: string, accounts: T[]): T | null {
  const cards = accounts.filter(a => isCreditCard(a.kind));
  const n = norm(name);
  if (!n) return null;
  const exact = cards.find(c => norm(c.nickname) === n);
  if (exact) return exact;
  const contains = cards.filter(c => norm(c.nickname).includes(n) || n.includes(norm(c.nickname)));
  if (contains.length === 1) return contains[0];
  const wanted = new Set(words(name));
  let best: T | null = null;
  let bestScore = 0;
  let tie = false;
  for (const c of cards) {
    const score = words(c.nickname).filter(w => wanted.has(w)).length;
    if (score > bestScore) {
      best = c;
      bestScore = score;
      tie = false;
    } else if (score === bestScore && score > 0) tie = true;
  }
  return bestScore >= 2 && !tie ? best : null;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[,₹%\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function rupeesToPaise(v: unknown): number | null {
  const n = num(v);
  if (n === null) return null;
  try {
    return parseRupeesToPaise(String(n));
  } catch {
    return null;
  }
}

const date = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null);

/**
 * Reads pasted offers (a JSON array, or an object with an "offers" array) against the user's cards and
 * categories. Entries that cannot be matched are reported, never guessed.
 */
export function parseOfferImport(
  text: string,
  accounts: { id: string; nickname: string; kind: string | null }[],
  categories: { id: string; name: string }[],
): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { offers: [], errors: ['This is not valid JSON. Paste the list exactly as given, starting with [ and ending with ].'] };
  }
  const list = Array.isArray(parsed) ? parsed : Array.isArray((parsed as { offers?: unknown })?.offers) ? (parsed as { offers: unknown[] }).offers : null;
  if (!list) return { offers: [], errors: ['Expected a list of offers.'] };

  const offers: NewOffer[] = [];
  const errors: string[] = [];
  list.forEach((raw, i) => {
    const at = `Offer ${i + 1}`;
    if (raw === null || typeof raw !== 'object') return void errors.push(`${at}: not an object`);
    const o = raw as Record<string, unknown>;
    const cardName = typeof o.card === 'string' ? o.card : '';
    const card = matchCard(cardName, accounts);
    if (!card) return void errors.push(`${at}: no credit card matches "${cardName}". Add it in Settings, Accounts, or fix the name.`);

    const typeRaw = String(o.type ?? o.kind ?? '').toLowerCase();
    const kind: OfferKind | null = /cash/.test(typeRaw) ? 'cashback_pct' : /point|reward/.test(typeRaw) ? 'points_per_100' : /flat|off|discount/.test(typeRaw) ? 'flat' : null;
    if (!kind) return void errors.push(`${at}: type must be cashback, points or flat`);
    const rate = num(o.rate);
    if (rate === null || rate <= 0) return void errors.push(`${at}: rate must be a number above zero`);

    let categoryId: string | null = null;
    if (typeof o.category === 'string' && o.category.trim()) {
      const c = categories.find(x => norm(x.name) === norm(o.category as string));
      if (!c) return void errors.push(`${at}: no category named "${o.category}"`);
      categoryId = c.id;
    }
    const excluded: string[] = [];
    if (Array.isArray(o.exclude)) {
      for (const name of o.exclude) {
        const c = typeof name === 'string' ? categories.find(x => norm(x.name) === norm(name)) : undefined;
        if (!c) return void errors.push(`${at}: no category named "${String(name)}" to exclude`);
        excluded.push(c.id);
      }
    }
    const merchant = typeof o.merchant === 'string' && o.merchant.trim() ? o.merchant.trim().slice(0, 40) : null;
    const title = (typeof o.title === 'string' && o.title.trim() ? o.title.trim() : [merchant, o.category].filter(Boolean).join(' ') || 'All spends').slice(0, 80);

    const pointValue = num(o.pointValue);
    if (kind === 'points_per_100' && (pointValue === null || pointValue <= 0)) return void errors.push(`${at}: points need pointValue, what one point is worth in rupees`);
    const capPer = String(o.capPer ?? o.capPeriod ?? '').toLowerCase();
    const cap = rupeesToPaise(o.cap);

    offers.push({
      account_id: card.id,
      title,
      category_id: categoryId,
      merchant,
      kind,
      rate,
      point_value_paise: kind === 'points_per_100' && pointValue !== null ? Math.max(1, Math.round(pointValue * 100)) : null,
      cap_paise: cap,
      cap_period: cap === null ? null : /quarter/.test(capPer) ? 'quarter' : /cycle|statement/.test(capPer) ? 'cycle' : 'month',
      min_spend_paise: rupeesToPaise(o.minSpend),
      exclude_category_ids: excluded,
      valid_from: date(o.validFrom),
      valid_to: date(o.validTo),
      note: typeof o.note === 'string' && o.note.trim() ? o.note.trim().slice(0, 200) : null,
    });
  });
  return { offers, errors };
}
