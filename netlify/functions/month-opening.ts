import type { Handler } from '@netlify/functions';
import { parseRupeesToPaise } from '../../src/lib/money';
import { requireUser } from './_lib/auth';
import { HttpError, fail, json, readBody } from './_lib/response';
import { parseMonth } from './_lib/month';
import { ensureSeeded } from './_lib/seed';
import { getAdminClient } from './_supabase';

/**
 * POST /.netlify/functions/month-opening  { month: "YYYY-MM", amount: "92400" }
 * Sets the opening balance for one month. Not carried forward automatically.
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Use POST' });
  try {
    const admin = getAdminClient();
    const user = await requireUser(admin, event.headers.authorization);
    await ensureSeeded(admin, user.id);

    const { month, amount } = readBody(event.body, ['month', 'amount']);
    const checkedMonth = parseMonth(month);
    let paise: number;
    try {
      paise = parseRupeesToPaise(amount);
    } catch (err) {
      throw new HttpError(400, err instanceof Error ? err.message : 'Invalid amount');
    }

    // user_id is passed explicitly: the table default (auth.uid()) is null under the service key.
    const { error } = await admin.from('spend_month_settings').upsert(
      { user_id: user.id, month: `${checkedMonth}-01`, opening_paise: paise },
      { onConflict: 'user_id,month' },
    );
    if (error) throw error;

    return json(200, { month: checkedMonth, openingPaise: paise });
  } catch (err) {
    return fail(err);
  }
};
