import { authed } from './_lib/handler';
import { reqId, reqStr, optStr, readJson } from './_lib/input';
import { HttpError, json } from './_lib/response';

import { MAX_ACCOUNTS } from '../../src/lib/limits';
import { isAccountKind } from '../../src/lib/accountTypes';

/**
 * GET   /accounts                       → the user's accounts (max 10)
 * POST  /accounts  { nickname, bank?, kind: bank | savings | credit_card | wallet }
 * PATCH  /accounts  { id, nickname }     → rename
 * DELETE /accounts?id=…                 → remove (refused while transactions still use it)
 */
export const handler = authed(['GET', 'POST', 'PATCH', 'DELETE'], async ({ admin, userId, event }) => {
  if (event.httpMethod === 'GET') {
    const { data, error } = await admin
      .from('spend_accounts')
      .select('id,nickname,bank,kind,icon,position')
      .eq('user_id', userId)
      .order('position', { ascending: true });
    if (error) throw error;
    return json(200, { items: data ?? [] });
  }

  if (event.httpMethod === 'DELETE') {
    const id = reqId({ id: event.queryStringParameters?.id ?? '' }, 'id');
    const { error, count } = await admin
      .from('spend_accounts')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('user_id', userId);
    if (error) {
      // Transactions (even deleted ones, kept for history) reference accounts with ON DELETE RESTRICT.
      if (error.code === '23503') throw new HttpError(409, 'This account has transactions. Delete or edit them first.');
      throw error;
    }
    if (!count) throw new HttpError(404, 'Account not found');
    return json(200, { ok: true });
  }

  const b = readJson(event.body);

  if (event.httpMethod === 'POST') {
    const { count, error: countErr } = await admin
      .from('spend_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (countErr) throw countErr;
    if ((count ?? 0) >= MAX_ACCOUNTS) throw new HttpError(400, `Up to ${MAX_ACCOUNTS} accounts`);

    const kind = optStr(b, 'kind', 40) ?? 'bank';
    if (!isAccountKind(kind)) throw new HttpError(400, 'Choose an account type');
    const { data, error } = await admin
      .from('spend_accounts')
      .insert({
        user_id: userId,
        nickname: reqStr(b, 'nickname', 40),
        bank: optStr(b, 'bank', 60),
        kind,
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
