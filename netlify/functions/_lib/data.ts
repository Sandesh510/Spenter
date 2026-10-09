import type { SupabaseClient } from '@supabase/supabase-js';
import { monthTotals, type Bucket, type Txn } from '../../../src/lib/ledger';
import { monthRange } from './month';
import { postDue } from './commitments';
import { postInsurance } from './insurance';
import { billsStillDue, safeToSpend } from '../../../src/lib/safeToSpend';
import { todayIST } from './input';
import { selectAll } from './paged';
import { shiftMonth } from '../../../src/lib/dates';
import { suggestOpening } from '../../../src/lib/openingSuggestion';
import { accountBalances, type BalanceLoan, type BalanceTxn } from '../../../src/lib/accountBalance';

/**
 * Shared loaders. Each one is scoped to a user id. The admin client bypasses RLS,
 * so every query must filter by user_id. bootstrap and the single-purpose endpoints both use these.
 */

interface CategoryRow {
  id: string;
  name: string;
  bucket: Bucket;
  icon: string | null;
}

export async function loadHome(admin: SupabaseClient, userId: string, month: string) {
  const { start, end, firstDay } = monthRange(month);
  // Due commitments are posted before reading, so Home always shows this month's SIPs, EMIs and subscriptions.
  const today = todayIST();
  // Independent of each other, so they run together rather than one after another.
  await Promise.all([postDue(admin, userId, today), postInsurance(admin, userId, today), carryBudgetsForward(admin, userId, firstDay)]);
  const isCurrentMonth = today.slice(0, 7) === month;

  const [catRes, openRes, budgetRes, txnRes, askRes, lentRes, commitRes, policyRes] = await Promise.all([
    admin.from('spend_categories').select('id,name,bucket,icon,sort_order').eq('user_id', userId).order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
    admin.from('spend_month_settings').select('opening_paise').eq('user_id', userId).eq('month', firstDay).maybeSingle(),
    admin.from('spend_budgets').select('category_id,planned_paise').eq('user_id', userId).eq('month', firstDay),
    admin
      .from('spend_transactions')
      .select('id,type,amount_paise,txn_date,description,category_id,account_id,to_account_id,external,deleted_at,created_at,credit_category,reference,lent_loan_id')
      .eq('user_id', userId)
      .gte('txn_date', start)
      .lt('txn_date', end)
      .is('deleted_at', null)
      .order('txn_date', { ascending: false })
      .order('created_at', { ascending: false }),
    admin
      .from('spend_asks')
      .select('id,item,amount_paise,category_id,decision')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(4),
    admin.from('spend_lent_loans').select('amount_paise').eq('user_id', userId).gte('lent_on', start).lt('lent_on', end),
    admin
      .from('spend_commitments')
      .select('name,kind,amount_paise,day_of_month,starts_on,active,outstanding_paise,tenure_remaining')
      .eq('user_id', userId)
      .eq('active', true),
    admin.from('spend_insurance_policies').select('name,premium_paise,next_due_on,active').eq('user_id', userId).eq('active', true),
  ]);
  for (const r of [catRes, openRes, budgetRes, txnRes, askRes, lentRes, commitRes, policyRes]) if (r.error) throw r.error;
  const lentOutPaise = (lentRes.data ?? []).reduce((s, l) => s + l.amount_paise, 0);

  const categories = (catRes.data as CategoryRow[]) ?? [];
  const bucketOf = new Map(categories.map(c => [c.id, c.bucket]));
  const openingPaise = openRes.data?.opening_paise ?? 0;
  const rows = txnRes.data ?? [];

  const txns: Txn[] = rows.map(r => toLedgerTxn(r, bucketOf));

  const totals = monthTotals({ month, openingPaise, txns, lentOutPaise });

  // Money in and out for the month: everything that moved the balance. Income is only salary and others;
  // got back and borrowed money are shown apart so they never look like earnings.
  const moneyIn = {
    totalPaise: totals.incomePaise + totals.returnedPaise + totals.borrowedPaise,
    incomePaise: totals.incomePaise,
    salaryPaise: 0,
    goneBackPaise: 0,
    borrowedPaise: 0,
    othersPaise: 0,
  };
  let outsidePaise = 0;
  for (const r of rows) {
    if (r.type === 'credit') {
      if (r.credit_category === 'salary') moneyIn.salaryPaise += r.amount_paise;
      else if (r.credit_category === 'gone_back') moneyIn.goneBackPaise += r.amount_paise;
      else if (r.credit_category === 'borrowed') moneyIn.borrowedPaise += r.amount_paise;
      else moneyIn.othersPaise += r.amount_paise;
    } else if (r.type === 'transfer' && r.external) {
      outsidePaise += r.amount_paise;
    }
  }
  const moneyOut = {
    totalPaise: totals.spendPaise + totals.savingsPaise + outsidePaise + lentOutPaise,
    spendPaise: totals.spendPaise,
    savingsPaise: totals.savingsPaise,
    outsidePaise,
    lentPaise: lentOutPaise,
  };

  // Bills still to come this month are held back from what is safe to spend. Past months have none.
  const upcoming = isCurrentMonth
    ? billsStillDue({
        today,
        commitments: (commitRes.data ?? []).map(c => ({
          name: c.name,
          amountPaise: c.amount_paise,
          day: c.day_of_month,
          startsOn: c.starts_on,
          active: c.active,
          isLoan: c.kind === 'loan',
          outstandingPaise: c.outstanding_paise,
          tenureRemaining: c.tenure_remaining,
        })),
        policies: (policyRes.data ?? []).map(p => ({ name: p.name, premiumPaise: p.premium_paise, nextDueOn: p.next_due_on, active: p.active })),
      })
    : [];

  const planByCategory = new Map<string, number>();
  for (const b of budgetRes.data ?? []) planByCategory.set(b.category_id, b.planned_paise);

  const categoryRows = categories.map(c => ({
    id: c.id,
    name: c.name,
    bucket: c.bucket,
    icon: c.icon,
    plannedPaise: planByCategory.get(c.id) ?? null,
    spentPaise: totals.spentByCategory[c.id] ?? 0,
  }));

  const buckets = (['need', 'want', 'save'] as Bucket[]).map(bucket => {
    const inBucket = categoryRows.filter(c => c.bucket === bucket);
    return {
      bucket,
      plannedPaise: inBucket.reduce((s, c) => s + (c.plannedPaise ?? 0), 0),
      spentPaise: inBucket.reduce((s, c) => s + c.spentPaise, 0),
      hasBudget: inBucket.some(c => c.plannedPaise !== null),
    };
  });

  return {
    month,
    openingPaise,
    decided: openRes.data !== null,
    hasOpening: openRes.data?.opening_paise != null,
    incomePaise: totals.incomePaise,
    spendPaise: totals.spendPaise,
    savingsPaise: totals.savingsPaise,
    spendableBalancePaise: totals.spendableBalancePaise,
    // Offered only while the month still has no starting-balance decision.
    suggestedOpening: openRes.data === null ? await suggestedOpeningFor(admin, userId, month, bucketOf) : null,
    safeToSpendPaise: safeToSpend(totals.spendableBalancePaise, upcoming),
    upcomingBills: upcoming,
    moneyIn,
    moneyOut,
    categories: categoryRows,
    buckets,
    recent: rows.slice(0, 10).map(r => ({
      id: r.id,
      type: r.type,
      amountPaise: r.amount_paise,
      txnDate: r.txn_date,
      description: r.description,
      categoryId: r.category_id,
    })),
    asks: ((askRes.data as { id: string; item: string; amount_paise: number; category_id: string | null; decision: string }[]) ?? []).map(a => ({
      id: a.id,
      item: a.item,
      amountPaise: a.amount_paise,
      categoryName: categories.find(c => c.id === a.category_id)?.name ?? null,
      decision: a.decision,
    })),
  };
}

