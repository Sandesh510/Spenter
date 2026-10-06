import { haptic } from '../lib/haptics';

/** Numeric keypad from the mockups. Builds a rupee string; the caller converts it to paise. */

export const MAX_DIGITS = 9;

export function applyKey(current: string, key: string): string {
  if (key === '⌫') return current.slice(0, -1);
  if (key === '00') return current === '' ? current : (current + '00').slice(0, MAX_DIGITS);
  const next = (current + key).replace(/^0+(?=\d)/, '');
  return next.slice(0, MAX_DIGITS);
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫'];

export function Keypad({ onKey, fill = false }: { onKey: (key: string) => void; fill?: boolean }) {
  return (
    <div className={fill ? "keypad keypad--fill" : "keypad"} role="group" aria-label="Keypad">
      {KEYS.map(k => (
        <button key={k} className={k === '⌫' || k === '00' ? 'muted' : ''} onClick={() => { haptic('tap'); onKey(k); }} aria-label={k === '⌫' ? 'Delete' : k}>
          {k}
        </button>
      ))}
    </div>
  );
}
