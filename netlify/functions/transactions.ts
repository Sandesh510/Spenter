import { parseRupeesToPaise } from '../../src/lib/money';
import { authed } from './_lib/handler';
import { assertOwned, dateOrToday, optStr, readJson, reqId, reqStr } from './_lib/input';
import { monthRange, parseMonth } from './_lib/month';
import { HttpError, json } from './_lib/response';

const TYPES = ['spend', 'credit', 'transfer'] as const;
type TxnType = (typeof TYPES)[number];

/**
 * GET    /transactions?month=YYYY-MM   → the month's live transactions
 * POST   /transactions                 → add a spend, money-in (credit) or transfer
 * DELETE /transactions?id=…            → soft delete (kept for history, excluded from totals)
 */
export const handler = authed(['GET', 'POST', 'DELETE'], async ({ admin, userId, event }) => {
  if (event.httpMethod === 'GET') {
    const month = parseMonth(event.queryStringParameters?.month);
    const { start, end } = monthRange(month);
    const { data, error } = await admin
      .from('spend_transactions')
      .select('id,type,amount_paise,txn_date,description,category_id,account_id,to_account_id,external,created_at')
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

  // POST
  const b = readJson(event.body);
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
  const categoryId = optStr(b, 'categoryId', 60);
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

  await assertOwned(admin, userId, 'spend_categories', categoryId ? [categoryId] : []);
  await assertOwned(admin, userId, 'spend_accounts', [accountId, ...(toAccountId ? [toAccountId] : [])]);

  const { data, error } = await admin
    .from('spend_transactions')
    .insert({
      user_id: userId,
      type,
      amount_paise: amountPaise,
      txn_date: txnDate,
      description,
      category_id: categoryId,
      account_id: accountId,
      to_account_id: type === 'transfer' && !external ? toAccountId : null,
      external: type === 'transfer' && external,
    })
    .select('id')
    .single();
  if (error) throw error;

  return json(201, { id: data.id });
});
