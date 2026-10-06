import type { Handler } from '@netlify/functions';
import { requireUser } from './_lib/auth';
import { fail, json } from './_lib/response';
import { parseMonth } from './_lib/month';
import { loadHome } from './_lib/data';
import { ensureSeeded } from './_lib/seed';
import { getAdminClient } from './_supabase';

/** GET /.netlify/functions/home?month=YYYY-MM — kept for single-month refreshes; the app mainly uses bootstrap. */
export const handler: Handler = async event => {
  try {
    const admin = getAdminClient();
    const user = await requireUser(admin, event.headers.authorization);
    await ensureSeeded(admin, user.id);
    const month = parseMonth(event.queryStringParameters?.month);
    return json(200, await loadHome(admin, user.id, month));
  } catch (err) {
    return fail(err);
  }
};
