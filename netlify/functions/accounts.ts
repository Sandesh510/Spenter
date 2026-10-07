import type { SupabaseClient } from '@supabase/supabase-js';
import { authed } from './_lib/handler';
import { dateOrToday, reqId, reqStr, optStr, readJson, todayIST } from './_lib/input';
import { loadAccounts, loadBalanceInputs } from './_lib/data';
import { HttpError, json } from './_lib/response';

import { MAX_ACCOUNTS } from '../../src/lib/limits';
import { isAccountKind } from '../../src/lib/accountTypes';
import { openingForActual } from '../../src/lib/accountBalance';
import { parseBalanceToPaise, parseRupeesToPaise } from '../../src/lib/money';

/**
 * GET   /accounts                       → the user's accounts (max 10), each with balance_paise (null when no opening balance)
 * POST  /accounts  { nickname, bank?, kind: bank | savings | credit_card | wallet }
 * PATCH  /accounts  { id, nickname, bank?, kind?, openingBalance?, openingBalanceOn? } → edit; bank '' clears it.
 *        openingBalance is rupees (may be negative; a card's amount owed is negative); '' clears it.
 *        openingBalanceOn is YYYY-MM-DD, defaults to today, never in the future.
 * PATCH  /accounts  { id, action: 'reconcile', actual } → Match my bank: the balance shown becomes `actual` from today
 * DELETE /accounts?id=…                 → remove (refused while entries, commitments, policies or plans use it)
 */
export const handler = authed(['GET', 'POST', 'PATCH', 'DELETE'], async ({ admin, userId, event }) => {
  if (event.httpMethod === 'GET') {
    return json(200, await loadAccounts(admin, userId));
  }

  if (event.httpMethod === 'DELETE') {
    const id = reqId({ id: event.queryStringParameters?.id ?? '' }, 'id');
    const { error, count } = await admin
      .from('spend_accounts')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('user_id', userId);
    if (error) {
      // Transactions (even deleted ones, kept for history), commitments, insurance policies and savings
      // plans reference accounts with ON DELETE RESTRICT. Say which one is in the way.
      if (error.code === '23503') throw new HttpError(409, await accountInUseMessage(admin, userId, id));
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

  const id = reqId(b, 'id');

  // PATCH reconcile: make the shown balance equal what the bank says now.
  if (b.action !== undefined) {
    if (b.action !== 'reconcile') throw new HttpError(400, 'Unknown action');
    const actualPaise = balanceField(reqStr(b, 'actual', 20));
    const { data: acct, error: acctErr } = await admin
      .from('spend_accounts')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (acctErr) throw acctErr;
    if (!acct) throw new HttpError(404, 'Account not found');
    // The new opening applies from the start of today, so entries already dated today (or later) are taken back out.
    const today = todayIST();
    const { txns, loans } = await loadBalanceInputs(admin, userId, [id], today);
    const openingPaise = openingForActual(id, actualPaise, today, txns, loans);
    const { error } = await admin
      .from('spend_accounts')
      .update({ opening_balance_paise: openingPaise, opening_balance_on: today })
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
    return json(200, { ok: true, balance_paise: actualPaise });
  }

  // PATCH: rename, change type, set or clear the opening balance
  const nickname = reqStr(b, 'nickname', 40);
  const patch: Record<string, unknown> = { nickname };
  if ('bank' in b) patch.bank = optStr(b, 'bank', 60);
  if ('kind' in b) {
    const kind = optStr(b, 'kind', 40) ?? 'bank';
    if (!isAccountKind(kind)) throw new HttpError(400, 'Choose an account type');
    patch.kind = kind;
  }
  if ('creditLimit' in b) {
    const raw = optStr(b, 'creditLimit', 20);
    if (raw === null) patch.credit_limit_paise = null;
    else {
      try {
        patch.credit_limit_paise = parseRupeesToPaise(raw);
      } catch (err) {
        throw new HttpError(400, err instanceof Error ? err.message : 'Invalid credit limit');
      }
    }
  }
  // A limit only means something on a credit card.
  if (patch.kind !== undefined && patch.kind !== 'credit_card') patch.credit_limit_paise = null;
  if ('openingBalance' in b) {
    const raw = optStr(b, 'openingBalance', 20);
    if (raw === null) {
      // '' clears the balance; the account then shows no balance.
      patch.opening_balance_paise = null;
      patch.opening_balance_on = null;
    } else {
      patch.opening_balance_paise = balanceField(raw);
      const on = dateOrToday(optStr(b, 'openingBalanceOn', 10));
      if (on > todayIST()) throw new HttpError(400, 'The opening date cannot be in the future');
      patch.opening_balance_on = on;
    }
  }
  const { error, count } = await admin
    .from('spend_accounts')
    .update(patch, { count: 'exact' })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) {
    if (error.code === '23505') throw new HttpError(409, 'That account name is already used');
    throw error;
  }
  if (!count) throw new HttpError(404, 'Account not found');
  return json(200, { ok: true });
});

/** A typed balance in rupees (may be zero or negative) as paise, or a 400. */
function balanceField(raw: string): number {
  try {
    return parseBalanceToPaise(raw);
  } catch (err) {
    throw new HttpError(400, err instanceof Error ? err.message : 'Invalid balance');
  }
}

/** Names what still uses an account, for the message when deleting it is refused. */
async function accountInUseMessage(admin: SupabaseClient, userId: string, id: string): Promise<string> {
  const uses: [string, string][] = [
    ['spend_transactions', 'entries'],
    ['spend_commitments', 'commitments'],
    ['spend_insurance_policies', 'insurance policies'],
    ['spend_savings_plans', 'savings plans'],
  ];
  const found: string[] = [];
  for (const [table, label] of uses) {
    const { count } = await admin.from(table).select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('account_id', id);
    if ((count ?? 0) > 0) found.push(label);
  }
  // Transfers into this account point at it from to_account_id.
  if (!found.includes('entries')) {
    const { count } = await admin.from('spend_transactions').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('to_account_id', id);
    if ((count ?? 0) > 0) found.push('entries');
  }
  const list = found.length ? found.join(', ') : 'other records';
  return `This account is still used by ${list}. Move or remove them first.`;
}