/** Live transactions for one month, newest first. */
export async function loadTransactions(admin: SupabaseClient, userId: string, month: string) {
  const { start, end } = monthRange(month);
  const { data, error } = await admin
    .from('spend_transactions')
    .select('id,type,amount_paise,txn_date,description,category_id,account_id,to_account_id,external,created_at,credit_category,reference,lent_loan_id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .gte('txn_date', start)
    .lt('txn_date', end)
    .order('txn_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return { items: data ?? [] };
}

interface AccountRow {
  id: string;
  nickname: string;
  bank: string | null;
  kind: string | null;
  icon: string | null;
  position: number;
  opening_balance_paise: number | null;
  opening_balance_on: string | null;
  credit_limit_paise?: number | string | null;
}

/**
 * Accounts with their balance now. A balance is derived from the opening balance plus live entries and
 * money lent since its date (src/lib/accountBalance.ts); it is null when no opening balance is set.
 * One read of entries and one of loans covers every account, from the earliest opening date.
 */
export async function loadAccounts(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from('spend_accounts')
    // Every column, so a database that has not had migration 0013 yet (no credit_limit_paise) still works.
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true });
  if (error) throw error;
  // bigint columns can come back as strings; money is always a number of paise in the API.
  const rows = ((data as AccountRow[] | null) ?? []).map(a => ({
    ...a,
    opening_balance_paise: a.opening_balance_paise === null ? null : Number(a.opening_balance_paise),
    credit_limit_paise: a.credit_limit_paise == null ? null : Number(a.credit_limit_paise),
  }));

  const withOpening = rows.filter(a => a.opening_balance_paise !== null && a.opening_balance_on !== null);
  let balances = new Map<string, number | null>();
  if (withOpening.length > 0) {
    const since = withOpening.map(a => a.opening_balance_on as string).sort()[0];
    const { txns, loans } = await loadBalanceInputs(admin, userId, withOpening.map(a => a.id), since);
    balances = accountBalances(
      rows.map(a => ({ id: a.id, openingPaise: a.opening_balance_paise, openingOn: a.opening_balance_on })),
      txns,
      loans,
    );
  }

  return {
    items: rows.map(a => ({
      ...a,
      balance_paise: balances.get(a.id) ?? null,
    })),
  };
}

