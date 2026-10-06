import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from './response';

export interface AuthedUser {
  id: string;
  email: string | undefined;
}

/**
 * Verifies the caller's Supabase access token and returns their user id.
 * Every data-access function must call this first and scope queries to `id`,
 * because the service-role client bypasses row-level security.
 */
export async function requireUser(
  admin: SupabaseClient,
  authorization: string | undefined,
): Promise<AuthedUser> {
  const match = /^Bearer\s+(\S+)$/i.exec(authorization ?? '');
  if (!match) throw new HttpError(401, 'Missing bearer token');

  const { data, error } = await admin.auth.getUser(match[1]);
  if (error || !data.user) throw new HttpError(401, 'Invalid or expired session');

  return { id: data.user.id, email: data.user.email };
}
