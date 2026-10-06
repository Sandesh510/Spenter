import { parseRupeesToPaise } from '../../src/lib/money';
import { authed } from './_lib/handler';
import { assertOwned, optStr, readJson, reqId, reqStr } from './_lib/input';
import { loadLent } from './_lib/data';
import { HttpError, json } from './_lib/response';

/**
 * GET  /lent → every loan for the user
 * POST /lent { action:'add', name, amount, note? }
 * POST /lent { action:'settle', id }            → mark one loan returned
 * POST /lent { action:'settle_person', name }   → mark all open loans with this person returned
 * Lent money never changes the spendable balance (README: Money Lent).
 */
export const handler = authed(['GET', 'POST'], async ({ admin, userId, event }) => {
  if (event.httpMethod === 'GET') {
    return json(200, await loadLent(admin, userId));
  }

  const b = readJson(event.body);
  const action = reqStr(b, 'action', 20);

  if (action === 'add') {
    const name = reqStr(b, 'name', 60);
    let amountPaise: number;
    try {
      amountPaise = parseRupeesToPaise(reqStr(b, 'amount', 20));
    } catch (err) {
      throw new HttpError(400, err instanceof Error ? err.message : 'Invalid amount');
    }
    // The account the money left from. Optional, so loans recorded before accounts were linked still work.
    const debitAccountId = optStr(b, 'accountId', 60);
    if (debitAccountId) {
      reqId({ debitAccountId }, 'accountId');
      await assertOwned(admin, userId, 'spend_accounts', [debitAccountId]);
    }
    const { data, error } = await admin
      .from('spend_lent_loans')
      .insert({ user_id: userId, person_name: name, amount_paise: amountPaise, note: optStr(b, 'note', 120), debit_account_id: debitAccountId })
      .select('id')
      .single();
    if (error) throw error;
    return json(201, { id: data.id });
  }

  if (action === 'settle') {
    const id = reqStr(b, 'id', 60);
    const { error, count } = await admin
      .from('spend_lent_loans')
      .update({ settled_at: new Date().toISOString() }, { count: 'exact' })
      .eq('id', id)
      .eq('user_id', userId)
      .is('settled_at', null);
    if (error) throw error;
    if (!count) throw new HttpError(404, 'Loan not found or already returned');
    return json(200, { ok: true });
  }

  if (action === 'settle_person') {
    const name = reqStr(b, 'name', 60);
    const { error } = await admin
      .from('spend_lent_loans')
      .update({ settled_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('person_name', name)
      .is('settled_at', null);
    if (error) throw error;
    return json(200, { ok: true });
  }

  throw new HttpError(400, 'Unknown action');
});
