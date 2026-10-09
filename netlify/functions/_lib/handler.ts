import type { Handler, HandlerEvent } from '@netlify/functions';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireUser } from './auth';
import { fail, json, type FunctionResponse } from './response';
import { ensureSeededOnce } from './seed';
import { getAdminClient } from '../_supabase';

export interface Ctx {
  admin: SupabaseClient;
  userId: string;
  event: HandlerEvent;
}

/**
 * Wraps a Netlify Function: rejects other HTTP methods, verifies the session,
 * seeds the user on first use, and maps errors to responses.
 */
export function authed(methods: string[], run: (ctx: Ctx) => Promise<FunctionResponse>): Handler {
  return async event => {
    if (!methods.includes(event.httpMethod)) return json(405, { error: `Use ${methods.join(' or ')}` });
    try {
      const admin = getAdminClient();
      const user = await requireUser(admin, event.headers.authorization);
      await ensureSeededOnce(admin, user.id);
      return await run({ admin, userId: user.id, event });
    } catch (err) {
      return fail(err);
    }
  };
}
