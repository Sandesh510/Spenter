import { authed } from './_lib/handler';
import { assertOwned, optStr, readJson, reqId, reqStr } from './_lib/input';
import { HttpError, json } from './_lib/response';
import { CATEGORY_ICON_CHOICES } from '../../src/lib/categoryIcons';

const BUCKETS = ['need', 'want', 'save'];

/**
 * POST   /categories { name, bucket, icon }                → add a category at the end of the list
 * PATCH  /categories { id, name, bucket, icon }            → edit a category
 * PATCH  /categories { id, move: 'up' | 'down' }           → swap order with the neighbour
 * DELETE /categories?id=…[&reassignTo=…]                   → delete; 409 while entries use it
 * Deleting with reassignTo moves transactions, commitments, insurance policies and asks to that category first.
 */
export const handler = authed(['POST', 'PATCH', 'DELETE'], async ({ admin, userId, event }) => {
  if (event.httpMethod === 'DELETE') {
    const id = reqId({ id: event.queryStringParameters?.id ?? '' }, 'id');
    const reassignTo = event.queryStringParameters?.reassignTo ?? '';
    await assertOwned(admin, userId, 'spend_categories', [id]);

    const { count: txnCount, error: txnErr } = await admin
      .from('spend_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('category_id', id);
    if (txnErr) throw txnErr;
    const { count: commitCount, error: commitErr } = await admin
      .from('spend_commitments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('category_id', id);
    if (commitErr) throw commitErr;
    const { count: policyCount, error: policyErr } = await admin
      .from('spend_insurance_policies')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('category_id', id);
    if (policyErr) throw policyErr;
    const inUse = (txnCount ?? 0) + (commitCount ?? 0) + (policyCount ?? 0);

    if (inUse > 0) {
      if (!reassignTo) {
        throw new HttpError(409, `${inUse} ${inUse === 1 ? 'entry uses' : 'entries use'} this category. Choose a category to move them to.`);
      }
      if (reassignTo === id) throw new HttpError(400, 'Choose a different category');
      await assertOwned(admin, userId, 'spend_categories', [reassignTo]);
      for (const table of ['spend_transactions', 'spend_commitments', 'spend_insurance_policies', 'spend_asks'] as const) {
        const { error } = await admin.from(table).update({ category_id: reassignTo }).eq('user_id', userId).eq('category_id', id);
        if (error) throw error;
      }
    }

    // Budgets for the category are removed with it (cascade).
    const { error, count } = await admin.from('spend_categories').delete({ count: 'exact' }).eq('id', id).eq('user_id', userId);
    if (error) throw error;
    if (!count) throw new HttpError(404, 'Category not found');
    return json(200, { ok: true, moved: inUse });
  }

  const b = readJson(event.body);

  if (event.httpMethod === 'PATCH' && typeof b.move === 'string') {
    const id = reqId(b, 'id');
    const direction = b.move;
    if (direction !== 'up' && direction !== 'down') throw new HttpError(400, 'Invalid move');
    const { data: all, error: listErr } = await admin
      .from('spend_categories')
      .select('id')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (listErr) throw listErr;
    // Rewrite the whole order, so gaps and duplicates from older data are cleared.
    const ids = (all ?? []).map(c => c.id);
    const i = ids.indexOf(id);
    if (i < 0) throw new HttpError(404, 'Category not found');
    const j = direction === 'up' ? i - 1 : i + 1;
    if (j >= 0 && j < ids.length) [ids[i], ids[j]] = [ids[j], ids[i]];
    for (const [position, catId] of ids.entries()) {
      const { error } = await admin.from('spend_categories').update({ sort_order: position }).eq('id', catId).eq('user_id', userId);
      if (error) throw error;
    }
    return json(200, { ok: true });
  }

  const name = reqStr(b, 'name', 40);
  const bucket = reqStr(b, 'bucket', 10);
  if (!BUCKETS.includes(bucket)) throw new HttpError(400, 'Choose Needs, Wants or Savings');
  const icon = optStr(b, 'icon', 40) ?? 'tag';
  if (!CATEGORY_ICON_CHOICES.some(c => c.name === icon)) throw new HttpError(400, 'Choose an icon from the list');
  const write = { name, bucket, icon };

  if (event.httpMethod === 'POST') {
    const { count, error: countErr } = await admin
      .from('spend_categories')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (countErr) throw countErr;
    const { data, error } = await admin
      .from('spend_categories')
      .insert({ ...write, user_id: userId, sort_order: count ?? 0 })
      .select('id')
      .single();
    if (error) {
      if (error.code === '23505') throw new HttpError(409, 'A category with that name already exists');
      throw error;
    }
    return json(201, { id: data.id });
  }

  const id = reqId(b, 'id');
  const { error, count } = await admin
    .from('spend_categories')
    .update(write, { count: 'exact' })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) {
    if (error.code === '23505') throw new HttpError(409, 'A category with that name already exists');
    throw error;
  }
  if (!count) throw new HttpError(404, 'Category not found');
  return json(200, { ok: true });
});
