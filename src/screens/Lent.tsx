import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field, Input } from '../components/ui/Field';
import { useMemo, useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { haptic } from '../lib/haptics';
import { formatINR } from '../lib/money';
import { todayIST } from '../lib/dates';
import { useApi } from '../lib/useApi';
import type { Loan } from '../lib/types';
import type { Route } from '../App';

interface Person {
  name: string;
  open: Loan[];
  owed: number;
  since: string;
}

interface LoanForm {
  name: string;
  amount: string;
  note: string;
  lentOn: string;
  accountId: string | null;
}

/**
 * Money lent, per the README. Lent money is not part of budgets or the Log and does not change the balance.
 */
export function Lent({ token, go, onToast }: { token: string; go: (r: Route) => void; onToast: (m: string) => void }) {
  const { data, error, reload } = useApi<{ items: Loan[] }>('lent', token);
  const accounts = useApi<{ items: { id: string; nickname: string }[] }>('accounts', token);
  const accountName = (id: string | null) => accounts.data?.items.find(a => a.id === id)?.nickname ?? '';
  const [open, setOpen] = useState<string | null>(null);
  /** null = dialog closed; 'new' = recording a loan; a loan = editing that loan. */
  const [dialog, setDialog] = useState<'new' | Loan | null>(null);
  const [form, setForm] = useState<LoanForm>({ name: '', amount: '', note: '', lentOn: todayIST(), accountId: null });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loans = data?.items ?? [];
  const people = useMemo(() => {
    const map = new Map<string, Person>();
    for (const l of loans) {
      const p = map.get(l.person_name) ?? { name: l.person_name, open: [], owed: 0, since: l.lent_on };
      if (l.outstanding_paise > 0) {
        p.open.push(l);
        p.owed += l.outstanding_paise;
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
  const accountItems = accounts.data?.items ?? [];

  function openNew(prefillName = '') {
    setErr(null);
    setForm({ name: prefillName, amount: '', note: '', lentOn: todayIST(), accountId: accountItems[0]?.id ?? null });
    setDialog('new');
  }

  function openEdit(l: Loan) {
    setErr(null);
    setForm({
      name: l.person_name,
      amount: String(l.amount_paise / 100),
      note: l.note ?? '',
      lentOn: l.lent_on,
      accountId: l.debit_account_id,
    });
    setDialog(l);
  }

  async function run(body: Record<string, unknown>, done: string) {
    setErr(null);
    setBusy(true);
    try {
      await api('lent', { token, body });
      haptic('success');
      reload();
      onToast(done);
      return true;
    } catch (e) {
      haptic('error');
      setErr(e instanceof Error ? e.message : 'Could not save');
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** Records each loan's outstanding amount as a Got back credit into the first account. */
  async function gotBack(list: Loan[], done: string) {
    // A Got back goes into the account the loan was lent from; otherwise the first account.
    const accountId = list[0]?.debit_account_id ?? accountItems[0]?.id;
    if (!accountId) return setErr('Add an account in Settings first');
    setErr(null);
    setBusy(true);
    try {
      for (const l of list) {
        await api('transactions', {
          token,
          body: { type: 'credit', amount: String(l.outstanding_paise / 100), date: todayIST(), accountId, creditCategory: 'gone_back', lentLoanId: l.id },
        });
      }
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

  async function save(e: FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    const amountRupees = Number(form.amount);
    const summary = `${formatINR(Math.round(amountRupees * 100))} for ${name}`;
    const ok = dialog && dialog !== 'new'
      ? await run({ action: 'update', id: dialog.id, name, amount: form.amount, note: form.note.trim() || undefined, lentOn: form.lentOn, accountId: form.accountId ?? '' }, `Updated ${summary}`)
      : await run({ action: 'add', name, amount: form.amount, note: form.note.trim() || undefined, lentOn: form.lentOn, accountId: form.accountId ?? undefined }, `Lent ${summary}`);
    if (ok) setDialog(null);
  }

  const editing = dialog !== null && dialog !== 'new';

  return (
    <div className="scroll">
      <div className="topbar topbar--inset">
        <button className="iconbtn" onClick={() => go('home')} aria-label="Back"><Icon name="chevron-left" size={18} /></button>
        <span className="topbar__title">Money lent</span>
        <span className="topbar__spacer" aria-hidden="true" />
      </div>

      {error && <p className="c-danger fs-13" role="alert">{error}</p>}

      <Card className="mt-8" as="section">
        <div className="fs-13 c-sec">Yet to get back</div>
        <div className="heading num fs-44 mt-4" style={{ lineHeight: 1.05 }}>{formatINR(totalOwed)}</div>
        <div className="fs-13 c-sec mt-4">{outstanding.length} {outstanding.length === 1 ? 'person owes' : 'people owe'} you</div>
      </Card>

      <div className="kicker" style={{ margin: '22px 2px 10px' }}>Outstanding</div>
      {outstanding.length === 0 && <p className="fs-13 c-sec">Nothing outstanding.</p>}
      <div className="grid gap-10">
        {outstanding.map(p => (
          <Card key={p.name} variant="flush">
            <button onClick={() => setOpen(open === p.name ? null : p.name)} style={rowBtn}>
              <span style={avatar}>{p.name.slice(0, 1).toUpperCase()}</span>
              <span className="flex-1">
                <span className="fs-14" style={{ display: 'block' }}>{p.name}</span>
                <span className="fs-12 c-sec" style={{ display: 'block' }}>{p.open.length} {p.open.length === 1 ? 'loan' : 'loans'} · since {p.since}</span>
              </span>
              <span className="num fs-15">{formatINR(p.owed)}</span>
              <Icon name={open === p.name ? 'chevron-down' : 'chevron-right'} size={15} />
            </button>
            {open === p.name && (
              <div className="grid gap-8" style={{ borderTop: '1px solid var(--color-border)', padding: '6px 14px 14px' }}>
                {p.open.map(l => (
                  <div className="flex ai-c gap-10" key={l.id}>
                    <div className="flex-1 min-0">
                      <div className="num fs-14">{formatINR(l.outstanding_paise)} <span className="c-mut">of {formatINR(l.amount_paise)}</span></div>
                      <div className="fs-12 c-sec">{l.note ?? 'No note'} · {l.lent_on}{l.debit_account_id ? ` · from ${accountName(l.debit_account_id)}` : ' · no account'}</div>
                    </div>
                    <button className="link" disabled={busy} onClick={() => openEdit(l)}>Edit</button>
                    <button className="link" disabled={busy} onClick={() => gotBack([l], `${p.name} got back ${formatINR(l.outstanding_paise)}`)}>Got back</button>
                  </div>
                ))}
                <div className="flex gap-14 mt-4">
                  <button className="link" disabled={busy} onClick={() => gotBack(p.open, `${p.name} has got back everything`)}>All got back</button>
                  <button className="link" onClick={() => openNew(p.name)}>Lend more</button>
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
                <span className="flex-1 fs-14 c-sec">{p.name}</span>
                <span className="num fs-13 c-mut" style={{ textDecoration: 'line-through' }}>
                  {formatINR(loans.filter(l => l.person_name === p.name).reduce((s, l) => s + l.amount_paise, 0))}
                </span>
                <span className="c-success"><Icon name="check" size={16} /></span>
              </div>
            ))}
          </Card>
        </>
      )}

      <div className="mt-20" style={{ position: 'sticky', bottom: 16 }}>
        <Button block size="lg" onClick={() => (dialog ? setDialog(null) : openNew())}>
          <Icon name="plus" size={17} /> Record money lent
        </Button>
      </div>

      {dialog !== null && (
        <div className="abs inset-0 flex" role="dialog" aria-modal="true" aria-label={editing ? 'Edit money lent' : 'Record money lent'} style={{ zIndex: 30, flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setDialog(null)} style={{ position: 'absolute', inset: 0, background: 'var(--color-scrim)' }} />
          <form onSubmit={save} className="pop rel grid gap-10" style={{ background: 'var(--color-surface)', borderRadius: '18px 18px 0 0', padding: '18px 18px 26px', borderTop: '1px solid var(--color-border)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="kicker">{editing ? 'Edit loan' : 'New loan'}</div>

            {!editing && previousNames.length > 0 && (
              <fieldset className="fieldset-reset grid gap-6">
                <legend className="kicker kicker--spaced">Person</legend>
                <div className="chiprow" style={{ margin: 0, padding: 0 }}>
                  {previousNames.map(n => (
                    <button type="button" key={n} aria-pressed={form.name === n} className={`chip ${form.name === n ? 'chip--on' : ''}`} onClick={() => setForm(f => ({ ...f, name: n }))}>{n}</button>
                  ))}
                </div>
              </fieldset>
            )}

            <Field label="Person">
              <Input placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required maxLength={60} />
            </Field>
            <Field label="Amount (₹)">
              <Input numeric inputMode="decimal" placeholder="e.g. 1500" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
            </Field>
            <Field label="Date lent">
              <Input type="date" value={form.lentOn} onChange={e => setForm(f => ({ ...f, lentOn: e.target.value }))} required max={todayIST()} />
            </Field>
            <Field label="Note (optional)">
              <Input placeholder="What it was for" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} maxLength={120} />
            </Field>

            <fieldset className="fieldset-reset grid gap-6">
              <legend className="kicker kicker--spaced">Paid from (debit account)</legend>
              <div className="chiprow" style={{ margin: 0, padding: 0 }}>
                {editing && (
                  <button type="button" aria-pressed={form.accountId === null} className={`chip ${form.accountId === null ? 'chip--on' : ''}`} onClick={() => setForm(f => ({ ...f, accountId: null }))}>No account</button>
                )}
                {accountItems.map(a => (
                  <button type="button" key={a.id} aria-pressed={form.accountId === a.id} className={`chip ${form.accountId === a.id ? 'chip--on' : ''}`} onClick={() => setForm(f => ({ ...f, accountId: a.id }))}>{a.nickname}</button>
                ))}
              </div>
            </fieldset>

            {err && <p className="c-danger fs-13" role="alert" style={{ margin: 0 }}>{err}</p>}
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Save'}</Button>
          </form>
        </div>
      )}
    </div>
  );
}

const rowBtn = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '13px 14px', background: 'none', border: 'none', color: 'var(--color-text-primary)', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' } as const;
const avatar = { width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--color-surface-muted)', color: 'var(--color-accent-text)', fontFamily: 'var(--font-heading)', fontWeight: 600, flex: 'none' } as const;
