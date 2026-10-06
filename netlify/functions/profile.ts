import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { authed } from './_lib/handler';
import { readJson, reqStr } from './_lib/input';
import { HttpError, json } from './_lib/response';

const PIN = /^\d{4}$/;

function hashPin(salt: string, pin: string): string {
  return createHash('sha256').update(`${salt}:${pin}`).digest('hex');
}

/**
 * GET   /profile                    → theme and whether the passcode lock is on
 * PATCH /profile { theme }          → 'dark' | 'light'
 * PATCH /profile { pin } | { clearPin: true }
 * POST  /profile { action:'unlock', pin } → { ok } — the PIN hash never leaves the server
 */
export const handler = authed(['GET', 'PATCH', 'POST'], async ({ admin, userId, event }) => {
  if (event.httpMethod === 'GET') {
    const { data, error } = await admin
      .from('spend_profiles')
      .select('theme,lock_hash')
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    return json(200, { theme: data.theme, lockEnabled: data.lock_hash !== null });
  }

  const b = readJson(event.body);

  if (event.httpMethod === 'POST') {
    if (reqStr(b, 'action', 10) !== 'unlock') throw new HttpError(400, 'Unknown action');
    const pin = reqStr(b, 'pin', 4);
    const { data, error } = await admin.from('spend_profiles').select('lock_salt,lock_hash').eq('user_id', userId).single();
    if (error) throw error;
    if (!data.lock_hash || !data.lock_salt) return json(200, { ok: true });

    const given = Buffer.from(hashPin(data.lock_salt, pin), 'hex');
    const stored = Buffer.from(data.lock_hash, 'hex');
    const ok = given.length === stored.length && timingSafeEqual(given, stored);
    return json(200, { ok });
  }

  // PATCH
  if (b.theme !== undefined) {
    const theme = reqStr(b, 'theme', 5);
    if (theme !== 'dark' && theme !== 'light') throw new HttpError(400, 'theme must be dark or light');
    const { error } = await admin.from('spend_profiles').update({ theme }).eq('user_id', userId);
    if (error) throw error;
    return json(200, { ok: true });
  }

  if (b.clearPin === true) {
    const { error } = await admin.from('spend_profiles').update({ lock_salt: null, lock_hash: null }).eq('user_id', userId);
    if (error) throw error;
    return json(200, { ok: true, lockEnabled: false });
  }

  const pin = reqStr(b, 'pin', 4);
  if (!PIN.test(pin)) throw new HttpError(400, 'Passcode must be 4 digits');
  const salt = randomBytes(16).toString('hex');
  const { error } = await admin
    .from('spend_profiles')
    .update({ lock_salt: salt, lock_hash: hashPin(salt, pin) })
    .eq('user_id', userId);
  if (error) throw error;
  return json(200, { ok: true, lockEnabled: true });
});
