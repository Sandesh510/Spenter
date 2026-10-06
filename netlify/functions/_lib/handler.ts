import type { Handler, HandlerEvent } from '@netlify/functions';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireUser } from './auth';
import { fail, json, type FunctionResponse } from './response';
import { ensureSeeded } from './seed';
import { getAdminClient } from '../_supabase';

export interface Ctx {
  admin: SupabaseClient;
  userId: string;
  event: HandlerEvent;
}

// Users already seeded by this warm function instance. Seeding is idempotent, so a cold start just re-checks.
const seeded = new Set<string>();

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
      if (!seeded.has(user.id)) {
        await ensureSeeded(admin, user.id);
        seeded.add(user.id);
      }
      return await run({ admin, userId: user.id, event });
    } catch (err) {
      return fail(err);
    }
  };
}
