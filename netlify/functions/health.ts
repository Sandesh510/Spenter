import type { Handler } from '@netlify/functions';
import { fail, json } from './_lib/response';
import { getAdminClient } from './_supabase';

/** GET /.netlify/functions/health — confirms the function can reach Supabase with the service key. */
export const handler: Handler = async () => {
  try {
    const { error } = await getAdminClient().auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) throw error;
    return json(200, { ok: true });
  } catch (err) {
    return fail(err);
  }
};
