import type { Handler } from '@netlify/functions';
import { HttpError, fail, json, readBody } from './_lib/response';
import { getAdminClient, newAuthClient } from './_supabase';

/**
 * POST /.netlify/functions/auth-reset { email } → sends a password reset email.
 * Always answers the same way, so it cannot be used to find out which emails have an account.
 *
 * POST /.netlify/functions/auth-reset { accessToken, password } → sets a new password.
 * The access token is the one in the reset email's link; it is checked with Supabase before use.
 */
export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Use POST' });
  try {
    let raw: Record<string, unknown> = {};
    try {
      raw = JSON.parse(event.body || '{}') as Record<string, unknown>;
    } catch {
      throw new HttpError(400, 'Body must be JSON');
    }

    if (typeof raw.accessToken === 'string') {
      const { password, accessToken } = readBody(event.body, ['password', 'accessToken']);
      if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
      const admin = getAdminClient();
      const { data, error } = await admin.auth.getUser(accessToken);
      if (error || !data.user) throw new HttpError(401, 'This reset link has expired. Ask for a new one.');
      const { error: updErr } = await admin.auth.admin.updateUserById(data.user.id, { password });
      if (updErr) throw new HttpError(400, updErr.message);
      return json(200, { ok: true });
    }

    const { email } = readBody(event.body, ['email']);
    // The link in the email returns to this site, where the app asks for the new password.
    const site = process.env.URL ?? event.headers.origin;
    const { error } = await newAuthClient().auth.resetPasswordForEmail(email.trim(), site ? { redirectTo: site } : undefined);
    // Unknown emails and rate limits are not reported back; real failures are only logged.
    if (error) console.error('reset email', error.message);
    return json(200, { ok: true });
  } catch (err) {
    return fail(err);
  }
};
