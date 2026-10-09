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

function nextMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
}

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
      // Open /?mock&undecided to see the starting-balance prompt with last month's closing balance suggested.
      decided: !location.search.includes('undecided'),
      suggestedOpening: location.search.includes('undecided') ? { month: '2026-09', paise: 2640000 } : null,
      hasOpening: true,
      incomePaise: 0,
      spendPaise: spend,
      savingsPaise: savings,
      spendableBalancePaise: 9240000 - spend - savings,
      safeToSpendPaise: 9240000 - spend - savings - 1564900,
      upcomingBills: [
        { name: 'Netflix', amountPaise: 64900, dueOn: '2026-10-15' },
        { name: 'Home loan EMI', amountPaise: 1500000, dueOn: '2026-10-20' },
      ],
      moneyIn: { totalPaise: 6000000, incomePaise: 6000000, salaryPaise: 6000000, goneBackPaise: 0, borrowedPaise: 0, othersPaise: 0 },
      moneyOut: { totalPaise: spend + savings, spendPaise: spend, savingsPaise: savings, outsidePaise: 0, lentPaise: 0 },
      byAccount: [{ accountId: 'acc1', paise: 4_200_000 }, { accountId: 'acc2', paise: 1_200_000 }, { accountId: 'acc3', paise: 700_000 }],
      card: { spentPaise: 1_200_000, paidPaise: 0, duePaise: 1_200_000, byCategoryPaise: { c12: 640_000, c0: 400_000, c3: 160_000 } },
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
      { id: 'acc1', nickname: 'Salary', bank: 'HDFC Bank', kind: 'Debit', icon: 'wallet', position: 0, opening_balance_paise: 8_500_000, opening_balance_on: '2026-10-01', balance_paise: 6_412_550 },
      { id: 'acc2', nickname: 'Rewards', bank: 'ICICI', kind: 'Credit card', icon: 'credit-card', position: 1, opening_balance_paise: -1_200_000, opening_balance_on: '2026-10-01', balance_paise: -1_864_900, credit_limit_paise: 10_000_000 },
      { id: 'acc3', nickname: 'Cash', bank: 'Wallet', kind: 'Cash', icon: 'banknote', position: 2, opening_balance_paise: null, opening_balance_on: null, balance_paise: null },
      { id: 'acc4', nickname: 'Paytm', bank: 'Paytm', kind: 'UPI wallet', icon: 'smartphone', position: 3, opening_balance_paise: 50_000, opening_balance_on: '2026-10-05', balance_paise: -12_000 },
    ],
  }),
  export: q => {
    const from = q.get('from') ?? '2026-10';
    const to = q.get('to') ?? from;
    const items = [];
    for (let m = from; m <= to; m = nextMonth(m)) {
      items.push(
        { date: `${m}-01`, type: 'credit', amountPaise: 6_000_000, external: false, categoryName: null, bucket: null, accountName: 'Salary', toAccountName: null, description: null, reference: 'Salary, Acme', creditCategory: 'salary' },
        { date: `${m}-03`, type: 'spend', amountPaise: 64_000, external: false, categoryName: 'Food Wants', bucket: 'want', accountName: 'Rewards', toAccountName: null, description: 'Dinner "Biryani House"', reference: null, creditCategory: null },
        { date: `${m}-10`, type: 'spend', amountPaise: 1_000_000, external: false, categoryName: 'Investment', bucket: 'save', accountName: 'Salary', toAccountName: null, description: '=Index fund SIP', reference: null, creditCategory: null },
        { date: `${m}-15`, type: 'transfer', amountPaise: 1_200_000, external: false, categoryName: null, bucket: null, accountName: 'Salary', toAccountName: 'Rewards', description: 'Card bill', reference: null, creditCategory: null },
      );
    }
    return { from, to, items };
  },
  transactions: () => ({ items: [] }),
  insurance: () => ({
    items: [
      { id: 'pol1', name: 'Family health cover', insurer: 'Star Health', policy_number: 'SH-4471', policy_type: 'health', premium_paise: 1_200_000, frequency: 'yearly', next_due_on: '2026-10-25', sum_assured_paise: 50_000_000, account_id: 'acc1', category_id: 'c0', auto_debit: false, active: true, due_day: 25 },
    ],
  }),
  commitments: () => ({
    month: '2026-10',
    items: [
      { id: 'k1', kind: 'subscription', name: 'Netflix', amountPaise: 64900, dayOfMonth: 5, categoryId: 'c12', categoryName: 'Food Wants', bucket: 'want', accountId: 'acc2', active: true, startsOn: '2026-01-05', postedThisMonth: true, nextDueDate: '2026-11-05', loan: null },
      { id: 'k2', kind: 'investment', name: 'Index fund SIP', amountPaise: 1000000, dayOfMonth: 10, categoryId: 'c13', categoryName: 'Investment', bucket: 'save', accountId: 'acc1', active: true, startsOn: '2026-01-10', postedThisMonth: false, nextDueDate: '2026-10-10', loan: null },
      { id: 'k3', kind: 'loan', name: 'Home loan', amountPaise: 2000000, dayOfMonth: 15, categoryId: 'c4', categoryName: 'EMI', bucket: 'need', accountId: 'acc1', active: true, startsOn: '2026-01-15', postedThisMonth: false, nextDueDate: '2026-10-15', loan: { isNew: false, outstandingPaise: 45000000, rateBps: 850, tenureRemaining: 180, nextEmiDate: '2026-10-15', nextInterestPaise: 318750, nextPrincipalPaise: 1681250, remainingAfterNextPaise: 44318750 } },
    ],
    totals: { subscriptionsPaise: 64900, investmentsPaise: 1000000, emisPaise: 2000000 },
  }),
  lent: () => ({ items: [] }),
  asks: () => ({ items: [] }),
  savings: () => ({
    averageMonthlySpendPaise: 4500000,
    emergencySuggestionPaise: 27000000,
    items: [
      { id: 's1', name: 'Emergency fund', kind: 'emergency', target_paise: 27000000, emergency_months: 6, opening_paise: 5000000, monthly_contribution_paise: 1500000, target_date: '2027-12-31', account_id: 'acc1', category_id: 'c13', priority: 0, active: true, created_at: '2026-06-01T00:00:00Z', saved_paise: 9500000 },
      { id: 's2', name: 'New laptop', kind: 'goal', target_paise: 12000000, emergency_months: null, opening_paise: 0, monthly_contribution_paise: 1000000, target_date: '2027-02-01', account_id: 'acc1', category_id: 'c13', priority: 1, active: true, created_at: '2026-07-01T00:00:00Z', saved_paise: 3000000 },
      { id: 's3', name: 'Goa trip', kind: 'goal', target_paise: 4000000, emergency_months: null, opening_paise: 1000000, monthly_contribution_paise: null, target_date: null, account_id: 'acc4', category_id: 'c13', priority: 2, active: true, created_at: '2026-08-01T00:00:00Z', saved_paise: 4200000 },
    ],
  }),
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
