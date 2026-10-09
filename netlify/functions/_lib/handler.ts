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
      const started = Date.now();
      const admin = getAdminClient();
      const user = await requireUser(admin, event.headers.authorization);
      const verifiedAt = Date.now();
      await ensureSeededOnce(admin, user.id);
      const seededAt = Date.now();
      const res = await run({ admin, userId: user.id, event });
      const doneAt = Date.now();
      // Visible in the browser's Network tab (Timing): where a slow request spent its time.
      res.headers['server-timing'] = `auth;dur=${verifiedAt - started}, seed;dur=${seededAt - verifiedAt}, work;dur=${doneAt - seededAt}, total;dur=${doneAt - started}`;
      return res;
    } catch (err) {
      return fail(err);
    }
  };
}
