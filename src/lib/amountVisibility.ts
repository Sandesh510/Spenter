import { useSyncExternalStore } from 'react';
import { formatINR } from './money';

/**
 * Whether private amounts (balance, net worth) are showing. Hidden whenever the app opens, so a glance
 * at the screen reveals nothing; an eye button shows them. Kept in memory, not storage, so a reload hides
 * them again. Shared by every screen that has the eye.
 */
export const HIDDEN_AMOUNT = '₹ ••••••';

let shown = false;
const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** [amounts are showing, toggle, a formatter that hides the amount while hidden]. */
export function useAmountsShown(): [boolean, () => void, (paise: number) => string] {
  const value = useSyncExternalStore(subscribe, () => shown, () => false);
  const toggle = () => {
    shown = !shown;
    for (const fn of listeners) fn();
  };
  return [value, toggle, (paise: number) => (value ? formatINR(paise) : HIDDEN_AMOUNT)];
}
