import type { Handler } from '@netlify/functions';
import { requireUser } from './_lib/auth';
import { fail, json } from './_lib/response';
import { ensureSeeded } from './_lib/seed';
import { getAdminClient } from './_supabase';

/** GET /.netlify/functions/me — returns the signed-in user. Requires Authorization: Bearer <token>. */
export const handler: Handler = async (event) => {
  try {
    const admin = getAdminClient();
    const user = await requireUser(admin, event.headers.authorization);
    await ensureSeeded(admin, user.id);
    return json(200, user);
  } catch (err) {
    return fail(err);
  }
};
