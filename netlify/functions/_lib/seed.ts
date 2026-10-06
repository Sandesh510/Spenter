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
] as const;

/**
 * Creates the user's SpendCheck profile and default categories on first use.
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

  const rows = DEFAULT_CATEGORIES.map(c => ({ ...c, user_id: userId }));
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
