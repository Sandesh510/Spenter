import type { Bucket } from './types';

/** Icon and colour per bucket, from the handoff's bucket tints. */
export const BUCKET_TINT: Record<Bucket, { bg: string; fg: string }> = {
  need: { bg: 'var(--color-need-bg)', fg: 'var(--color-need)' },
  want: { bg: 'var(--color-accent-tint)', fg: 'var(--color-accent-text)' },
  save: { bg: 'var(--color-success-bg)', fg: 'var(--color-success)' },
};

export const BUCKET_LABEL: Record<Bucket, string> = { need: 'Needs', want: 'Wants', save: 'Savings' };
export const BUCKET_TAG: Record<Bucket, string> = { need: 'Need', want: 'Want', save: 'Save' };

/** Lucide icon names used in the handoff, keyed by category name. */
export const CATEGORY_ICON: Record<string, string> = {
  'Food Wants': 'utensils',
  'Food Needs': 'shopping-basket',
  Transportation: 'bus',
  Clothes: 'shirt',
  Utilities: 'tv',
  Investment: 'trending-up',
  EMI: 'landmark',
  Home: 'zap',
  'Health/medical': 'cross',
  Personal: 'user',
  'Party/Contro': 'party-popper',
  'Trip/Travel': 'plane',
  Other: 'shapes',
  'UPI Lite': 'smartphone',
  'CC Bills': 'credit-card',
};

export function iconFor(name: string | null | undefined): string {
  return (name && CATEGORY_ICON[name]) || 'circle';
}
