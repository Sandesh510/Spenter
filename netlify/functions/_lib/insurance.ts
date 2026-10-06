import type { SupabaseClient } from '@supabase/supabase-js';
import { advanceDue, type Frequency } from '../../../src/lib/insurance';

export interface PolicyRow {
  id: string;
  name: string;
  premium_paise: number;
  frequency: Frequency;
  next_due_on: string;
  account_id: string;
  category_id: string;
  auto_debit: boolean;
  active: boolean;
}

export const POLICY_COLUMNS =
  'id,name,premium_paise,frequency,next_due_on,account_id,category_id,auto_debit,active';

/** Largest number of catch-up premiums posted in one run. Stops a bad date from looping forever. */
const MAX_CATCH_UP = 60;

/**
 * Posts each auto-debit premium that has fallen due, then moves the policy's due date on.
 * Each due date is one transaction: the insert ignores a duplicate, so a premium that was already
 * recorded (by Mark paid or an earlier run) is not posted again, and the due date still moves on.
 */
export async function postInsurance(admin: SupabaseClient, userId: string, today: string): Promise<void> {
  const { data, error } = await admin
    .from('spend_insurance_policies')
    .select(POLICY_COLUMNS)
    .eq('user_id', userId)
    .eq('active', true)
    .eq('auto_debit', true)
    .lte('next_due_on', today);
  if (error) throw error;

  for (const p of (data ?? []) as PolicyRow[]) {
    let due = p.next_due_on;
    for (let i = 0; due <= today && i < MAX_CATCH_UP; i++) {
      const { error: insErr } = await admin
        .from('spend_transactions')
        .upsert(
          {
            user_id: userId,
            type: 'spend',
            amount_paise: p.premium_paise,
            txn_date: due,
            description: p.name,
            category_id: p.category_id,
            account_id: p.account_id,
            policy_id: p.id,
            policy_due_on: due,
          },
          { onConflict: 'policy_id,policy_due_on', ignoreDuplicates: true },
        );
      if (insErr) throw insErr;
      due = advanceDue(due, p.frequency);
    }
    if (due !== p.next_due_on) {
      const { error: updErr } = await admin
        .from('spend_insurance_policies')
        .update({ next_due_on: due, updated_at: new Date().toISOString() })
        .eq('id', p.id)
        .eq('user_id', userId);
      if (updErr) throw updErr;
    }
  }
}
