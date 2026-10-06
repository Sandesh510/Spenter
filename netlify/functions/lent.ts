import { parseRupeesToPaise } from '../../src/lib/money';
import { authed } from './_lib/handler';
import { assertOwned, optStr, readJson, reqId, reqStr } from './_lib/input';
import { loadLent } from './_lib/data';
import { HttpError, json } from './_lib/response';

/**
 * GET  /lent → every loan for the user
 * POST /lent { action:'add', name, amount, note?, lentOn?, accountId? }
 * POST /lent { action:'update', id, name, amount, note?, lentOn, accountId? }   → edit a loan; '' clears the account
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
      reqId({ accountId: debitAccountId }, 'accountId');
      await assertOwned(admin, userId, 'spend_accounts', [debitAccountId]);
    }
    const lentOn = optStr(b, 'lentOn', 10);
    if (lentOn && !/^\d{4}-\d{2}-\d{2}$/.test(lentOn)) throw new HttpError(400, 'Invalid date');
    const { data, error } = await admin
      .from('spend_lent_loans')
      .insert({ user_id: userId, person_name: name, amount_paise: amountPaise, note: optStr(b, 'note', 120), debit_account_id: debitAccountId, ...(lentOn ? { lent_on: lentOn } : {}) })
      .select('id')
      .single();
    if (error) throw error;
    return json(201, { id: data.id });
  }

  if (action === 'update') {
    const id = reqStr(b, 'id', 60);
    const name = reqStr(b, 'name', 60);
    let amountPaise: number;
    try {
      amountPaise = parseRupeesToPaise(reqStr(b, 'amount', 20));
    } catch (err) {
      throw new HttpError(400, err instanceof Error ? err.message : 'Invalid amount');
    }
    const lentOn = reqStr(b, 'lentOn', 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lentOn)) throw new HttpError(400, 'Invalid date');
    // Empty string clears the account link; a missing field leaves it as it is.
    const accountRaw = b.accountId;
    const debitAccountId = typeof accountRaw === 'string' && accountRaw !== '' ? accountRaw : null;
    if (debitAccountId) {
      reqId({ accountId: debitAccountId }, 'accountId');
      await assertOwned(admin, userId, 'spend_accounts', [debitAccountId]);
    }
    // What has already come back cannot be more than the new loan amount.
    const { data: loan, error: loanErr } = await admin
      .from('spend_lent_loans')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (loanErr) throw loanErr;
    if (!loan) throw new HttpError(404, 'Loan not found');
    const { data: backs, error: backErr } = await admin
      .from('spend_transactions')
      .select('amount_paise')
      .eq('user_id', userId)
      .eq('lent_loan_id', id)
      .eq('credit_category', 'gone_back')
      .is('deleted_at', null);
    if (backErr) throw backErr;
    const returned = (backs ?? []).reduce((s, r) => s + r.amount_paise, 0);
    if (amountPaise < returned) {
      throw new HttpError(400, `Amount cannot be less than the ${(returned / 100).toFixed(2)} already got back`);
    }
    const { error } = await admin
      .from('spend_lent_loans')
      .update({
        person_name: name,
        amount_paise: amountPaise,
        lent_on: lentOn,
        note: optStr(b, 'note', 120) ?? null,
        debit_account_id: debitAccountId,
      })
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
    return json(200, { ok: true });
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
