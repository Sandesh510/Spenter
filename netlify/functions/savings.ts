import type { SupabaseClient } from '@supabase/supabase-js';
import { parseRupeesToPaise } from '../../src/lib/money';
import {
  DEFAULT_EMERGENCY_MONTHS, MAX_EMERGENCY_MONTHS, MIN_EMERGENCY_MONTHS, PLAN_KINDS,
  averageMonthlySpend, averageWindowStart, emergencySuggestion, parsePlanAmount, type PlanKind,
} from '../../src/lib/savings';
import { authed } from './_lib/handler';
import { assertOwned, dateOrToday, optStr, readJson, reqId, reqStr, todayIST } from './_lib/input';
import { monthRange } from './_lib/month';
import { HttpError, json } from './_lib/response';

const PLAN_COLUMNS =
  'id,name,kind,target_paise,emergency_months,opening_paise,monthly_contribution_paise,target_date,account_id,category_id,priority,active,created_at';
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PAGE = 1000;

interface PlanRow {
  id: string;
  name: string;
  kind: PlanKind;
  target_paise: number;
  emergency_months: number | null;
  opening_paise: number;
  monthly_contribution_paise: number | null;
  target_date: string | null;
  account_id: string;
  category_id: string;
  priority: number;
  active: boolean;
  created_at: string;
}

/**
 * GET    /savings                    → { items: plans with saved_paise, averageMonthlySpendPaise, emergencySuggestionPaise }
 * POST   /savings { kind, name, target?, months?, opening?, monthly?, targetDate?, accountId, categoryId }
 *                                     → create; an emergency fund without a target gets months × average spend
 * PATCH  /savings { id, ...fields }   → edit (name, target, months, opening, monthly, targetDate, accountId, categoryId, active)
 * PATCH  /savings { id, move: 'up' | 'down' }                        → change priority
 * PATCH  /savings { id, action: 'contribute', amount, date?, accountId? } → record a contribution as a spend
 * DELETE /savings?id=…               → remove; past contributions stay in the Log as ordinary savings
 * Saved = opening_paise + live spend transactions linked by plan_id. It is never stored.
 */
