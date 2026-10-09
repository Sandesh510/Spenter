import { currentMonth } from './dates';
import type { AlertLevel } from './budgetAlerts';

/**
 * Which budget alerts the user has dismissed this month, kept on this device only.
 * A dismissal is for one category at one level: dismissing "80%" does not hide a later "over".
 */
const KEY = 'spendcheck.alertDismissals.v1';

interface Stored {
  month: string;
  keys: string[];
}

const keyOf = (categoryId: string, level: AlertLevel) => `${categoryId}:${level}`;

function read(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? (JSON.parse(raw) as Stored) : null;
    // A new month starts with nothing dismissed.
    if (s && s.month === currentMonth() && Array.isArray(s.keys)) return s;
  } catch {
    /* storage unavailable or damaged: nothing is dismissed */
  }
  return { month: currentMonth(), keys: [] };
}

export function isDismissed(categoryId: string, level: AlertLevel): boolean {
  return read().keys.includes(keyOf(categoryId, level));
}

export function dismissAlert(categoryId: string, level: AlertLevel): void {
  const s = read();
  if (s.keys.includes(keyOf(categoryId, level))) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ month: s.month, keys: [...s.keys, keyOf(categoryId, level)] }));
  } catch {
    /* storage unavailable: the alert comes back next time */
  }
}
