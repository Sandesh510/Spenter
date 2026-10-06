import { parseRupeesToPaise } from '../../src/lib/money';
import { authed } from './_lib/handler';
import { assertOwned, optStr, readJson, reqId, reqStr, todayIST } from './_lib/input';
import { HttpError, json } from './_lib/response';

const DECISIONS = ['bought', 'skipped', 'delayed'] as const;

/**
 * GET  /asks                → the 20 most recent "should I buy this?" decisions
 * POST /asks { item, amount, decision, categoryId?, accountId? }
 *   - 'bought' also records a spend transaction today (requires category and account).
 *   - 'skipped' and 'delayed' are stored as asks only, never as transactions (audit T8).
 */
export const handler = authed(['GET', 'POST'], async ({ admin, userId, event }) => {
  if (event.httpMethod === 'GET') {
    const { data, error } = await admin
      .from('spend_asks')
      .select('id,item,amount_paise,category_id,decision,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return json(200, { items: data ?? [] });
  }

  const b = readJson(event.body);
  const item = reqStr(b, 'item', 80);
  const decision = reqStr(b, 'decision', 10);
  if (!(DECISIONS as readonly string[]).includes(decision)) throw new HttpError(400, 'decision must be bought, skipped or delayed');

  let amountPaise: number;
  try {
    amountPaise = parseRupeesToPaise(reqStr(b, 'amount', 20));
  } catch (err) {
    throw new HttpError(400, err instanceof Error ? err.message : 'Invalid amount');
  }

  const categoryId = optStr(b, 'categoryId', 60);
  const accountId = optStr(b, 'accountId', 60);
  if (categoryId) reqId({ categoryId }, 'categoryId');
  if (accountId) reqId({ accountId }, 'accountId');
  if (decision === 'bought' && (!categoryId || !accountId)) throw new HttpError(400, 'Choose a category and account to record a purchase');

  await assertOwned(admin, userId, 'spend_categories', categoryId ? [categoryId] : []);
  await assertOwned(admin, userId, 'spend_accounts', accountId ? [accountId] : []);

  let transactionId: string | null = null;
  if (decision === 'bought') {
    const { data, error } = await admin
      .from('spend_transactions')
      .insert({
        user_id: userId,
        type: 'spend',
        amount_paise: amountPaise,
        txn_date: todayIST(),
        description: item,
        category_id: categoryId,
        account_id: accountId,
      })
      .select('id')
      .single();
    if (error) throw error;
    transactionId = data.id;
  }

  const { data, error } = await admin
    .from('spend_asks')
    .insert({ user_id: userId, item, amount_paise: amountPaise, category_id: categoryId, decision })
    .select('id')
    .single();
  if (error) throw error;

  return json(201, { id: data.id, transactionId });
});
