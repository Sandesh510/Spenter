import { createHash, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Passcode hashing. New passcodes use scrypt, which is slow on purpose, so a leaked hash of a 4-digit code
 * takes real effort to guess. Hashes saved before that are a plain salted SHA-256 (64 hex characters, no prefix);
 * they still verify, and are replaced with a scrypt hash the next time the right passcode is entered.
 */
const SCRYPT_PREFIX = 'scrypt$';

function legacyHash(salt: string, pin: string): string {
  return createHash('sha256').update(`${salt}:${pin}`).digest('hex');
}

/** The hash to store for a new passcode. */
export function hashPin(salt: string, pin: string): string {
  return SCRYPT_PREFIX + scryptSync(pin, salt, 32).toString('hex');
}

const sameHex = (a: string, b: string): boolean => {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Checks a passcode against a stored hash. needsUpgrade is true when the stored hash is the old kind. */
export function verifyPin(salt: string, stored: string, pin: string): { ok: boolean; needsUpgrade: boolean } {
  if (stored.startsWith(SCRYPT_PREFIX)) {
    return { ok: sameHex(stored.slice(SCRYPT_PREFIX.length), scryptSync(pin, salt, 32).toString('hex')), needsUpgrade: false };
  }
  const ok = sameHex(stored, legacyHash(salt, pin));
  return { ok, needsUpgrade: ok };
}

/** A legacy hash, as saved before scrypt. Exported for tests only. */
export const legacyHashForTests = legacyHash;