/**
 * Live entries and loans that touch any of `accountIds`, dated on or after `since` (YYYY-MM-DD),
 * in the shape accountBalance reads. Scoped to the user; account ids come from the user's own rows.
 */
export async function loadBalanceInputs(
  admin: SupabaseClient,
  userId: string,
  accountIds: string[],
  since: string,
): Promise<{ txns: BalanceTxn[]; loans: BalanceLoan[] }> {
  const ids = accountIds.join(',');
  const [txnRows, loanRows] = await Promise.all([
    selectAll<{ id: string; type: BalanceTxn['type']; amount_paise: number; txn_date: string; account_id: string | null; to_account_id: string | null }>(
      (from, to) =>
        admin
          .from('spend_transactions')
          .select('id,type,amount_paise,txn_date,account_id,to_account_id')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .gte('txn_date', since)
          .or(`account_id.in.(${ids}),to_account_id.in.(${ids})`)
          .order('txn_date', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
    ),
    selectAll<{ id: string; amount_paise: number; lent_on: string; debit_account_id: string | null }>(
      (from, to) =>
        admin
          .from('spend_lent_loans')
          .select('id,amount_paise,lent_on,debit_account_id')
          .eq('user_id', userId)
          .gte('lent_on', since)
          .in('debit_account_id', accountIds)
          .order('lent_on', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
    ),
  ]);
  return {
    txns: txnRows.map(r => ({
      type: r.type,
      amountPaise: r.amount_paise,
      txnDate: r.txn_date,
      accountId: r.account_id,
      toAccountId: r.to_account_id,
    })),
    loans: loanRows.map(l => ({ amountPaise: l.amount_paise, lentOn: l.lent_on, debitAccountId: l.debit_account_id })),
  };
}

/**
 * Loans with what has come back. A Got back credit links to its loan, so the outstanding amount
 * is derived from those credits and is never stored. Deleting the credit restores the amount.
 */
export async function loadLent(admin: SupabaseClient, userId: string) {
  const [loanRes, backRes] = await Promise.all([
    admin
      .from('spend_lent_loans')
      .select('id,person_name,amount_paise,lent_on,note,settled_at,created_at,debit_account_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    admin
      .from('spend_transactions')
      .select('lent_loan_id,amount_paise')
      .eq('user_id', userId)
      .eq('type', 'credit')
      .eq('credit_category', 'gone_back')
      .is('deleted_at', null)
      .not('lent_loan_id', 'is', null),
  ]);
  if (loanRes.error) throw loanRes.error;
  if (backRes.error) throw backRes.error;

  const returned = new Map<string, number>();
  for (const r of backRes.data ?? []) returned.set(r.lent_loan_id, (returned.get(r.lent_loan_id) ?? 0) + r.amount_paise);

  return {
    items: (loanRes.data ?? []).map(l => {
      const back = returned.get(l.id) ?? 0;
      return {
        ...l,
        returned_paise: back,
        outstanding_paise: l.settled_at ? 0 : Math.max(0, l.amount_paise - back),
      };
    }),
  };
}

export async function loadProfile(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin.from('spend_profiles').select('theme,lock_hash,default_account_id').eq('user_id', userId).single();
  if (error) throw error;
  return { theme: data.theme, lockEnabled: data.lock_hash !== null, defaultAccountId: data.default_account_id };
}

/**
 * A month with no budgets starts with the most recent earlier month's budgets. Runs only when the month
 * has no budget rows at all, so a plan the user cleared (saved as 0) is not copied back over.
 * The upsert ignores rows that already exist, so two loads at once cannot double the copy.
 */
async function carryBudgetsForward(admin: SupabaseClient, userId: string, firstDay: string): Promise<void> {
  const { count, error: countErr } = await admin
    .from('spend_budgets')
    .select('category_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('month', firstDay);
  if (countErr) throw countErr;
  if ((count ?? 0) > 0) return;

  const { data: latest, error: latestErr } = await admin
    .from('spend_budgets')
    .select('month')
    .eq('user_id', userId)
    .lt('month', firstDay)
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestErr) throw latestErr;
  if (!latest) return;

  const { data: rows, error: rowsErr } = await admin
    .from('spend_budgets')
    .select('category_id,planned_paise')
    .eq('user_id', userId)
    .eq('month', latest.month);
  if (rowsErr) throw rowsErr;
  if (!rows?.length) return;

  const { error } = await admin.from('spend_budgets').upsert(
    rows.map(r => ({ user_id: userId, category_id: r.category_id, month: firstDay, planned_paise: r.planned_paise })),
    { onConflict: 'user_id,category_id,month', ignoreDuplicates: true },
  );
  if (error) throw error;
}

type LedgerRow = {
  id: string;
  type: 'spend' | 'credit' | 'transfer';
  amount_paise: number;
  txn_date: string;
  category_id: string | null;
  account_id: string | null;
  to_account_id: string | null;
  external: boolean;
  credit_category: string | null;
  deleted_at: string | null;
};

/** One transaction row as the ledger reads it. Shared by Home and the closing-balance suggestion. */
function toLedgerTxn(r: LedgerRow, bucketOf: Map<string, Bucket>): Txn {
  return {
    id: r.id,
    type: r.type,
    amountPaise: r.amount_paise,
    txnDate: r.txn_date,
    categoryId: r.category_id ?? undefined,
    bucket: r.category_id ? bucketOf.get(r.category_id) : undefined,
    fromAccountId: r.account_id ?? undefined,
    toAccountId: r.to_account_id ?? undefined,
    external: r.external,
    creditKind: r.credit_category === 'gone_back' ? 'returned' : r.credit_category === 'borrowed' ? 'borrowed' : 'income',
    deletedAt: r.deleted_at,
  };
}

/**
 * Last month's closing balance as a suggested starting balance for this month: its balance by the same
 * rules as Home, offered only when last month had a starting balance and money is left (see suggestOpening).
 */
async function suggestedOpeningFor(
  admin: SupabaseClient,
  userId: string,
  month: string,
  bucketOf: Map<string, Bucket>,
): Promise<{ month: string; paise: number } | null> {
  const prev = shiftMonth(month, -1);
  const { start, end, firstDay } = monthRange(prev);
  const [openRes, txnRes, lentRes] = await Promise.all([
    admin.from('spend_month_settings').select('opening_paise').eq('user_id', userId).eq('month', firstDay).maybeSingle(),
    admin
      .from('spend_transactions')
      .select('id,type,amount_paise,txn_date,category_id,account_id,to_account_id,external,credit_category,deleted_at')
      .eq('user_id', userId)
      .gte('txn_date', start)
      .lt('txn_date', end)
      .is('deleted_at', null),
    admin.from('spend_lent_loans').select('amount_paise').eq('user_id', userId).gte('lent_on', start).lt('lent_on', end),
  ]);
  for (const r of [openRes, txnRes, lentRes]) if (r.error) throw r.error;

  const hadOpening = openRes.data?.opening_paise != null;
  const totals = monthTotals({
    month: prev,
    openingPaise: openRes.data?.opening_paise ?? 0,
    txns: (txnRes.data ?? []).map(r => toLedgerTxn(r as LedgerRow, bucketOf)),
    lentOutPaise: (lentRes.data ?? []).reduce((sum, l) => sum + l.amount_paise, 0),
  });
  const paise = suggestOpening({ hadOpening, closingPaise: totals.spendableBalancePaise });
  return paise === null ? null : { month: prev, paise };
}
