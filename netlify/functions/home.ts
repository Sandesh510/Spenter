import type { Handler } from '@netlify/functions';
import { requireUser } from './_lib/auth';
import { fail, json } from './_lib/response';
import { parseMonth } from './_lib/month';
import { loadHome } from './_lib/data';
import { ensureSeededOnce } from './_lib/seed';
import { getAdminClient } from './_supabase';

/** GET /.netlify/functions/home?month=YYYY-MM — kept for single-month refreshes; the app mainly uses bootstrap. */
export const handler: Handler = async event => {
  try {
    const started = Date.now();
    const admin = getAdminClient();
    const user = await requireUser(admin, event.headers.authorization);
    await ensureSeededOnce(admin, user.id);
    const month = parseMonth(event.queryStringParameters?.month);
    const body = await loadHome(admin, user.id, month);
    const res = json(200, body);
    res.headers['server-timing'] = `total;dur=${Date.now() - started}`;
    return res;
  } catch (err) {
    return fail(err);
  }
};
