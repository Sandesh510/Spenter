import type { Handler } from '@netlify/functions';
import { HttpError, fail, json, readBody } from './_lib/response';
import { newAuthClient } from './_supabase';

/**
 * POST /.netlify/functions/auth-signup  { email, password }
 * Creates the account. The signup trigger seeds SpendCheck data (see migration 0001).
 * If email confirmation is enabled in Supabase, `needsConfirmation` is true and no session is returned.
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Use POST' });
  try {
    const { email, password } = readBody(event.body, ['email', 'password']);
    if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');

    const { data, error } = await newAuthClient().auth.signUp({ email, password });
    if (error) throw new HttpError(400, error.message);

    return json(201, {
      user: data.user ? { id: data.user.id, email: data.user.email } : null,
      needsConfirmation: !data.session,
    });
  } catch (err) {
    return fail(err);
  }
};
