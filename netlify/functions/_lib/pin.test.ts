import { describe, expect, it } from 'vitest';
import { hashPin, legacyHashForTests, verifyPin } from './pin';

describe('passcode hashing', () => {
  it('new passcodes are scrypt hashes that verify', () => {
    const stored = hashPin('salt', '1234');
    expect(stored.startsWith('scrypt$')).toBe(true);
    expect(verifyPin('salt', stored, '1234')).toEqual({ ok: true, needsUpgrade: false });
  });

  it('rejects a wrong passcode and a wrong salt', () => {
    const stored = hashPin('salt', '1234');
    expect(verifyPin('salt', stored, '1235').ok).toBe(false);
    expect(verifyPin('other', stored, '1234').ok).toBe(false);
  });

  it('still accepts a passcode saved with the old hash and asks for an upgrade', () => {
    const old = legacyHashForTests('salt', '4321');
    expect(verifyPin('salt', old, '4321')).toEqual({ ok: true, needsUpgrade: true });
    expect(verifyPin('salt', old, '0000')).toEqual({ ok: false, needsUpgrade: false });
  });

  it('does not throw on a stored value that is not a hash', () => {
    expect(verifyPin('salt', 'garbage', '1234').ok).toBe(false);
  });
});