export const handler = authed(['GET', 'POST', 'PATCH', 'DELETE'], async ({ admin, userId, event }) => {
  const today = todayIST();

  if (event.httpMethod === 'GET') {
    const [plansRes, contributions, averageMonthlySpendPaise] = await Promise.all([
      admin.from('spend_savings_plans').select(PLAN_COLUMNS).eq('user_id', userId)
        .order('priority', { ascending: true }).order('created_at', { ascending: true }),
      fetchAll<{ plan_id: string; amount_paise: number }>((from, to) =>
        admin.from('spend_transactions').select('plan_id,amount_paise')
          .eq('user_id', userId).eq('type', 'spend').is('deleted_at', null).not('plan_id', 'is', null)
          .order('id', { ascending: true }).range(from, to)),
      loadAverageMonthlySpend(admin, userId, today),
    ]);
    if (plansRes.error) throw plansRes.error;
    const plans = (plansRes.data ?? []) as PlanRow[];

    const contributed = new Map<string, number>();
    for (const c of contributions) contributed.set(c.plan_id, (contributed.get(c.plan_id) ?? 0) + c.amount_paise);
    const emergency = plans.find(p => p.kind === 'emergency');

    return json(200, {
      items: plans.map(p => ({ ...p, saved_paise: p.opening_paise + (contributed.get(p.id) ?? 0) })),
      averageMonthlySpendPaise,
      emergencySuggestionPaise: emergencySuggestion(averageMonthlySpendPaise, emergency?.emergency_months ?? DEFAULT_EMERGENCY_MONTHS),
    });
  }

  if (event.httpMethod === 'DELETE') {
    const id = reqId({ id: event.queryStringParameters?.id ?? '' }, 'id');
    // Contributions keep their entries; the foreign key clears their plan_id.
    const { error, count } = await admin.from('spend_savings_plans').delete({ count: 'exact' }).eq('id', id).eq('user_id', userId);
    if (error) throw error;
    if (!count) throw new HttpError(404, 'Plan not found');
    return json(200, { ok: true });
  }

  const b = readJson(event.body);

  if (event.httpMethod === 'PATCH') {
    const id = reqId(b, 'id');

    if (b.move !== undefined) {
      if (b.move !== 'up' && b.move !== 'down') throw new HttpError(400, 'Invalid move');
      const { data: all, error: listErr } = await admin
        .from('spend_savings_plans')
        .select('id')
        .eq('user_id', userId)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true });
      if (listErr) throw listErr;
      // Rewrite every priority, so gaps and duplicates are cleared.
      const ids = (all ?? []).map(p => p.id as string);
      const i = ids.indexOf(id);
      if (i < 0) throw new HttpError(404, 'Plan not found');
      const j = b.move === 'up' ? i - 1 : i + 1;
      if (j >= 0 && j < ids.length) [ids[i], ids[j]] = [ids[j], ids[i]];
      for (const [position, planId] of ids.entries()) {
        const { error } = await admin.from('spend_savings_plans').update({ priority: position }).eq('id', planId).eq('user_id', userId);
        if (error) throw error;
      }
      return json(200, { ok: true });
    }

    const plan = await loadPlan(admin, userId, id);

    if (b.action === 'contribute') {
      const amount = rupees(reqStr(b, 'amount', 20));
      const date = dateOrToday(optStr(b, 'date', 10));
      if (date > today) throw new HttpError(400, "The date can't be in the future");
      const accountId = optStr(b, 'accountId', 60) === null ? plan.account_id : reqId(b, 'accountId');
      await assertOwned(admin, userId, 'spend_accounts', [accountId]);
      await assertSaveCategory(admin, userId, plan.category_id, "This plan's category is no longer a Savings category. Edit the plan first.");
      const { error } = await admin.from('spend_transactions').insert({
        user_id: userId,
        type: 'spend',
        amount_paise: amount,
        txn_date: date,
        description: `Savings: ${plan.name}`,
        category_id: plan.category_id,
        account_id: accountId,
        plan_id: plan.id,
      });
      if (error) throw error;
      return json(201, { ok: true });
    }

    // Edit: only the fields sent are changed.
    const patch: Record<string, unknown> = {};
    if ('name' in b) patch.name = reqStr(b, 'name', 60);
    if ('months' in b) {
      if (plan.kind !== 'emergency') throw new HttpError(400, 'Only an emergency fund has months');
      patch.emergency_months = months(b.months);
    }
    if ('target' in b && optStr(b, 'target', 20) !== null) {
      patch.target_paise = amountField(b, 'target', false);
    } else if (patch.emergency_months !== undefined) {
      patch.target_paise = await suggestedTarget(admin, userId, today, patch.emergency_months as number);
    }
    if ('opening' in b) patch.opening_paise = amountField(b, 'opening', true) ?? 0;
    if ('monthly' in b) patch.monthly_contribution_paise = amountField(b, 'monthly', true);
    if ('targetDate' in b) patch.target_date = dateField(b);
    if ('accountId' in b) {
      const accountId = reqId(b, 'accountId');
      await assertOwned(admin, userId, 'spend_accounts', [accountId]);
      patch.account_id = accountId;
    }
    if ('categoryId' in b) {
      const categoryId = reqId(b, 'categoryId');
      await assertSaveCategory(admin, userId, categoryId);
      patch.category_id = categoryId;
    }
    if ('active' in b) {
      if (typeof b.active !== 'boolean') throw new HttpError(400, 'active must be true or false');
      patch.active = b.active;
    }
    if (Object.keys(patch).length === 0) throw new HttpError(400, 'Nothing to update');
    patch.updated_at = new Date().toISOString();
    const { error } = await admin.from('spend_savings_plans').update(patch).eq('id', id).eq('user_id', userId);
    if (error) throw error;
    return json(200, { ok: true });
  }

  // POST: create a plan
  const kind = reqStr(b, 'kind', 10) as PlanKind;
  if (!PLAN_KINDS.includes(kind)) throw new HttpError(400, 'Choose Goal or Emergency fund');
  const name = reqStr(b, 'name', 60);
  const emergencyMonths = kind === 'emergency' ? (b.months === undefined || b.months === null || b.months === '' ? DEFAULT_EMERGENCY_MONTHS : months(b.months)) : null;
  let target = amountField(b, 'target', false);
  if (target === null) {
    if (kind !== 'emergency') throw new HttpError(400, 'Enter a target amount');
    target = await suggestedTarget(admin, userId, today, emergencyMonths ?? DEFAULT_EMERGENCY_MONTHS);
  }
  const accountId = reqId(b, 'accountId');
  const categoryId = reqId(b, 'categoryId');
  await assertOwned(admin, userId, 'spend_accounts', [accountId]);
  await assertSaveCategory(admin, userId, categoryId);

  const { count, error: countErr } = await admin
    .from('spend_savings_plans')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (countErr) throw countErr;

  const { data, error } = await admin
    .from('spend_savings_plans')
    .insert({
      user_id: userId,
      name,
      kind,
      target_paise: target,
      emergency_months: emergencyMonths,
      opening_paise: amountField(b, 'opening', true) ?? 0,
      monthly_contribution_paise: amountField(b, 'monthly', true),
      target_date: dateField(b),
      account_id: accountId,
      category_id: categoryId,
      priority: count ?? 0,
    })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') throw new HttpError(409, 'You already have an emergency fund');
    throw error;
  }
  return json(201, { id: data.id });
});

