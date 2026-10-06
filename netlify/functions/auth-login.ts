import type { Handler } from '@netlify/functions';
import { HttpError, fail, json, readBody } from './_lib/response';
import { ensureSeeded } from './_lib/seed';
import { getAdminClient, newAuthClient } from './_supabase';

/** POST /.netlify/functions/auth-login  { email, password } → session tokens for the browser. */
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Use POST' });
  try {
    const { email, password } = readBody(event.body, ['email', 'password']);
    const { data, error } = await newAuthClient().auth.signInWithPassword({ email, password });
    if (error || !data.session) throw new HttpError(401, 'Invalid email or password');

    await ensureSeeded(getAdminClient(), data.user.id);

    return json(200, {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: { id: data.user.id, email: data.user.email },
    });
  } catch (err) {
    return fail(err);
  }
};
