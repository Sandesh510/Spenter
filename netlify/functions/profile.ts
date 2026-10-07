import { randomBytes } from 'node:crypto';
import { authed } from './_lib/handler';
import { assertOwned, readJson, reqId, reqStr } from './_lib/input';
import { HttpError, json } from './_lib/response';
import { hashPin, verifyPin } from './_lib/pin';

const PIN = /^\d{4}$/;
const MAX_PIN_FAILURES = 5;
const LOCK_MINUTES = 15;

/**
 * GET   /profile                    → theme and whether the passcode lock is on
 * PATCH /profile { theme }          → 'dark' | 'light'
 * PATCH /profile { defaultAccountId } → the account new entries start with; null clears it
 * PATCH /profile { pin } | { clearPin: true }
 * POST  /profile { action:'unlock', pin } → { ok } — the PIN hash never leaves the server
 */
export const handler = authed(['GET', 'PATCH', 'POST'], async ({ admin, userId, event }) => {
  if (event.httpMethod === 'GET') {
    const { data, error } = await admin
      .from('spend_profiles')
      .select('theme,lock_hash,default_account_id')
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    return json(200, { theme: data.theme, lockEnabled: data.lock_hash !== null, defaultAccountId: data.default_account_id });
  }

  const b = readJson(event.body);

  if (event.httpMethod === 'POST') {
    if (reqStr(b, 'action', 10) !== 'unlock') throw new HttpError(400, 'Unknown action');
    const pin = reqStr(b, 'pin', 4);
    const { data, error } = await admin
      .from('spend_profiles')
      .select('lock_salt,lock_hash,pin_failures,pin_locked_until')
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    if (!data.lock_hash || !data.lock_salt) return json(200, { ok: true });

    // Lockout: refuse while locked, so guessing the 4-digit PIN is slow.
    const lockedUntil = data.pin_locked_until ? Date.parse(data.pin_locked_until) : 0;
    if (lockedUntil > Date.now()) {
      const mins = Math.ceil((lockedUntil - Date.now()) / 60_000);
      throw new HttpError(429, `Too many wrong passcodes. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`);
    }

    const { ok, needsUpgrade } = verifyPin(data.lock_salt, data.lock_hash, pin);

    if (ok) {
      if (data.pin_failures || data.pin_locked_until) {
        await admin.from('spend_profiles').update({ pin_failures: 0, pin_locked_until: null }).eq('user_id', userId);
      }
      // A passcode saved with the old fast hash is stored again with the slow one.
      if (needsUpgrade) await admin.from('spend_profiles').update({ lock_hash: hashPin(data.lock_salt, pin) }).eq('user_id', userId);
      return json(200, { ok: true });
    }

    const failures = data.pin_failures + 1;
    const lockNow = failures >= MAX_PIN_FAILURES;
    await admin
      .from('spend_profiles')
      .update({
        pin_failures: lockNow ? 0 : failures,
        pin_locked_until: lockNow ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null,
      })
      .eq('user_id', userId);
    if (lockNow) throw new HttpError(429, `Too many wrong passcodes. Try again in ${LOCK_MINUTES} minutes.`);
    return json(200, { ok: false, attemptsLeft: MAX_PIN_FAILURES - failures });
  }

  // PATCH
  if (b.defaultAccountId !== undefined) {
    const id = b.defaultAccountId === null || b.defaultAccountId === '' ? null : reqId(b, 'defaultAccountId');
    if (id) await assertOwned(admin, userId, 'spend_accounts', [id]);
    const { error } = await admin.from('spend_profiles').update({ default_account_id: id }).eq('user_id', userId);
    if (error) throw error;
    return json(200, { ok: true, defaultAccountId: id });
  }

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
