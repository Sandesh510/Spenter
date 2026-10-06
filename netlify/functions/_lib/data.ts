import type { SupabaseClient } from '@supabase/supabase-js';
import { monthTotals, type Bucket, type Txn } from '../../../src/lib/ledger';
import { monthRange } from './month';
import { postDue } from './commitments';
import { postInsurance } from './insurance';
import { todayIST } from './input';

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
  await postDue(admin, userId, todayIST());
  await postInsurance(admin, userId, todayIST());

  const [catRes, openRes, budgetRes, txnRes, askRes] = await Promise.all([
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
  ]);
  for (const r of [catRes, openRes, budgetRes, txnRes, askRes]) if (r.error) throw r.error;

  const categories = (catRes.data as CategoryRow[]) ?? [];
  const bucketOf = new Map(categories.map(c => [c.id, c.bucket]));
  const openingPaise = openRes.data?.opening_paise ?? 0;
  const rows = txnRes.data ?? [];

  const txns: Txn[] = rows.map(r => ({
    id: r.id,
    type: r.type,
    amountPaise: r.amount_paise,
    txnDate: r.txn_date,
    categoryId: r.category_id ?? undefined,
    bucket: r.category_id ? bucketOf.get(r.category_id) : undefined,
    fromAccountId: r.account_id ?? undefined,
    toAccountId: r.to_account_id ?? undefined,
    external: r.external,
    deletedAt: r.deleted_at,
  }));

  const totals = monthTotals({ month, openingPaise, txns });

  // Money in and out for the month. The money-in total is the balance's income; money out is what
  // leaves the balance: spend, savings and transfers to outside accounts.
  const moneyIn = { totalPaise: totals.incomePaise, salaryPaise: 0, goneBackPaise: 0, othersPaise: 0 };
  let outsidePaise = 0;
  for (const r of rows) {
    if (r.type === 'credit') {
      if (r.credit_category === 'salary') moneyIn.salaryPaise += r.amount_paise;
      else if (r.credit_category === 'gone_back') moneyIn.goneBackPaise += r.amount_paise;
      else moneyIn.othersPaise += r.amount_paise;
    } else if (r.type === 'transfer' && r.external) {
      outsidePaise += r.amount_paise;
    }
  }
  const moneyOut = {
    totalPaise: totals.spendPaise + totals.savingsPaise + outsidePaise,
    spendPaise: totals.spendPaise,
    savingsPaise: totals.savingsPaise,
    outsidePaise,
  };

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

export async function loadAccounts(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from('spend_accounts')
    .select('id,nickname,bank,kind,icon,position')
    .eq('user_id', userId)
    .order('position', { ascending: true });
  if (error) throw error;
  return { items: data ?? [] };
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
  const { data, error } = await admin.from('spend_profiles').select('theme,lock_hash').eq('user_id', userId).single();
  if (error) throw error;
  return { theme: data.theme, lockEnabled: data.lock_hash !== null };
}
