import { authed } from './_lib/handler';
import { assertOwned, readJson, reqId, reqStr } from './_lib/input';
import { parseMonth } from './_lib/month';
import { HttpError, json } from './_lib/response';
import { parseRupeesToPaise } from '../../src/lib/money';

/** POST /budgets  { categoryId, month: "YYYY-MM", amount: "5000" }  — sets one category's plan for one month. */
export const handler = authed(['POST'], async ({ admin, userId, event }) => {
  const b = readJson(event.body);
  const categoryId = reqId(b, 'categoryId');
  const month = parseMonth(reqStr(b, 'month', 7));
  const raw = reqStr(b, 'amount', 20);

  // A plan of 0 clears the budget for that category; anything else must be a valid rupee amount.
  let planned = 0;
  if (raw !== '0') {
    try {
      planned = parseRupeesToPaise(raw);
    } catch (err) {
      throw new HttpError(400, err instanceof Error ? err.message : 'Invalid amount');
    }
  }

  await assertOwned(admin, userId, 'spend_categories', [categoryId]);

  const { error } = await admin.from('spend_budgets').upsert(
    { user_id: userId, category_id: categoryId, month: `${month}-01`, planned_paise: planned },
    { onConflict: 'user_id,category_id,month' },
  );
  if (error) throw error;
  return json(200, { ok: true, plannedPaise: planned });
});
