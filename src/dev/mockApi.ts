/**
 * Dev-only: serves fixture data for the Netlify Functions so the signed-in screens can be
 * viewed without a real account. Enabled only by `?mock` in the URL during `vite` dev.
 * Never runs in a production build.
 */

const DELAY_MS = 1300;

const categories = [
  ['Food Needs', 'need', 12000, 9200],
  ['Health/medical', 'need', 3000, 1400],
  ['Home', 'need', 8000, 8000],
  ['Transportation', 'need', 6000, 4100],
  ['EMI', 'need', 11000, 11000],
  ['UPI Lite', 'need', 2000, 900],
  ['Personal', 'want', 5000, 4200],
  ['Party/Contro', 'want', 2000, 2600],
  ['Utilities', 'want', 3000, 2800],
  ['Trip/Travel', 'want', 4000, 3100],
  ['Other', 'want', 1500, 700],
  ['Clothes', 'want', 2000, 2400],
  ['Food Wants', 'want', 3000, 3600],
  ['Investment', 'save', 20000, 12000],
] as const;

const fixtures: Record<string, (q: URLSearchParams) => unknown> = {
  bootstrap: () => ({
    user: { id: 'mock-user', email: 'demo@example.com' },
    month: '2026-10',
    data: {
      profile: { theme: 'dark', lockEnabled: false },
      accounts: fixtures.accounts(new URLSearchParams()),
      'home?month=2026-10': fixtures.home(new URLSearchParams()),
      'transactions?month=2026-10': { items: [] },
      lent: { items: [] },
    },
  }),
  me: () => ({ id: 'mock-user', email: 'demo@example.com' }),
  profile: () => ({ theme: 'dark', lockEnabled: false }),
  home: () => {
    const cats = categories.map(([name, bucket, plan, spent], i) => ({
      id: `c${i}`,
      name,
      bucket,
      icon: null,
      plannedPaise: plan * 100,
      spentPaise: spent * 100,
    }));
    const sum = (b: string, k: 'plannedPaise' | 'spentPaise') => cats.filter(c => c.bucket === b).reduce((s, c) => s + c[k], 0);
    const spend = cats.filter(c => c.bucket !== 'save').reduce((s, c) => s + c.spentPaise, 0);
    const savings = sum('save', 'spentPaise');
    return {
      month: '2026-10',
      openingPaise: 9240000,
      hasOpening: true,
      incomePaise: 0,
      spendPaise: spend,
      savingsPaise: savings,
      spendableBalancePaise: 9240000 - spend - savings,
      categories: cats,
      buckets: (['need', 'want', 'save'] as const).map(b => ({ bucket: b, plannedPaise: sum(b, 'plannedPaise'), spentPaise: sum(b, 'spentPaise'), hasBudget: true })),
      recent: [],
      asks: [
        { id: 'a1', item: 'Zomato dinner', amountPaise: 64000, categoryName: 'Food Wants', decision: 'skipped' },
        { id: 'a2', item: 'Monthly bus pass', amountPaise: 110000, categoryName: 'Transportation', decision: 'bought' },
        { id: 'a3', item: 'Running sneakers', amountPaise: 420000, categoryName: 'Clothes', decision: 'delayed' },
      ],
    };
  },
  accounts: () => ({
    items: [
      { id: 'acc1', nickname: 'Salary', bank: 'HDFC Bank', kind: 'Debit', icon: 'wallet', position: 0 },
      { id: 'acc2', nickname: 'Rewards', bank: 'ICICI', kind: 'Credit card', icon: 'credit-card', position: 1 },
      { id: 'acc3', nickname: 'Cash', bank: 'Wallet', kind: 'Cash', icon: 'banknote', position: 2 },
      { id: 'acc4', nickname: 'Paytm', bank: 'Paytm', kind: 'UPI wallet', icon: 'smartphone', position: 3 },
    ],
  }),
  transactions: () => ({ items: [] }),
  lent: () => ({ items: [] }),
  asks: () => ({ items: [] }),
};

export function installMockApi() {
  localStorage.setItem('spendcheck.accessToken', 'mock-token');
  const real = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
    if (!url.pathname.startsWith('/.netlify/functions/')) return real(input, init);

    const name = url.pathname.replace('/.netlify/functions/', '');
    const counts = ((window as unknown as { __mockCalls?: Record<string, number> }).__mockCalls ??= {});
    counts[name] = (counts[name] ?? 0) + 1;
    await new Promise(r => setTimeout(r, DELAY_MS));
    const body = fixtures[name]?.(url.searchParams) ?? { ok: true, id: 'mock-id' };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}
