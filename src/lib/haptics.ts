import { getHaptics } from './prefs';

/**
 * Vibration feedback. Android browsers support navigator.vibrate; iOS Safari does not,
 * so there it is silently a no-op. Users can turn it off in Settings.
 */
const PATTERNS = {
  tap: 8, // keypad keys, toggles
  success: [15, 40, 15], // transaction saved, sign-in, unlock, plan saved
  warning: [25], // deleting a transaction, lockout starting
  error: [40, 60, 40], // wrong passcode, failed save, failed sign-in
} as const;

export type HapticKind = keyof typeof PATTERNS;

export function haptic(kind: HapticKind) {
  if (!getHaptics()) return;
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  navigator.vibrate(PATTERNS[kind] as number | number[]);
}
