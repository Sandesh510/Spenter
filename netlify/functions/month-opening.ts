import type { Handler } from '@netlify/functions';
import { parseRupeesToPaise } from '../../src/lib/money';
import { requireUser } from './_lib/auth';
import { readJson, reqStr } from './_lib/input';
import { HttpError, fail, json } from './_lib/response';
import { parseMonth } from './_lib/month';
import { ensureSeeded } from './_lib/seed';
import { getAdminClient } from './_supabase';

/**
 * POST /.netlify/functions/month-opening  { month, amount }     → set that month's starting balance
 * POST /.netlify/functions/month-opening  { month, none: true } → that month has no starting balance
 * Nothing carries over from the previous month.
 */
export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Use POST' });
  try {
    const admin = getAdminClient();
    const user = await requireUser(admin, event.headers.authorization);
    await ensureSeeded(admin, user.id);

    const b = readJson(event.body);
    const checkedMonth = parseMonth(reqStr(b, 'month', 7));
    let paise: number | null = null;
    if (b.none !== true) {
      try {
        paise = parseRupeesToPaise(reqStr(b, 'amount', 20));
      } catch (err) {
        throw new HttpError(400, err instanceof Error ? err.message : 'Invalid amount');
      }
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