async function loadPlan(admin: SupabaseClient, userId: string, id: string): Promise<PlanRow> {
  const { data, error } = await admin.from('spend_savings_plans').select(PLAN_COLUMNS).eq('id', id).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'Plan not found');
  return data as PlanRow;
}

/** The category must belong to this user and sit in the Save bucket, so contributions count as savings. */
async function assertSaveCategory(admin: SupabaseClient, userId: string, categoryId: string, message = 'Choose a Savings category'): Promise<void> {
  const { data, error } = await admin.from('spend_categories').select('bucket').eq('id', categoryId).eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(400, 'Unknown category or account');
  if (data.bucket !== 'save') throw new HttpError(400, message);
}

/**
 * Average monthly Needs + Wants spend over the last complete months that have any (see src/lib/savings.ts),
 * read from live spend transactions in Need and Want categories. Months are IST calendar months.
 */
async function loadAverageMonthlySpend(admin: SupabaseClient, userId: string, today: string): Promise<number> {
  const month = today.slice(0, 7);
  const { data: cats, error } = await admin.from('spend_categories').select('id').eq('user_id', userId).in('bucket', ['need', 'want']);
  if (error) throw error;
  const ids = (cats ?? []).map(c => c.id as string);
  if (ids.length === 0) return 0;
  const rows = await fetchAll<{ txn_date: string; amount_paise: number }>((from, to) =>
    admin.from('spend_transactions').select('txn_date,amount_paise')
      .eq('user_id', userId).eq('type', 'spend').is('deleted_at', null).in('category_id', ids)
      .gte('txn_date', averageWindowStart(month)).lt('txn_date', monthRange(month).end)
      .order('id', { ascending: true }).range(from, to));
  const byMonth: Record<string, number> = {};
  for (const r of rows) {
    const m = r.txn_date.slice(0, 7);
    byMonth[m] = (byMonth[m] ?? 0) + r.amount_paise;
  }
  return averageMonthlySpend(byMonth, month);
}

async function suggestedTarget(admin: SupabaseClient, userId: string, today: string, months: number): Promise<number> {
  const target = emergencySuggestion(await loadAverageMonthlySpend(admin, userId, today), months);
  if (target <= 0) throw new HttpError(400, 'There is no spending yet to suggest a target. Enter a target amount.');
  return target;
}

/** Reads every page of a query; Supabase returns at most 1000 rows per request. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

function rupees(raw: string): number {
  try {
    return parseRupeesToPaise(raw);
  } catch (err) {
    throw new HttpError(400, err instanceof Error ? err.message : 'Invalid amount');
  }
}

/** Optional plan amount; null when absent or blank. */
function amountField(b: Record<string, unknown>, key: string, allowZero: boolean): number | null {
  const raw = typeof b[key] === 'number' ? String(b[key]) : optStr(b, key, 20);
  if (raw === null) return null;
  try {
    return parsePlanAmount(raw, { allowZero });
  } catch (err) {
    throw new HttpError(400, err instanceof Error ? err.message : 'Invalid amount');
  }
}

function months(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN;
  if (!Number.isInteger(n) || n < MIN_EMERGENCY_MONTHS || n > MAX_EMERGENCY_MONTHS) {
    throw new HttpError(400, `Months must be a whole number from ${MIN_EMERGENCY_MONTHS} to ${MAX_EMERGENCY_MONTHS}`);
  }
  return n;
}

/** Optional target date; null clears it. */
function dateField(b: Record<string, unknown>): string | null {
  const raw = optStr(b, 'targetDate', 10);
  if (raw === null) return null;
  if (!DATE.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) throw new HttpError(400, 'Invalid target date');
  return raw;
}
