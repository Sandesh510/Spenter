import { parseRupeesToPaise } from '../../src/lib/money';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authed } from './_lib/handler';
import { assertOwned, dateOrToday, optStr, readJson, reqId, reqStr } from './_lib/input';
import { monthRange, parseMonth } from './_lib/month';
import { HttpError, json } from './_lib/response';

const TYPES = ['spend', 'credit', 'transfer'] as const;
const CREDIT_CATEGORIES = ['salary', 'gone_back', 'others', 'borrowed'] as const;
type TxnType = (typeof TYPES)[number];

/**
 * GET    /transactions?month=YYYY-MM   → the month's live transactions
 * POST   /transactions                 → add a spend, money-in (credit) or transfer
 * PATCH  /transactions  { id, …fields } → replace a transaction's details (same rules as POST)
 * DELETE /transactions?id=…            → soft delete (kept for history, excluded from totals)
 */
export const handler = authed(['GET', 'POST', 'PATCH', 'DELETE'], async ({ admin, userId, event }) => {
  if (event.httpMethod === 'GET') {
    const month = parseMonth(event.queryStringParameters?.month);
    const { start, end } = monthRange(month);
    const { data, error } = await admin
      .from('spend_transactions')
      .select('id,type,amount_paise,txn_date,description,category_id,account_id,to_account_id,external,created_at,credit_category,reference,lent_loan_id')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .gte('txn_date', start)
      .lt('txn_date', end)
      .order('txn_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return json(200, { items: data ?? [] });
  }

  if (event.httpMethod === 'DELETE') {
    const id = event.queryStringParameters?.id;
    if (!id) throw new HttpError(400, 'id is required');
    const { error, count } = await admin
      .from('spend_transactions')
      .update({ deleted_at: new Date().toISOString() }, { count: 'exact' })
      .eq('id', reqId({ id }, 'id'))
      .eq('user_id', userId)
      .is('deleted_at', null);
    if (error) throw error;
    if (!count) throw new HttpError(404, 'Transaction not found');
    return json(200, { ok: true });
  }

  const b = readJson(event.body);

  if (event.httpMethod === 'PATCH') {
    const id = reqId(b, 'id');
    const fields = await parseTxn(admin, userId, b, id);
    const { error, count } = await admin
      .from('spend_transactions')
      .update({ ...fields, updated_at: new Date().toISOString() }, { count: 'exact' })
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null);
    if (error) throw error;
    if (!count) throw new HttpError(404, 'Transaction not found');
    return json(200, { ok: true });
  }

  // POST
  const { data, error } = await admin
    .from('spend_transactions')
    .insert({ user_id: userId, ...(await parseTxn(admin, userId, b)) })
    .select('id')
    .single();
  if (error) throw error;

  return json(201, { id: data.id });
});

/** Validates a spend, credit or transfer and returns the row fields. Shared by POST and PATCH. */
/** editingId is the transaction being edited, so its own amount is not counted against a loan. */
async function parseTxn(admin: SupabaseClient, userId: string, b: Record<string, unknown>, editingId?: string) {
  const typeRaw = reqStr(b, 'type', 10);
  if (!(TYPES as readonly string[]).includes(typeRaw)) throw new HttpError(400, 'type must be spend, credit or transfer');
  const type = typeRaw as TxnType;

  let amountPaise: number;
  try {
    amountPaise = parseRupeesToPaise(reqStr(b, 'amount', 20));
  } catch (err) {
    throw new HttpError(400, err instanceof Error ? err.message : 'Invalid amount');
  }

  const txnDate = dateOrToday(optStr(b, 'date', 10));
  const description = optStr(b, 'description', 120);
  // Credits are never categorised by spend category: they have their own credit category.
  const categoryId = type === 'credit' ? null : optStr(b, 'categoryId', 60);
  const creditCategory = type === 'credit' ? reqStr(b, 'creditCategory', 20) : null;
  if (creditCategory && !(CREDIT_CATEGORIES as readonly string[]).includes(creditCategory)) {
    throw new HttpError(400, 'creditCategory must be salary, gone_back, others or borrowed');
  }
  const reference = type === 'credit' ? optStr(b, 'reference', 120) : null;
  const lentLoanId = creditCategory === 'gone_back' ? optStr(b, 'lentLoanId', 60) : null;
  if (lentLoanId) reqId({ lentLoanId }, 'lentLoanId');
  const accountId = optStr(b, 'accountId', 60);
  const toAccountId = optStr(b, 'toAccountId', 60);
  const external = b.external === true;

  if (categoryId) reqId({ categoryId }, 'categoryId');
  if (accountId) reqId({ accountId }, 'accountId');
  if (toAccountId) reqId({ toAccountId }, 'toAccountId');

  if (type === 'spend' && !categoryId) throw new HttpError(400, 'Choose a category');
  if (!accountId) throw new HttpError(400, 'Choose an account');
  if (type === 'transfer') {
    if (external && toAccountId) throw new HttpError(400, 'External transfers have no destination account');
    if (!external && !toAccountId) throw new HttpError(400, 'Choose a destination account');
    if (toAccountId === accountId) throw new HttpError(400, 'Source and destination must differ');
  }

  if (lentLoanId) {
    const { data: loan, error: loanErr } = await admin
      .from('spend_lent_loans')
      .select('id,amount_paise,settled_at')
      .eq('user_id', userId)
      .eq('id', lentLoanId)
      .maybeSingle();
    if (loanErr) throw loanErr;
    if (!loan) throw new HttpError(400, 'Unknown loan');

    // A Got back cannot be more than is still owed on the loan. Checked here, not only on the screen,
    // so a second device or an old screen cannot over-record a repayment.
    let backQuery = admin
      .from('spend_transactions')
      .select('amount_paise')
      .eq('user_id', userId)
      .eq('lent_loan_id', lentLoanId)
      .eq('credit_category', 'gone_back')
      .is('deleted_at', null);
    if (editingId) backQuery = backQuery.neq('id', editingId);
    const { data: backs, error: backErr } = await backQuery;
    if (backErr) throw backErr;
    const returned = (backs ?? []).reduce((sum, r) => sum + r.amount_paise, 0);
    const owed = loan.settled_at ? 0 : Math.max(0, loan.amount_paise - returned);
    if (amountPaise > owed) {
      throw new HttpError(400, owed === 0 ? 'Nothing is still owed on this loan' : `More than the ₹${(owed / 100).toFixed(2)} still owed on this loan`);
    }
  }

  await assertOwned(admin, userId, 'spend_categories', categoryId ? [categoryId] : []);
  await assertOwned(admin, userId, 'spend_accounts', [accountId, ...(toAccountId ? [toAccountId] : [])]);

  return {
    type,
    amount_paise: amountPaise,
    txn_date: txnDate,
    description: type === 'credit' ? null : description,
    category_id: categoryId,
    credit_category: creditCategory,
    reference,
    lent_loan_id: lentLoanId,
    account_id: accountId,
    to_account_id: type === 'transfer' && !external ? toAccountId : null,
    external: type === 'transfer' && external,
  };
}
