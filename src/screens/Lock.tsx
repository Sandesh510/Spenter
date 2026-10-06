import { useState } from 'react';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { haptic } from '../lib/haptics';

/** Passcode lock, per screens/ScreenLock.dc.html. The PIN is checked on the server; the hash never reaches the browser. */
export function Lock({ token, onUnlock }: { token: string; onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function check(code: string) {
    setBusy(true);
    try {
      const res = await api<{ ok: boolean; attemptsLeft?: number }>('profile', { method: 'POST', token, body: { action: 'unlock', pin: code } });
      if (res.ok) {
        haptic('success');
        onUnlock();
      } else {
        haptic('error');
        setError((res.attemptsLeft ?? 0) > 0 ? `Wrong passcode. ${res.attemptsLeft} ${res.attemptsLeft === 1 ? "try" : "tries"} left.` : "Wrong passcode");
        setPin('');
      }
    } catch (err) {
      haptic('error');
      setError(err instanceof Error ? err.message : 'Could not check passcode');
      setPin('');
    } finally {
      setBusy(false);
    }
  }

  function press(k: string) {
    if (busy) return;
    if (k) haptic('tap');
    setError(null);
    if (k === '⌫') return setPin(p => p.slice(0, -1));
    if (k === '') return;
    const next = (pin + k).slice(0, 4);
    setPin(next);
    if (next.length === 4) check(next);
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

  return (
    <div className="phone jc-sb" style={{ padding: '0 24px 26px' }}>
      <div className="flex-1 flex ai-c jc-c gap-20" style={{ flexDirection: 'column' }}>
        <div className="grid c-accent" style={{ width: 60, height: 60, borderRadius: 18, border: '1px solid var(--color-accent)', placeItems: 'center' }}>
          <Icon name="lock-keyhole" size={26} />
        </div>
        <div className="ta-c">
          <div className="heading fs-24">SpendCheck</div>
          <div className="fs-13 c-sec mt-4">Enter your passcode</div>
        </div>
        <div className="flex" style={{ gap: 15 }} aria-label={`${pin.length} of 4 digits entered`}>
          {[0, 1, 2, 3].map(i => (
            <span key={i} style={{ width: 13, height: 13, borderRadius: '50%', background: i < pin.length ? 'var(--color-accent)' : 'transparent', border: i < pin.length ? 'none' : '1.5px solid var(--color-border)' }} />
          ))}
        </div>
        {error && <p className="c-danger fs-13" role="alert" style={{ margin: 0 }}>{error}</p>}
      </div>
      <div className="grid gap-12 w-full" style={{ gridTemplateColumns: 'repeat(3, 1fr)', maxWidth: 250, margin: '0 auto' }}>
        {keys.map((k, i) => (
          <button
            key={i}
            onClick={() => press(k)}
            disabled={k === '' || busy}
            aria-label={k === '⌫' ? 'Delete' : k || undefined}
            style={{ height: 58, borderRadius: '50%', border: 'none', background: 'transparent', color: k === '⌫' || k === '' ? 'var(--color-text-muted)' : 'var(--color-text-primary)', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 24, cursor: k === '' ? 'default' : 'pointer' }}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}
