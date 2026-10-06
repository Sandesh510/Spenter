import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Field';
import { useMemo, useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { haptic } from '../lib/haptics';
import { formatINR } from '../lib/money';
import { useApi } from '../lib/useApi';
import type { Loan } from '../lib/types';
import type { Route } from '../App';

interface Person {
  name: string;
  open: Loan[];
  owed: number;
  since: string;
}

/**
 * Money lent, per the README. Lent money is not part of budgets or the Log and does not change the balance.
 */
export function Lent({ token, go, onToast }: { token: string; go: (r: Route) => void; onToast: (m: string) => void }) {
  const { data, error, reload } = useApi<{ items: Loan[] }>('lent', token);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loans = data?.items ?? [];
  const people = useMemo(() => {
    const map = new Map<string, Person>();
    for (const l of loans) {
      const p = map.get(l.person_name) ?? { name: l.person_name, open: [], owed: 0, since: l.lent_on };
      if (!l.settled_at) {
        p.open.push(l);
        p.owed += l.amount_paise;
        if (l.lent_on < p.since) p.since = l.lent_on;
      }
      map.set(l.person_name, p);
    }
    return [...map.values()];
  }, [loans]);

  const outstanding = people.filter(p => p.open.length > 0).sort((a, b) => b.owed - a.owed);
  const settled = people.filter(p => p.open.length === 0);
  const totalOwed = outstanding.reduce((s, p) => s + p.owed, 0);
  const previousNames = [...new Set(loans.map(l => l.person_name))];

  async function run(body: Record<string, unknown>, done: string) {
    setErr(null);
    setBusy(true);
    try {
      await api('lent', { token, body });
      haptic('success');
      reload();
      onToast(done);
    } catch (e) {
      haptic('error');
      setErr(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  async function record(e: FormEvent) {
    e.preventDefault();
    await run({ action: 'add', name: name.trim(), amount, note: note.trim() || undefined }, `Lent ${formatINR(Math.round(Number(amount) * 100))} to ${name.trim()}`);
    setAdding(false);
    setName('');
    setAmount('');
    setNote('');
  }

  return (
    <div className="scroll">
      <div className="topbar" style={{ padding: '8px 0 4px' }}>
        <button className="iconbtn" onClick={() => go('home')} aria-label="Back"><Icon name="chevron-left" size={18} /></button>
        <span className="topbar__title">Money lent</span>
        <span style={{ width: 36 }} />
      </div>

      {error && <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p>}

      <Card as="section" style={{ marginTop: 8 }}>
        <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>Yet to get back</div>
        <div className="heading num" style={{ fontSize: 42, lineHeight: 1.05, marginTop: 4 }}>{formatINR(totalOwed)}</div>
        <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', marginTop: 4 }}>{outstanding.length} {outstanding.length === 1 ? 'person owes' : 'people owe'} you</div>
      </Card>

      <div className="kicker" style={{ margin: '22px 2px 10px' }}>Outstanding</div>
      {outstanding.length === 0 && <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Nothing outstanding.</p>}
      <div style={{ display: 'grid', gap: 10 }}>
        {outstanding.map(p => (
          <Card key={p.name} variant="flush">
            <button onClick={() => setOpen(open === p.name ? null : p.name)} style={rowBtn}>
              <span style={avatar}>{p.name.slice(0, 1).toUpperCase()}</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 14 }}>{p.name}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--color-text-secondary)' }}>{p.open.length} {p.open.length === 1 ? 'loan' : 'loans'} · since {p.since}</span>
              </span>
              <span className="num" style={{ fontSize: 14.5 }}>{formatINR(p.owed)}</span>
              <Icon name={open === p.name ? 'chevron-down' : 'chevron-right'} size={15} />
            </button>
            {open === p.name && (
              <div style={{ borderTop: '1px solid var(--color-border)', padding: '6px 14px 14px', display: 'grid', gap: 8 }}>
                {p.open.map(l => (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="num" style={{ fontSize: 13.5 }}>{formatINR(l.amount_paise)}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--color-text-secondary)' }}>{l.note ?? 'No note'} · {l.lent_on}</div>
                    </div>
                    <button className="link" disabled={busy} onClick={() => run({ action: 'settle', id: l.id }, `${p.name} returned ${formatINR(l.amount_paise)}`)}>Got back</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 14, marginTop: 4 }}>
                  <button className="link" disabled={busy} onClick={() => run({ action: 'settle_person', name: p.name }, `${p.name} has returned everything`)}>All returned</button>
                  <button className="link" onClick={() => { setAdding(true); setName(p.name); }}>Lend more</button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {settled.length > 0 && (
        <>
          <div className="kicker" style={{ margin: '22px 2px 10px' }}>Settled</div>
          <Card variant="flush">
            {settled.map(p => (
              <div key={p.name} className="row" style={{ padding: '12px 14px', margin: 0 }}>
                <span style={{ ...avatar, opacity: 0.6 }}>{p.name.slice(0, 1).toUpperCase()}</span>
                <span style={{ flex: 1, fontSize: 13.5, color: 'var(--color-text-secondary)' }}>{p.name}</span>
                <span className="num" style={{ fontSize: 13, color: 'var(--color-text-muted)', textDecoration: 'line-through' }}>
                  {formatINR(loans.filter(l => l.person_name === p.name).reduce((s, l) => s + l.amount_paise, 0))}
                </span>
                <span style={{ color: 'var(--color-success)' }}><Icon name="check" size={16} /></span>
              </div>
            ))}
          </Card>
        </>
      )}

      <div style={{ position: 'sticky', bottom: 16, marginTop: 20 }}>
        <Button block size="lg" onClick={() => setAdding(a => !a)}>
          <Icon name="plus" size={17} /> Record money lent
        </Button>
      </div>

      {adding && (
        <div role="dialog" aria-modal="true" aria-label="Record money lent" style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setAdding(false)} style={{ position: 'absolute', inset: 0, background: 'var(--color-scrim)' }} />
          <form onSubmit={record} className="sheet pop" style={{ position: 'relative', background: 'var(--color-surface)', borderRadius: '18px 18px 0 0', padding: '18px 18px 26px', display: 'grid', gap: 10, borderTop: '1px solid var(--color-border)' }}>
          <div className="kicker">Name</div>
          <div className="chiprow" style={{ margin: 0, padding: 0 }}>
            {previousNames.map(n => (
              <button type="button" key={n} className={`chip ${name === n ? 'chip--on' : ''}`} onClick={() => setName(n)}>{n}</button>
            ))}
          </div>
          <Input  placeholder="Person" value={name} onChange={e => setName(e.target.value)} required maxLength={60} />
          <Input numeric inputMode="decimal" placeholder="Amount, e.g. 1500" value={amount} onChange={e => setAmount(e.target.value)} required />
          <Input  placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} maxLength={120} />
          {err && <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 13, margin: 0 }}>{err}</p>}
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
          </form>
        </div>
      )}
    </div>
  );
}

const rowBtn = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '13px 14px', background: 'none', border: 'none', color: 'var(--color-text-primary)', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' } as const;
const avatar = { width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--color-surface-muted)', color: 'var(--color-accent-text)', fontFamily: 'var(--font-heading)', fontWeight: 600, flex: 'none' } as const;
