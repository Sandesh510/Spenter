import { parseRupeesToPaise } from '../../src/lib/money';
import { emiSplit, nextDue, rateToBps } from '../../src/lib/commitments';
import { authed } from './_lib/handler';
import { COMMITMENT_COLUMNS, type CommitmentRow } from './_lib/commitments';
import { assertOwned, dateOrToday, optStr, readJson, reqId, reqStr, todayIST } from './_lib/input';
import { currentMonthIST, monthRange } from './_lib/month';
import { HttpError, json } from './_lib/response';

const KINDS = ['subscription', 'investment', 'loan'] as const;

/**
 * GET    /commitments                 → every commitment, with this month's posting state and loan figures
 * POST   /commitments                 → add a subscription, SIP investment or loan
 * PATCH  /commitments { id, active }  → pause or resume posting
 * DELETE /commitments?id=…            → remove the commitment; past postings stay in the Log
 */
export const handler = authed(['GET', 'POST', 'PATCH', 'DELETE'], async ({ admin, userId, event }) => {
  const today = todayIST();
  const month = currentMonthIST();
  const { firstDay } = monthRange(month);

  if (event.httpMethod === 'GET') {
    const { data: rows, error } = await admin
      .from('spend_commitments')
      .select(COMMITMENT_COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    const commitments = (rows ?? []) as CommitmentRow[];

    const [catRes, postRes] = await Promise.all([
      admin.from('spend_categories').select('id,name,bucket').eq('user_id', userId),
      admin
        .from('spend_transactions')
        .select('commitment_id')
        .eq('user_id', userId)
        .eq('commitment_month', firstDay)
        .not('commitment_id', 'is', null),
    ]);
    if (catRes.error) throw catRes.error;
    if (postRes.error) throw postRes.error;
    const categories = new Map((catRes.data ?? []).map(c => [c.id, c]));
    const postedIds = new Set((postRes.data ?? []).map(p => p.commitment_id));

    const items = commitments.map(c => {
      const cat = categories.get(c.category_id);
      const next = nextDue({ startsOn: c.starts_on, day: c.day_of_month, today });
      let loan = null;
      if (c.kind === 'loan') {
        const outstanding = c.outstanding_paise ?? 0;
        const split = emiSplit({ outstandingPaise: outstanding, rateBps: c.rate_bps ?? 0, emiPaise: c.amount_paise });
        loan = {
          isNew: c.loan_is_new ?? false,
          outstandingPaise: outstanding,
          rateBps: c.rate_bps ?? 0,
          tenureRemaining: c.tenure_remaining ?? 0,
          nextEmiDate: next,
          nextInterestPaise: split.interestPaise,
          nextPrincipalPaise: split.principalPaise,
          remainingAfterNextPaise: Math.max(0, outstanding - split.principalPaise),
        };
      }
      return {
        id: c.id,
        kind: c.kind,
        name: c.name,
        amountPaise: c.amount_paise,
        dayOfMonth: c.day_of_month,
        categoryId: c.category_id,
        categoryName: cat?.name ?? null,
        bucket: cat?.bucket ?? null,
        accountId: c.account_id,
        active: c.active,
        startsOn: c.starts_on,
        postedThisMonth: postedIds.has(c.id),
        nextDueDate: next,
        loan,
      };
    });

    const monthlyActive = (kind: string) =>
      items.filter(i => i.kind === kind && i.active).reduce((s, i) => s + i.amountPaise, 0);
    return json(200, {
      month,
      items,
      totals: {
        subscriptionsPaise: monthlyActive('subscription'),
        investmentsPaise: monthlyActive('investment'),
        emisPaise: monthlyActive('loan'),
      },
    });
  }

  if (event.httpMethod === 'DELETE') {
    const id = event.queryStringParameters?.id;
    if (!id) throw new HttpError(400, 'id is required');
    const { error, count } = await admin
      .from('spend_commitments')
      .delete({ count: 'exact' })
      .eq('id', reqId({ id }, 'id'))
      .eq('user_id', userId);
    if (error) throw error;
    if (!count) throw new HttpError(404, 'Commitment not found');
    return json(200, { ok: true });
  }

  const b = readJson(event.body);

  if (event.httpMethod === 'PATCH') {
    const id = reqId(b, 'id');
    if (typeof b.active !== 'boolean') throw new HttpError(400, 'active must be true or false');
    // Resuming starts again from today, so the paused months are skipped, not posted all at once.
    const patch = b.active
      ? { active: true, starts_on: todayIST(), updated_at: new Date().toISOString() }
      : { active: false, updated_at: new Date().toISOString() };
    const { error, count } = await admin
      .from('spend_commitments')
      .update(patch, { count: 'exact' })
      .eq('id', id)
      .eq('user_id', userId)
      .eq('active', !b.active);
    if (error) throw error;
    if (!count) {
      const { data: exists, error: findErr } = await admin.from('spend_commitments').select('id').eq('id', id).eq('user_id', userId).maybeSingle();
      if (findErr) throw findErr;
      if (!exists) throw new HttpError(404, 'Commitment not found');
    }
    return json(200, { ok: true });
  }

  // POST
  const kindRaw = reqStr(b, 'kind', 20);
  if (!(KINDS as readonly string[]).includes(kindRaw)) throw new HttpError(400, 'kind must be subscription, investment or loan');
  const kind = kindRaw as (typeof KINDS)[number];

  const name = reqStr(b, 'name', 60);
  const amountPaise = paise(b, 'amount', 'Monthly amount');
  const day = Number(b.day);
  if (!Number.isInteger(day) || day < 1 || day > 28) throw new HttpError(400, 'Day of month must be 1 to 28');
  const startsOn = dateOrToday(optStr(b, 'startsOn', 10));
  const accountId = reqId(b, 'accountId');

  // A SIP always posts under the Investment category; the other kinds take the category the user picked.
  let categoryId: string;
  if (kind === 'investment') {
    const { data, error } = await admin
      .from('spend_categories')
      .select('id')
      .eq('user_id', userId)
      .eq('name', 'Investment')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(400, 'No Investment category to post to');
    categoryId = data.id;
  } else {
    categoryId = reqId(b, 'categoryId');
  }
  await assertOwned(admin, userId, 'spend_categories', [categoryId]);
  await assertOwned(admin, userId, 'spend_accounts', [accountId]);

  let loanFields: Record<string, unknown> = {};
  let outstandingPaise = 0;
  const isNew = b.loanIsNew === true;
  if (kind === 'loan') {
    outstandingPaise = paise(b, 'outstanding', 'Outstanding amount');
    let rateBps: number;
    try {
      rateBps = rateToBps(reqStr(b, 'rate', 6));
    } catch (err) {
      throw new HttpError(400, err instanceof Error ? err.message : 'Invalid rate');
    }
    const tenure = Number(b.tenure);
    if (!Number.isInteger(tenure) || tenure < 1 || tenure > 600) throw new HttpError(400, 'Remaining tenure must be 1 to 600 months');
    loanFields = {
      loan_is_new: isNew,
      outstanding_paise: outstandingPaise,
      rate_bps: rateBps,
      tenure_remaining: tenure,
    };
  }

  const { data, error } = await admin
    .from('spend_commitments')
    .insert({
      user_id: userId,
      kind,
      name,
      amount_paise: amountPaise,
      day_of_month: day,
      category_id: categoryId,
      account_id: accountId,
      starts_on: startsOn,
      ...loanFields,
    })
    .select('id')
    .single();
  if (error) throw error;

  // A new loan brings its principal in as money received, under Others. An existing loan does not:
  // the money was already received, so the loan only tracks repayments.
  if (kind === 'loan' && isNew) {
    const { error: creditErr } = await admin.from('spend_transactions').insert({
      user_id: userId,
      type: 'credit',
      amount_paise: outstandingPaise,
      txn_date: startsOn,
      account_id: accountId,
      credit_category: 'borrowed',
      reference: `Loan received: ${name}`,
    });
    if (creditErr) throw creditErr;
  }

  return json(201, { id: data.id });
});

/** Reads a rupee amount field into paise, with a clear message when it is missing or invalid. */
function paise(b: Record<string, unknown>, key: string, label: string): number {
  try {
    return parseRupeesToPaise(reqStr(b, key, 20));
  } catch (err) {
    throw new HttpError(400, err instanceof Error ? err.message : `${label} is invalid`);
  }
}
