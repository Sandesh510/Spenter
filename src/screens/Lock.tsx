import { useState } from 'react';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';

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
        onUnlock();
      } else {
        setError((res.attemptsLeft ?? 0) > 0 ? `Wrong passcode. ${res.attemptsLeft} ${res.attemptsLeft === 1 ? "try" : "tries"} left.` : "Wrong passcode");
        setPin('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check passcode');
      setPin('');
    } finally {
      setBusy(false);
    }
  }

  function press(k: string) {
    if (busy) return;
    setError(null);
    if (k === '⌫') return setPin(p => p.slice(0, -1));
    if (k === '') return;
    const next = (pin + k).slice(0, 4);
    setPin(next);
    if (next.length === 4) check(next);
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

  return (
    <div className="phone" style={{ justifyContent: 'space-between', padding: '0 24px 26px' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, border: '1px solid var(--amber)', display: 'grid', placeItems: 'center', color: 'var(--amber)' }}>
          <Icon name="lock-keyhole" size={26} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="heading" style={{ fontSize: 23 }}>SpendCheck</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Enter your passcode</div>
        </div>
        <div style={{ display: 'flex', gap: 15 }} aria-label={`${pin.length} of 4 digits entered`}>
          {[0, 1, 2, 3].map(i => (
            <span key={i} style={{ width: 13, height: 13, borderRadius: '50%', background: i < pin.length ? 'var(--amber)' : 'transparent', border: i < pin.length ? 'none' : '1.5px solid var(--line)' }} />
          ))}
        </div>
        {error && <p role="alert" style={{ color: 'var(--red)', fontSize: 13, margin: 0 }}>{error}</p>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, width: '100%', maxWidth: 250, margin: '0 auto' }}>
        {keys.map((k, i) => (
          <button
            key={i}
            onClick={() => press(k)}
            disabled={k === '' || busy}
            aria-label={k === '⌫' ? 'Delete' : k || undefined}
            style={{ height: 58, borderRadius: '50%', border: 'none', background: 'transparent', color: k === '⌫' || k === '' ? 'var(--faint)' : 'var(--text)', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 24, cursor: k === '' ? 'default' : 'pointer' }}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}
