import type { SupabaseClient } from '@supabase/supabase-js';
import { dueDate, dueMonths, emiSplit, reverseEmiSplit } from '../../../src/lib/commitments';
import { shiftMonth } from '../../../src/lib/dates';

export interface CommitmentRow {
  id: string;
  kind: 'subscription' | 'investment' | 'loan';
  name: string;
  amount_paise: number;
  day_of_month: number;
  category_id: string;
  account_id: string;
  active: boolean;
  starts_on: string;
  loan_is_new: boolean | null;
  outstanding_paise: number | null;
  rate_bps: number | null;
  tenure_remaining: number | null;
  /** First day of the last month posted (or found already posted). Null before the first posting. */
  last_posted_month: string | null;
}

export const COMMITMENT_COLUMNS =
  'id,kind,name,amount_paise,day_of_month,category_id,account_id,active,starts_on,loan_is_new,outstanding_paise,rate_bps,tenure_remaining,last_posted_month';

/**
 * Posts every due month for the user's active commitments, oldest first. Runs on each Home load.
 * A month is posted once: the insert is an upsert on (commitment, month) that ignores duplicates,
 * and only a request that actually inserts a row goes on to update a loan's balance.
 */
export async function postDue(admin: SupabaseClient, userId: string, today: string): Promise<void> {
  const { data, error } = await admin
    .from('spend_commitments')
    .select(COMMITMENT_COLUMNS)
    .eq('user_id', userId)
    .eq('active', true);
  if (error) throw error;

  for (const c of (data ?? []) as CommitmentRow[]) {
    await postCommitment(admin, userId, c, today);
  }
}

async function postCommitment(admin: SupabaseClient, userId: string, c: CommitmentRow, today: string): Promise<void> {
  const isLoan = c.kind === 'loan';
  let outstanding = c.outstanding_paise ?? 0;
  let tenure = c.tenure_remaining ?? 0;

  // Only months after the last one posted. The unique key still guards against a second posting.
  const afterLast = c.last_posted_month ? `${shiftMonth(c.last_posted_month.slice(0, 7), 1)}-01` : null;
  const from = afterLast && afterLast > c.starts_on ? afterLast : c.starts_on;
  let lastMonth: string | null = null;

  for (const month of dueMonths({ startsOn: from, day: c.day_of_month, today })) {
    if (isLoan && (outstanding <= 0 || tenure <= 0)) break;
    lastMonth = month;

    const { data, error } = await admin
      .from('spend_transactions')
      .upsert(
        {
          user_id: userId,
          type: 'spend',
          amount_paise: c.amount_paise,
          txn_date: dueDate(month, c.day_of_month),
          description: c.name,
          category_id: c.category_id,
          account_id: c.account_id,
          commitment_id: c.id,
          commitment_month: `${month}-01`,
        },
        { onConflict: 'commitment_id,commitment_month', ignoreDuplicates: true },
      )
      .select('id');
    if (error) throw error;
    if (!data?.length) continue; // already posted by an earlier request

    if (isLoan) {
      const { principalPaise } = emiSplit({ outstandingPaise: outstanding, rateBps: c.rate_bps ?? 0, emiPaise: c.amount_paise });
      // Keep the principal on the entry, so deleting it later gives exactly this back. A database without
      // migration 0012 has no such column: the loan still updates, and a later delete is estimated.
      const { error: pErr } = await admin.from('spend_transactions').update({ principal_paise: principalPaise }).eq('id', data[0].id).eq('user_id', userId);
      if (pErr && !/principal_paise/.test(pErr.message ?? '')) throw pErr;
      outstanding -= principalPaise;
      tenure -= 1;
      const { error: updErr } = await admin
        .from('spend_commitments')
        .update({
          outstanding_paise: outstanding,
          tenure_remaining: tenure,
          active: outstanding > 0 && tenure > 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', c.id)
        .eq('user_id', userId);
      if (updErr) throw updErr;
    }
  }

  if (lastMonth) {
    const { error: markErr } = await admin
      .from('spend_commitments')
      .update({ last_posted_month: `${lastMonth}-01` })
      .eq('id', c.id)
      .eq('user_id', userId);
    if (markErr) throw markErr;
  }
}

/**
 * A loan EMI entry was deleted: give its principal and one instalment back to the loan, so the outstanding
 * amount and the remaining instalments match the entries that are left. Does nothing for other entries.
 * The entry itself stays as a deleted row, so the same month is not posted again.
 */
export async function restoreLoanAfterEmiDelete(
  admin: SupabaseClient,
  userId: string,
  txn: { commitment_id: string | null; amount_paise: number; principal_paise?: number | null },
): Promise<void> {
  if (!txn.commitment_id) return;
  const { data: c, error } = await admin
    .from('spend_commitments')
    .select('kind,outstanding_paise,tenure_remaining,rate_bps,active')
    .eq('id', txn.commitment_id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!c || c.kind !== 'loan') return;

  const outstanding = c.outstanding_paise ?? 0;
  const tenure = c.tenure_remaining ?? 0;
  const principal =
    txn.principal_paise ?? reverseEmiSplit({ outstandingAfterPaise: outstanding, rateBps: c.rate_bps ?? 0, emiPaise: txn.amount_paise });
  const wasFinished = outstanding <= 0 || tenure <= 0;
  const { error: updErr } = await admin
    .from('spend_commitments')
    .update({
      outstanding_paise: outstanding + principal,
      tenure_remaining: tenure + 1,
      // A loan that ended on its own comes back to life; one the user paused stays paused.
      ...(wasFinished ? { active: true } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', txn.commitment_id)
    .eq('user_id', userId);
  if (updErr) throw updErr;
}
