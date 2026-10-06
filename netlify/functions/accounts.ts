import { authed } from './_lib/handler';
import { reqId, reqStr, optStr, readJson } from './_lib/input';
import { HttpError, json } from './_lib/response';

const MAX_ACCOUNTS = 6;

/**
 * GET   /accounts                       → the user's accounts (max 6)
 * POST  /accounts  { nickname, bank?, kind? }
 * PATCH /accounts  { id, nickname }     → rename
 */
export const handler = authed(['GET', 'POST', 'PATCH'], async ({ admin, userId, event }) => {
  if (event.httpMethod === 'GET') {
    const { data, error } = await admin
      .from('spend_accounts')
      .select('id,nickname,bank,kind,icon,position')
      .eq('user_id', userId)
      .order('position', { ascending: true });
    if (error) throw error;
    return json(200, { items: data ?? [] });
  }

  const b = readJson(event.body);

  if (event.httpMethod === 'POST') {
    const { count, error: countErr } = await admin
      .from('spend_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (countErr) throw countErr;
    if ((count ?? 0) >= MAX_ACCOUNTS) throw new HttpError(400, `Up to ${MAX_ACCOUNTS} accounts`);

    const { data, error } = await admin
      .from('spend_accounts')
      .insert({
        user_id: userId,
        nickname: reqStr(b, 'nickname', 40),
        bank: optStr(b, 'bank', 60),
        kind: optStr(b, 'kind', 40),
        icon: 'wallet',
        position: count ?? 0,
      })
      .select('id')
      .single();
    if (error) {
      if (error.code === '23505') throw new HttpError(409, 'That account name is already used');
      throw error;
    }
    return json(201, { id: data.id });
  }

  // PATCH: rename
  const id = reqId(b, 'id');
  const nickname = reqStr(b, 'nickname', 40);
  const { error, count } = await admin
    .from('spend_accounts')
    .update({ nickname }, { count: 'exact' })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) {
    if (error.code === '23505') throw new HttpError(409, 'That account name is already used');
    throw error;
  }
  if (!count) throw new HttpError(404, 'Account not found');
  return json(200, { ok: true });
});
