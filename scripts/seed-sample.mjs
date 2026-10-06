// Adds sample SpendCheck data to one user. Server-side only; uses the service key from .env.
// Usage: node --env-file=.env scripts/seed-sample.mjs <user-id> [--force]
// Refuses to run if the user already has transactions, unless --force is given.

import { createClient } from '@supabase/supabase-js';

const [userId, flag] = process.argv.slice(2);
if (!userId) {
  console.error('Usage: node --env-file=.env scripts/seed-sample.mjs <user-id> [--force]');
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set (see .env).');
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const rupees = r => Math.round(r * 100); // all amounts are stored as paise

function check(res, what) {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

// 1. Confirm the user exists and already has the default categories (created at first sign-in).
const profile = check(await admin.from('spend_profiles').select('user_id').eq('user_id', userId).maybeSingle(), 'profile');
if (!profile) {
  console.error('No SpendCheck profile for this user. Sign in once in the app first, then run this again.');
  process.exit(1);
}

const countRes = await admin.from('spend_transactions').select('id', { count: 'exact', head: true }).eq('user_id', userId);
if (countRes.error) throw new Error(`count transactions: ${countRes.error.message}`);
if (flag !== '--force') {
  const count = countRes.count;
  if (count && count > 0) {
    console.error(`This user already has ${count} transactions. Re-run with --force to add sample data anyway.`);
    process.exit(1);
  }
}

// 2. Categories by name, so sample rows point at the user's own category ids.
const cats = check(await admin.from('spend_categories').select('id,name').eq('user_id', userId), 'categories');
const catId = name => {
  const c = cats.find(x => x.name === name);
  if (!c) throw new Error(`Missing category: ${name}`);
  return c.id;
};

// 3. Accounts. Reuse any with the same nickname; create the rest. Max 6 per user.
const wanted = [
  { nickname: 'Salary', bank: 'HDFC Bank', kind: 'Debit', icon: 'wallet' },
  { nickname: 'Rewards', bank: 'ICICI', kind: 'Credit card', icon: 'credit-card' },
  { nickname: 'Cash', bank: 'Wallet', kind: 'Cash', icon: 'banknote' },
  { nickname: 'Paytm', bank: 'Paytm', kind: 'UPI wallet', icon: 'smartphone' },
];
let accounts = check(await admin.from('spend_accounts').select('id,nickname').eq('user_id', userId), 'accounts');
for (const [position, a] of wanted.entries()) {
  if (accounts.some(x => x.nickname === a.nickname)) continue;
  if (accounts.length >= 6) break;
  const row = check(
    await admin.from('spend_accounts').insert({ user_id: userId, ...a, position }).select('id,nickname').single(),
    `account ${a.nickname}`,
  );
  accounts.push(row);
}
const acc = name => {
  const a = accounts.find(x => x.nickname === name);
  if (!a) throw new Error(`Missing account: ${name}`);
  return a.id;
};

// 4. Opening balances for September and October 2026.
check(
  await admin.from('spend_month_settings').upsert(
    [
      { user_id: userId, month: '2026-09-01', opening_paise: rupees(90000) },
      { user_id: userId, month: '2026-10-01', opening_paise: rupees(92400) },
    ],
    { onConflict: 'user_id,month' },
  ),
  'opening balances',
);

// 5. October plans, from the README's category plans.
const plans = {
  'Food Needs': 12000, 'Health/medical': 3000, Home: 8000, Transportation: 6000, EMI: 11000, 'UPI Lite': 2000,
  Personal: 5000, 'Party/Contro': 2000, Utilities: 3000, 'Trip/Travel': 4000, Other: 1500, Clothes: 2000,
  'Food Wants': 3000, Investment: 20000,
};
check(
  await admin.from('spend_budgets').upsert(
    Object.entries(plans).map(([name, r]) => ({
      user_id: userId, category_id: catId(name), month: '2026-10-01', planned_paise: rupees(r),
    })),
    { onConflict: 'user_id,category_id,month' },
  ),
  'budgets',
);

// 6. Transactions. Spend uses a category; credit with a category is a refund; transfers move money.
const spend = (date, desc, amount, cat, account) => ({
  user_id: userId, type: 'spend', amount_paise: rupees(amount), txn_date: date, description: desc,
  category_id: catId(cat), account_id: acc(account),
});
const txns = [
  // October
  spend('2026-10-01', 'House rent', 11000, 'EMI', 'Salary'),
  spend('2026-10-01', 'Electricity bill', 1180, 'Home', 'Salary'),
  spend('2026-10-01', 'Monthly bus pass', 1100, 'Transportation', 'Salary'),
  spend('2026-10-02', 'BigBasket groceries', 2380, 'Food Needs', 'Salary'),
  spend('2026-10-02', 'Netflix', 649, 'Utilities', 'Rewards'),
  spend('2026-10-02', 'SIP — Index fund', 5000, 'Investment', 'Salary'),
  spend('2026-10-03', 'Paracetamol strip', 85, 'Health/medical', 'Cash'),
  spend('2026-10-03', 'Mobile recharge', 299, 'UPI Lite', 'Paytm'),
  spend('2026-10-04', 'Nykaa order', 1240, 'Clothes', 'Rewards'),
  spend('2026-10-04', 'Chai + samosa', 60, 'Food Wants', 'Paytm'),
  spend('2026-10-05', 'Zomato — dinner', 640, 'Food Wants', 'Paytm'),
  spend('2026-10-05', 'Auto rickshaw', 90, 'Transportation', 'Cash'),
  {
    user_id: userId, type: 'credit', amount_paise: rupees(450), txn_date: '2026-10-03',
    description: 'Amazon refund', category_id: catId('Clothes'), account_id: acc('Rewards'),
  },
  {
    user_id: userId, type: 'transfer', amount_paise: rupees(5000), txn_date: '2026-10-04',
    description: 'Credit card bill payment', account_id: acc('Salary'), to_account_id: acc('Rewards'), external: false,
  },
  {
    user_id: userId, type: 'transfer', amount_paise: rupees(500), txn_date: '2026-10-06',
    description: 'Paid Ravi (UPI)', account_id: acc('Paytm'), external: true,
  },
  // September
  spend('2026-09-01', 'House rent', 11000, 'EMI', 'Salary'),
  spend('2026-09-03', 'Groceries', 2100, 'Food Needs', 'Salary'),
  spend('2026-09-10', 'Dinner out', 900, 'Food Wants', 'Paytm'),
  spend('2026-09-14', 'Shoes', 1500, 'Clothes', 'Rewards'),
  spend('2026-09-20', 'SIP — Index fund', 5000, 'Investment', 'Salary'),
];
check(
  await admin.from('spend_transactions').insert(txns.map(t => ({ external: false, ...t }))),
  'transactions',
);

// 7. "Should I buy this?" decisions. Bought ones are already recorded above as spends.
check(
  await admin.from('spend_asks').insert([
    { user_id: userId, item: 'Zomato dinner', amount_paise: rupees(640), category_id: catId('Food Wants'), decision: 'skipped' },
    { user_id: userId, item: 'Monthly bus pass', amount_paise: rupees(1100), category_id: catId('Transportation'), decision: 'bought' },
    { user_id: userId, item: 'Running sneakers', amount_paise: rupees(4200), category_id: catId('Clothes'), decision: 'delayed' },
    { user_id: userId, item: 'Wireless earbuds', amount_paise: rupees(2499), category_id: catId('Personal'), decision: 'skipped' },
  ]),
  'asks',
);

// 8. Money lent. Lent money does not change the balance.
check(
  await admin.from('spend_lent_loans').insert([
    { user_id: userId, person_name: 'Rohit', amount_paise: rupees(1500), lent_on: '2026-10-06', note: 'Movie + dinner' },
    { user_id: userId, person_name: 'Priya', amount_paise: rupees(5000), lent_on: '2026-10-02', note: 'Rent top-up' },
    { user_id: userId, person_name: 'Rohit', amount_paise: rupees(800), lent_on: '2026-09-30', note: 'Cab' },
    { user_id: userId, person_name: 'Ankit', amount_paise: rupees(2000), lent_on: '2026-07-21', note: 'Concert ticket', settled_at: new Date().toISOString() },
  ]),
  'lent loans',
);

console.log(`Sample data added for ${userId}: ${accounts.length} accounts, ${txns.length} transactions, ${Object.keys(plans).length} October plans, 4 asks, 4 loans.`);
