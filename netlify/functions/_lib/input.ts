import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from './response';

/** Parses a JSON object body. Missing or invalid JSON is a 400. */
export function readJson(raw: string | null | undefined): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw || '{}');
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'Body must be a JSON object');
  }
}

/** Required non-empty string, trimmed, max length. */
export function reqStr(b: Record<string, unknown>, key: string, max = 120): string {
  const v = b[key];
  if (typeof v !== 'string' || v.trim() === '') throw new HttpError(400, `Missing field: ${key}`);
  if (v.trim().length > max) throw new HttpError(400, `${key} is too long`);
  return v.trim();
}

/** Optional string: returns null when absent or blank. */
export function optStr(b: Record<string, unknown>, key: string, max = 120): string | null {
  const v = b[key];
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') throw new HttpError(400, `${key} must be text`);
  const t = v.trim();
  if (t.length > max) throw new HttpError(400, `${key} is too long`);
  return t === '' ? null : t;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function reqId(b: Record<string, unknown>, key: string): string {
  const v = reqStr(b, key, 60);
  if (!UUID.test(v)) throw new HttpError(400, `${key} is not valid`);
  return v;
}

/**
 * Confirms every id belongs to this user. Foreign keys do not check ownership,
 * and the service key bypasses RLS, so this check has to be explicit.
 */
export async function assertOwned(
  admin: SupabaseClient,
  userId: string,
  table: 'spend_categories' | 'spend_accounts',
  ids: string[],
): Promise<void> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  const { data, error } = await admin.from(table).select('id').eq('user_id', userId).in('id', unique);
  if (error) throw error;
  if ((data?.length ?? 0) !== unique.length) throw new HttpError(400, 'Unknown category or account');
}

/** Returns YYYY-MM-DD for "today" in Asia/Kolkata. */
export function todayIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Validates an optional YYYY-MM-DD date, defaulting to today in IST. */
export function dateOrToday(value: string | null): string {
  if (value === null) return todayIST();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new HttpError(400, 'date must be YYYY-MM-DD');
  }
  return value;
}
