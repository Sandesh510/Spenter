/**
 * Per-device display and feedback preferences. Kept in localStorage so they work before sign-in
 * (for example on the lock screen) and need no database change.
 */

export type FontSize = 'low' | 'medium' | 'high';

const FONT_KEY = 'spendcheck.fontSize';
const HAPTICS_KEY = 'spendcheck.haptics';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the preference applies for this visit only */
  }
}

export function getFontSize(): FontSize {
  const v = read(FONT_KEY);
  return v === 'low' || v === 'high' ? v : 'medium';
}

export function setFontSize(size: FontSize) {
  write(FONT_KEY, size);
  applyFontSize(size);
}

export function applyFontSize(size: FontSize = getFontSize()) {
  document.documentElement.dataset.font = size;
}

/** The passcode lock re-appears only after this long without any interaction. */
export const IDLE_LOCK_MS = 15 * 60_000;

const ACTIVE_KEY = 'spendcheck.lastActive';

export function getLastActive(): number {
  return Number(read(ACTIVE_KEY)) || 0;
}

export function touchActive() {
  write(ACTIVE_KEY, String(Date.now()));
}

/** True if the user interacted with the app within the idle window. */
export function isStillActive(): boolean {
  return Date.now() - getLastActive() < IDLE_LOCK_MS;
}

export function getHaptics(): boolean {
  return read(HAPTICS_KEY) !== 'off';
}

export function setHaptics(on: boolean) {
  write(HAPTICS_KEY, on ? 'on' : 'off');
}
