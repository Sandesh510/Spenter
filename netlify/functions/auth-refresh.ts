import type { Handler } from '@netlify/functions';
import { HttpError, fail, json, readBody } from './_lib/response';
import { newAuthClient } from './_supabase';

/**
 * POST /.netlify/functions/auth-refresh  { refresh_token } → a new session.
 * Access tokens last about an hour. The app swaps its refresh token for a fresh pair before the
 * access token runs out, so an installed app stays signed in. Supabase rotates the refresh token:
 * the browser must keep the new one and never reuse the old one.
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Use POST' });
  try {
    const { refresh_token } = readBody(event.body, ['refresh_token']);
    const { data, error } = await newAuthClient().auth.refreshSession({ refresh_token });
    if (error || !data.session || !data.user) throw new HttpError(401, 'Session ended. Please sign in again.');
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
