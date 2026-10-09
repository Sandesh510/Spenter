import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Default categories from the design spec. Real names, do not rename without updating docs.
 * 'CC Bills' is deliberately absent: paying a card bill is a transfer, not spend (docs/AUDIT.md T1).
 */
export const DEFAULT_CATEGORIES = [
  { name: 'Food Needs', bucket: 'need', icon: 'shopping-basket' },
  { name: 'Health/medical', bucket: 'need', icon: 'cross' },
  { name: 'Home', bucket: 'need', icon: 'zap' },
  { name: 'Transportation', bucket: 'need', icon: 'bus' },
  { name: 'EMI', bucket: 'need', icon: 'landmark' },
  { name: 'UPI Lite', bucket: 'need', icon: 'smartphone' },
  { name: 'Personal', bucket: 'want', icon: 'user' },
  { name: 'Party/Contro', bucket: 'want', icon: 'party-popper' },
  { name: 'Utilities', bucket: 'want', icon: 'tv' },
  { name: 'Trip/Travel', bucket: 'want', icon: 'plane' },
  { name: 'Other', bucket: 'want', icon: 'shapes' },
  { name: 'Clothes', bucket: 'want', icon: 'shirt' },
  { name: 'Food Wants', bucket: 'want', icon: 'utensils' },
  { name: 'Investment', bucket: 'save', icon: 'trending-up' },
  { name: 'Insurance', bucket: 'need', icon: 'shield' },
  { name: 'Rent', bucket: 'need', icon: 'house' },
  { name: 'Fuel', bucket: 'need', icon: 'fuel' },
  { name: 'Bills', bucket: 'need', icon: 'receipt' },
  { name: 'Education', bucket: 'need', icon: 'graduation-cap' },
  { name: 'Shopping', bucket: 'want', icon: 'shopping-cart' },
  { name: 'Entertainment', bucket: 'want', icon: 'film' },
  { name: 'Gifts', bucket: 'want', icon: 'gift' },
] as const;

/** Starter accounts from the design spec. Users rename or replace them in Settings. */
export const DEFAULT_ACCOUNTS = [
  { nickname: 'Salary', bank: 'HDFC Bank', kind: 'Debit', icon: 'wallet' },
  { nickname: 'Rewards', bank: 'ICICI', kind: 'Credit card', icon: 'credit-card' },
  { nickname: 'Cash', bank: 'Wallet', kind: 'Cash', icon: 'banknote' },
  { nickname: 'Paytm', bank: 'Paytm', kind: 'UPI wallet', icon: 'smartphone' },
] as const;

/** Users already seeded by this warm function instance. Seeding is idempotent, so a cold start just re-checks. */
const seeded = new Set<string>();

/** ensureSeeded, skipped when this instance has already done it for the user. */
export async function ensureSeededOnce(admin: SupabaseClient, userId: string): Promise<void> {
  if (seeded.has(userId)) return;
  await ensureSeeded(admin, userId);
  seeded.add(userId);
}

/**
 * Creates the user's SpendCheck profile, default categories and starter accounts on first use.
 * Idempotent: safe to call on every sign-in or request. Concurrent calls are harmless
 * because inserts use ON CONFLICT and the seeded_at marker is only set when still null.
 */
export async function ensureSeeded(admin: SupabaseClient, userId: string): Promise<void> {
  const { error: profileErr } = await admin
    .from('spend_profiles')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
  if (profileErr) throw profileErr;

  const { data: profile, error: readErr } = await admin
    .from('spend_profiles')
    .select('seeded_at')
    .eq('user_id', userId)
    .single();
  if (readErr) throw readErr;
  if (profile.seeded_at) return;

  // Starter accounts, so a new user can record a transaction straight away. They are editable and
  // only added when the user has none, so a user who deleted them is not given them back on every visit.
  const { count: accountCount, error: countErr } = await admin
    .from('spend_accounts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (countErr) throw countErr;
  if ((accountCount ?? 0) === 0) {
    const { error: accErr } = await admin
      .from('spend_accounts')
      .insert(DEFAULT_ACCOUNTS.map((a, position) => ({ ...a, user_id: userId, position })));
    if (accErr) throw accErr;
  }

  const rows = DEFAULT_CATEGORIES.map((c, sort_order) => ({ ...c, user_id: userId, sort_order }));
  const { error: catErr } = await admin
    .from('spend_categories')
    .upsert(rows, { onConflict: 'user_id,name', ignoreDuplicates: true });
  if (catErr) throw catErr;

  const { error: markErr } = await admin
    .from('spend_profiles')
    .update({ seeded_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('seeded_at', null);
  if (markErr) throw markErr;
}
