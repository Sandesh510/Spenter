import type { Handler } from '@netlify/functions';
import { requireUser } from './_lib/auth';
import { fail, json } from './_lib/response';
import { currentMonthIST } from './_lib/month';
import { loadAccounts, loadHome, loadLent, loadProfile, loadTransactions } from './_lib/data';
import { ensureSeededOnce } from './_lib/seed';
import { getAdminClient } from './_supabase';

/**
 * GET /.netlify/functions/bootstrap
 * One request for everything the signed-in app shows. The browser caches the result, so
 * moving between Home, Log, Trends and Settings does not wait on the network.
 * Keys match the paths the screens request, so the client cache can serve them directly.
 */
export const handler: Handler = async event => {
  try {
    const started = Date.now();
    const admin = getAdminClient();
    const user = await requireUser(admin, event.headers.authorization);
    await ensureSeededOnce(admin, user.id);

    const month = currentMonthIST();
    const [profile, accounts, home, transactions, lent] = await Promise.all([
      loadProfile(admin, user.id),
      loadAccounts(admin, user.id),
      loadHome(admin, user.id, month),
      loadTransactions(admin, user.id, month),
      loadLent(admin, user.id),
    ]);

    const res = json(200, {
      user: { id: user.id, email: user.email },
      month,
      data: {
        profile,
        accounts,
        [`home?month=${month}`]: home,
        [`transactions?month=${month}`]: transactions,
        lent,
      },
    });
    res.headers['server-timing'] = `total;dur=${Date.now() - started}`;
    return res;
  } catch (err) {
    return fail(err);
  }
};
