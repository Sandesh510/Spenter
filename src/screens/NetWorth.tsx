import { Card } from '../components/ui/Card';
import { Icon } from '../components/Icon';
import { useAmountsShown } from '../lib/amountVisibility';
import { netWorth, type Line, type NetWorth as NetWorthResult } from '../lib/netWorth';
import { useApi } from '../lib/useApi';
import type { Account, CommitmentsData, Loan, SavingsData } from '../lib/types';
import type { Route } from '../App';

/** Net worth worked out from the accounts, savings plans, money lent and loans already tracked. Null until they load. */
function useNetWorth(token: string): NetWorthResult | null {
  const accounts = useApi<{ items: Account[] }>('accounts', token);
  const savings = useApi<SavingsData>('savings', token);
  const lent = useApi<{ items: Loan[] }>('lent', token);
  const commitments = useApi<CommitmentsData>('commitments', token);
  if (!accounts.data || !savings.data || !lent.data || !commitments.data) return null;
  return netWorth({
    accounts: accounts.data.items,
    plans: savings.data.items,
    loans: commitments.data.items
      .filter(c => c.kind === 'loan' && c.loan)
      .map(c => ({ id: c.id, name: c.name, outstandingPaise: c.loan?.outstandingPaise ?? 0 })),
    lentOutstandingPaise: lent.data.items.reduce((s, l) => s + l.outstanding_paise, 0),
  });
}

/** Home card: the net worth figure (hidden until the eye is on) that opens the full breakdown. */
export function NetWorthCard({ token, onOpen }: { token: string; onOpen: () => void }) {
  const result = useNetWorth(token);
  const [, , money] = useAmountsShown();
  return (
    <Card as="button" onClick={onOpen} className="card--link">
      <div className="flex ai-c jc-sb">
        <span className="fs-13 c-sec">Net worth</span>
        <span className="flex ai-c gap-8">
          <span className="num fs-15">{result ? money(result.netPaise) : '…'}</span>
          <Icon name="chevron-right" size={16} />
        </span>
      </div>
    </Card>
  );
}

export function NetWorth({ token, go }: { token: string; go: (r: Route) => void }) {
  const result = useNetWorth(token);
  const [shown, toggleShown, money] = useAmountsShown();

  return (
    <div className="scroll">
      <div className="topbar topbar--inset">
        <button className="iconbtn" onClick={() => go('home')} aria-label="Back to Home"><Icon name="chevron-left" size={18} /></button>
        <h1 className="topbar__title">Net worth</h1>
        <button className="iconbtn" onClick={toggleShown} aria-pressed={shown} aria-label={shown ? 'Hide amounts' : 'Show amounts'}>
          <Icon name={shown ? 'eye' : 'eye-off'} size={16} />
        </button>
      </div>

      {!result && <p className="fs-13 c-sec mt-12">Loading…</p>}

      {result && (
        <>
          <Card as="section" className="mt-8" aria-label="Net worth">
            <div className="fs-12 c-sec">What you hold, less what you owe</div>
            <div className={`heading num fs-44 mt-4 nw-total${shown && result.netPaise < 0 ? ' c-danger' : ''}`}>{money(result.netPaise)}</div>
            <dl className="num flex jc-sb fs-13 m-0 mt-12">
              <div><dt className="c-sec">Assets</dt><dd className="m-0 c-success">{money(result.assets.totalPaise)}</dd></div>
              <div className="ta-r"><dt className="c-sec">Owed</dt><dd className="m-0">{money(result.liabilities.totalPaise)}</dd></div>
            </dl>
          </Card>

          <Group title="Assets" total={money(result.assets.totalPaise)}>
            <Rows lines={result.assets.accounts} heading="Accounts" money={money} />
            <Rows lines={result.assets.savings} heading="Savings plans" money={money} />
            {result.assets.lentPaise > 0 && (
              <Rows lines={[{ id: 'lent', label: 'Money lent, yet to get back', paise: result.assets.lentPaise }]} heading="Owed to you" money={money} />
            )}
            {result.assets.totalPaise === 0 && <p className="fs-12 c-mut m-0">Nothing counted yet.</p>}
          </Group>

          <Group title="What you owe" total={money(result.liabilities.totalPaise)}>
            <Rows lines={result.liabilities.cards} heading="Credit cards" money={money} />
            <Rows lines={result.liabilities.loans} heading="Loans" money={money} />
            <Rows lines={result.liabilities.overdrawn} heading="Below zero" money={money} />
            {result.liabilities.totalPaise === 0 && <p className="fs-12 c-mut m-0">Nothing owed.</p>}
          </Group>

          {result.untrackedAccounts.length > 0 && (
            <p className="fs-12 c-sec m-0 mt-16">
              Not counted: {result.untrackedAccounts.join(', ')}. {result.untrackedAccounts.length === 1 ? 'It has' : 'They have'} no opening balance. Set one in Settings, Accounts, and it is included.
            </p>
          )}
          <p className="fs-12 c-mut m-0 mt-8">Savings plans are counted at what is saved, apart from the account the money left, so nothing is counted twice. Loans are counted at what is left to repay.</p>
        </>
      )}
    </div>
  );
}

function Group({ title, total, children }: { title: string; total: string; children: React.ReactNode }) {
  return (
    <Card as="section" className="mt-12" aria-label={title}>
      <div className="flex ai-base jc-sb">
        <h2 className="kicker kicker--spaced m-0">{title}</h2>
        <span className="num fs-15">{total}</span>
      </div>
      <div className="grid gap-12 mt-8">{children}</div>
    </Card>
  );
}

function Rows({ lines, heading, money }: { lines: Line[]; heading: string; money: (p: number) => string }) {
  if (lines.length === 0) return null;
  return (
    <section aria-label={heading}>
      <h3 className="fs-12 c-sec m-0">{heading}</h3>
      <ul className="list-reset grid gap-6 mt-4">
        {lines.map(l => (
          <li key={l.id} className="flex jc-sb fs-13">
            <span>{l.label}</span>
            <span className="num">{money(l.paise)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
