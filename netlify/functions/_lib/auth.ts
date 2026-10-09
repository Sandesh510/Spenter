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

  const token = match[1];
  const hit = verified.get(token);
  if (hit && hit.until > Date.now()) return hit.user;

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Invalid or expired session');

  const user = { id: data.user.id, email: data.user.email };
  remember(token, user);
  return user;
}

/**
 * Tokens Supabase has just confirmed, kept for a short while on this warm function instance.
 * Saves one round trip to Supabase Auth on each request after the first. A token that has expired or
 * been revoked is still refused within VERIFIED_MS at the latest.
 */
const VERIFIED_MS = 60_000;
const MAX_VERIFIED = 200;
const verified = new Map<string, { user: AuthedUser; until: number }>();

function remember(token: string, user: AuthedUser) {
  if (verified.size >= MAX_VERIFIED) verified.delete(verified.keys().next().value as string);
  verified.set(token, { user, until: Date.now() + VERIFIED_MS });
}
