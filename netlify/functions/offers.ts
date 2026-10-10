import { authed } from './_lib/handler';
import { assertOwned, optStr, readJson, reqId, reqStr } from './_lib/input';
import { HttpError, json } from './_lib/response';

const KINDS = ['cashback_pct', 'points_per_100', 'flat'] as const;
const PERIODS = ['month', 'cycle', 'quarter'] as const;
const MAX_OFFERS_PER_CALL = 100;
const COLUMNS =
  'id,account_id,title,category_id,merchant,kind,rate,point_value_paise,cap_paise,cap_period,min_spend_paise,exclude_category_ids,valid_from,valid_to,note';

/**
 * GET    /offers                       → every card offer of the user
 * POST   /offers { items: [...] }      → add offers (up to 100). An offer already on the same card with the
 *                                        same title and merchant and category is skipped, so loading a
 *                                        card's standard offers twice does not duplicate them.
 * PATCH  /offers { id, ...fields }     → edit one offer
 * DELETE /offers?id=…                  → remove one offer
 * Offers are only suggestions for choosing a card; nothing here changes a balance or a total.
 */
export const handler = authed(['GET', 'POST', 'PATCH', 'DELETE'], async ({ admin, userId, event }) => {
  if (event.httpMethod === 'GET') {
    const { data, error } = await admin.from('spend_card_offers').select(COLUMNS).eq('user_id', userId).order('created_at', { ascending: true });
    if (error) throw error;
    return json(200, { items: (data ?? []).map(row => ({ ...row, rate: Number(row.rate), cap_paise: num(row.cap_paise), min_spend_paise: num(row.min_spend_paise) })) });
  }

  if (event.httpMethod === 'DELETE') {
    const id = reqId({ id: event.queryStringParameters?.id ?? '' }, 'id');
    const { error, count } = await admin.from('spend_card_offers').delete({ count: 'exact' }).eq('id', id).eq('user_id', userId);
    if (error) throw error;
    if (!count) throw new HttpError(404, 'Offer not found');
    return json(200, { ok: true });
  }

  const b = readJson(event.body);

  if (event.httpMethod === 'PATCH') {
    const id = reqId(b, 'id');
    const fields = await cleanOffer(admin, userId, b);
    const { error, count } = await admin.from('spend_card_offers').update(fields, { count: 'exact' }).eq('id', id).eq('user_id', userId);
    if (error) throw error;
    if (!count) throw new HttpError(404, 'Offer not found');
    return json(200, { ok: true });
  }

  // POST
  const raw = Array.isArray(b.items) ? b.items : [b];
  if (raw.length === 0 || raw.length > MAX_OFFERS_PER_CALL) throw new HttpError(400, `Add between 1 and ${MAX_OFFERS_PER_CALL} offers at a time`);
  const rows: Record<string, unknown>[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) throw new HttpError(400, 'Each offer must be an object');
    rows.push(await cleanOffer(admin, userId, item as Record<string, unknown>));
  }

  // Leave out offers the card already has, so loading the standard list twice adds nothing.
  const cardIds = [...new Set(rows.map(r => r.account_id as string))];
  const { data: existing, error: exErr } = await admin
    .from('spend_card_offers')
    .select('account_id,title,merchant,category_id')
    .eq('user_id', userId)
    .in('account_id', cardIds);
  if (exErr) throw exErr;
  const key = (r: { account_id: unknown; title: unknown; merchant: unknown; category_id: unknown }) =>
    `${r.account_id}|${String(r.title).toLowerCase()}|${String(r.merchant ?? '').toLowerCase()}|${r.category_id ?? ''}`;
  const have = new Set((existing ?? []).map(key));
  const fresh = rows.filter(r => {
    const k = key(r as never);
    if (have.has(k)) return false;
    have.add(k);
    return true;
  });
  if (fresh.length > 0) {
    const { error } = await admin.from('spend_card_offers').insert(fresh.map(r => ({ ...r, user_id: userId })));
    if (error) throw error;
  }
  return json(201, { added: fresh.length, skipped: rows.length - fresh.length });
});

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

/** Validates one offer's fields and returns the row to store. Ownership of the card and categories is checked. */
async function cleanOffer(admin: Parameters<Parameters<typeof authed>[1]>[0]['admin'], userId: string, b: Record<string, unknown>) {
  const kind = reqStr(b, 'kind', 20);
  if (!(KINDS as readonly string[]).includes(kind)) throw new HttpError(400, 'kind must be cashback_pct, points_per_100 or flat');
  const rate = Number(b.rate);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1_000_000) throw new HttpError(400, 'rate must be a number above zero');

  const accountId = reqId(b, 'account_id');
  const categoryId = optStr(b, 'category_id', 60);
  if (categoryId) reqId({ category_id: categoryId }, 'category_id');
  const excluded = Array.isArray(b.exclude_category_ids) ? b.exclude_category_ids.map(v => reqId({ id: v }, 'id')) : [];
  await assertOwned(admin, userId, 'spend_accounts', [accountId]);
  await assertOwned(admin, userId, 'spend_categories', [...(categoryId ? [categoryId] : []), ...excluded]);

  const pointValue = b.point_value_paise === null || b.point_value_paise === undefined ? null : Number(b.point_value_paise);
  if (kind === 'points_per_100' && (pointValue === null || !Number.isInteger(pointValue) || pointValue <= 0)) {
    throw new HttpError(400, 'Points need point_value_paise, what one point is worth');
  }
  const cap = wholePaise(b.cap_paise, 'cap_paise');
  const period = optStr(b, 'cap_period', 10);
  if (period !== null && !(PERIODS as readonly string[]).includes(period)) throw new HttpError(400, 'cap_period must be month, cycle or quarter');

  return {
    account_id: accountId,
    title: reqStr(b, 'title', 80),
    category_id: categoryId,
    merchant: optStr(b, 'merchant', 40),
    kind,
    rate,
    point_value_paise: kind === 'points_per_100' ? pointValue : null,
    cap_paise: cap,
    cap_period: cap === null ? null : period ?? 'month',
    min_spend_paise: wholePaise(b.min_spend_paise, 'min_spend_paise'),
    exclude_category_ids: excluded,
    valid_from: dateOrNull(b.valid_from, 'valid_from'),
    valid_to: dateOrNull(b.valid_to, 'valid_to'),
    note: optStr(b, 'note', 200),
  };
}

function wholePaise(v: unknown, name: string): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `${name} must be a whole number of paise above zero`);
  return n;
}

function dateOrNull(v: unknown, name: string): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new HttpError(400, `${name} must be YYYY-MM-DD`);
  return v;
}
