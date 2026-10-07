import { parseRupeesToPaise } from '../../src/lib/money';
import { POLICY_TYPES, FREQUENCIES, advanceDue, dayOf, nextDueFrom, type Frequency } from '../../src/lib/insurance';
import { authed } from './_lib/handler';
import { assertOwned, optStr, readJson, reqId, reqStr, todayIST } from './_lib/input';
import { anchorOf, postInsurance, POLICY_COLUMNS, type PolicyRow } from './_lib/insurance';
import { HttpError, json } from './_lib/response';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function optPaise(b: Record<string, unknown>, key: string): number | null {
  const raw = optStr(b, key, 20);
  if (raw === null) return null;
  try {
    return parseRupeesToPaise(raw);
  } catch (err) {
    throw new HttpError(400, err instanceof Error ? err.message : 'Invalid amount');
  }
}

/**
 * GET    /insurance                               → the user's policies
 * POST   /insurance { name, insurer?, policyNumber?, policyType, premium, frequency,
 *                     nextDueOn, sumAssured?, accountId, categoryId, autoDebit }
 * PATCH  /insurance { id, action: 'paid', paidOn? }  → record this premium as paid (manual policies only)
 * PATCH  /insurance { id, active }                   → pause or resume
 * PATCH  /insurance { id, categoryId }               → file the policy and its past premiums under another category
 * DELETE /insurance?id=…                             → remove; past premiums stay in the Log
 * A premium is recorded once per due date, so a manual payment and an auto-debit cannot both count.
 */
export const handler = authed(['GET', 'POST', 'PATCH', 'DELETE'], async ({ admin, userId, event }) => {
  const today = todayIST();

  if (event.httpMethod === 'GET') {
    await postInsurance(admin, userId, today);
    const { data, error } = await admin
      .from('spend_insurance_policies')
      .select(POLICY_COLUMNS)
      .eq('user_id', userId)
      .order('next_due_on', { ascending: true });
    if (error) throw error;
    return json(200, { items: data ?? [] });
  }

  if (event.httpMethod === 'DELETE') {
    const id = reqId({ id: event.queryStringParameters?.id ?? '' }, 'id');
    const { error, count } = await admin
      .from('spend_insurance_policies')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
    if (!count) throw new HttpError(404, 'Policy not found');
    return json(200, { ok: true });
  }

  const b = readJson(event.body);

  if (event.httpMethod === 'PATCH') {
    const id = reqId(b, 'id');

    if (b.action === 'paid') {
      const { data, error } = await admin
        .from('spend_insurance_policies')
        .select(POLICY_COLUMNS)
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new HttpError(404, 'Policy not found');
      const p = data as PolicyRow;
      if (p.auto_debit) throw new HttpError(400, 'This premium is posted automatically on its due date');

      const paidOn = optStr(b, 'paidOn', 10) ?? today;
      if (!DATE.test(paidOn)) throw new HttpError(400, 'Invalid date');
      const { error: insErr } = await admin.from('spend_transactions').insert({
        user_id: userId,
        type: 'spend',
        amount_paise: p.premium_paise,
        txn_date: paidOn,
        description: p.name,
        category_id: p.category_id,
        account_id: p.account_id,
        policy_id: p.id,
        policy_due_on: p.next_due_on,
      });
      if (insErr) {
        if (insErr.code === '23505') throw new HttpError(409, 'This premium is already recorded');
        throw insErr;
      }
      const { error: updErr } = await admin
        .from('spend_insurance_policies')
        .update({ next_due_on: advanceDue(p.next_due_on, p.frequency as Frequency, anchorOf(p)), updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId);
      if (updErr) throw updErr;
      return json(200, { ok: true });
    }

    if (b.categoryId !== undefined) {
      const categoryId = reqId(b, 'categoryId');
      await assertOwned(admin, userId, 'spend_categories', [categoryId]);
      const { error, count } = await admin
        .from('spend_insurance_policies')
        .update({ category_id: categoryId, updated_at: new Date().toISOString() }, { count: 'exact' })
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw error;
      if (!count) throw new HttpError(404, 'Policy not found');
      // Premiums already recorded for this policy move too, so the old category's spend is corrected.
      const { error: moveErr } = await admin
        .from('spend_transactions')
        .update({ category_id: categoryId })
        .eq('user_id', userId)
        .eq('policy_id', id);
      if (moveErr) throw moveErr;
      return json(200, { ok: true });
    }

    if (typeof b.active !== 'boolean') throw new HttpError(400, 'Nothing to update');
    const { data: current, error: readErr } = await admin
      .from('spend_insurance_policies')
      .select(POLICY_COLUMNS)
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!current) throw new HttpError(404, 'Policy not found');
    const p = current as PolicyRow;
    const patch: Record<string, unknown> = { active: b.active, updated_at: new Date().toISOString() };
    // Resuming moves the due date to the next one from today, so premiums due while paused are not posted.
    if (b.active && !p.active) patch.next_due_on = nextDueFrom(p.next_due_on, p.frequency, today, anchorOf(p));
    const { error } = await admin.from('spend_insurance_policies').update(patch).eq('id', id).eq('user_id', userId);
    if (error) throw error;
    return json(200, { ok: true });
  }

  // POST: create a policy
  const name = reqStr(b, 'name', 60);
  const policyType = reqStr(b, 'policyType', 10);
  if (!(POLICY_TYPES as readonly string[]).includes(policyType)) throw new HttpError(400, 'Choose a policy type');
  const frequency = reqStr(b, 'frequency', 10);
  if (!(FREQUENCIES as readonly string[]).includes(frequency)) throw new HttpError(400, 'Choose a frequency');
  const premium = optPaise(b, 'premium');
  if (!premium || premium <= 0) throw new HttpError(400, 'Enter the premium');
  const nextDueOn = reqStr(b, 'nextDueOn', 10);
  if (!DATE.test(nextDueOn)) throw new HttpError(400, 'Invalid due date');
  const autoDebit = b.autoDebit === true;
  // An auto-debit posts every premium from its due date onwards, so starting in the past would post
  // old premiums at once. Start it on the next real due date.
  if (autoDebit && nextDueOn < today) throw new HttpError(400, 'For auto-debit, enter the next due date (today or later)');
  const accountId = reqId(b, 'accountId');
  const categoryId = reqId(b, 'categoryId');
  await assertOwned(admin, userId, 'spend_accounts', [accountId]);
  await assertOwned(admin, userId, 'spend_categories', [categoryId]);

  const { data, error } = await admin
    .from('spend_insurance_policies')
    .insert({
      user_id: userId,
      name,
      insurer: optStr(b, 'insurer', 60),
      policy_number: optStr(b, 'policyNumber', 40),
      policy_type: policyType,
      due_day: dayOf(nextDueOn),
      premium_paise: premium,
      frequency,
      next_due_on: nextDueOn,
      sum_assured_paise: optPaise(b, 'sumAssured'),
      account_id: accountId,
      category_id: categoryId,
      auto_debit: autoDebit,
    })
    .select('id')
    .single();
  if (error) throw error;
  return json(201, { id: data.id });
});
