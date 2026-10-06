import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY (set in Netlify environment).');
  }
  return { url, key };
}

/**
 * Shared server-side client for admin work (token verification, admin APIs).
 * It is never used for sign-in: signInWithPassword would attach the user's session
 * to this client and later calls would run as that user. See newAuthClient().
 *
 * Service role bypasses RLS, so every data query must be scoped to the verified user id.
 * Never import this module from src/.
 */
let adminClient: SupabaseClient | undefined;

export function getAdminClient(): SupabaseClient {
  if (!adminClient) {
    const { url, key } = config();
    adminClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return adminClient;
}

/** A fresh client per call, for sign-in and sign-up, so no session is kept on the shared client. */
export function newAuthClient(): SupabaseClient {
  const { url, key } = config();
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
