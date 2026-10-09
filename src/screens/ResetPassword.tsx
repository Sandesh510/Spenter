import { useState, type FormEvent } from 'react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Field';
import { api } from '../lib/api';
import { writeSession } from '../lib/session';

/** Set a new password from the link in the reset email. Afterwards the user signs in with it. */
export function ResetPassword({ accessToken, onDone }: { accessToken: string; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api('auth-reset', { body: { accessToken, password } });
      // Any older sign-in on this device is ended; the new password is used from here on.
      writeSession(null);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="phone auth-screen">
      <div className="ta-c">
        <h1 className="heading fs-24 m-0">New password</h1>
        <p className="fs-13 c-sec mt-4">Choose a password of at least 8 characters.</p>
      </div>
      <form className="grid gap-12 mt-24" onSubmit={submit}>
        <Input type="password" placeholder="New password" aria-label="New password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
        <Button type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Save password'}</Button>
      </form>
      {error && <p className="c-danger fs-13" role="alert">{error}</p>}
    </div>
  );
}
