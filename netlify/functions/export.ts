import { authed } from './_lib/handler';
import { monthRange } from './_lib/month';
import { selectAll } from './_lib/paged';
import { HttpError, json } from './_lib/response';
import { monthSpan } from '../../src/lib/dates';
import { MAX_EXPORT_MONTHS } from '../../src/lib/limits';
import type { ExportRow } from '../../src/lib/csv';
import type { Bucket } from '../../src/lib/types';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * GET /export?from=YYYY-MM&to=YYYY-MM → live transactions in those months (inclusive), oldest first,
 * with category, budget and account names filled in. Up to 24 months. The browser turns them into CSV.
 */
export const handler = authed(['GET'], async ({ admin, userId, event }) => {
  const from = event.queryStringParameters?.from ?? '';
  const to = event.queryStringParameters?.to ?? '';
  if (!MONTH.test(from) || !MONTH.test(to)) throw new HttpError(400, 'from and to must be YYYY-MM');
  const span = monthSpan(from, to);
  if (span < 1) throw new HttpError(400, 'The From month must not be after the To month');
  if (span > MAX_EXPORT_MONTHS) throw new HttpError(400, `Export up to ${MAX_EXPORT_MONTHS} months at a time`);

  const start = monthRange(from).start;
  const end = monthRange(to).end;

  const [txns, catRes, accRes] = await Promise.all([
    selectAll<{
      id: string;
      type: ExportRow['type'];
      amount_paise: number;
      txn_date: string;
      description: string | null;
      category_id: string | null;
      account_id: string | null;
      to_account_id: string | null;
      external: boolean;
      credit_category: ExportRow['creditCategory'];
      reference: string | null;
    }>((a, b) =>
      admin
        .from('spend_transactions')
        .select('id,type,amount_paise,txn_date,description,category_id,account_id,to_account_id,external,credit_category,reference')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .gte('txn_date', start)
        .lt('txn_date', end)
        .order('txn_date', { ascending: true })
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(a, b),
    ),
    admin.from('spend_categories').select('id,name,bucket').eq('user_id', userId),
    admin.from('spend_accounts').select('id,nickname').eq('user_id', userId),
  ]);
  if (catRes.error) throw catRes.error;
  if (accRes.error) throw accRes.error;

  const cats = new Map(((catRes.data ?? []) as { id: string; name: string; bucket: Bucket }[]).map(c => [c.id, c]));
  const accounts = new Map(((accRes.data ?? []) as { id: string; nickname: string }[]).map(a => [a.id, a.nickname]));

  const items: ExportRow[] = txns.map(r => {
    const cat = r.category_id ? cats.get(r.category_id) : undefined;
    return {
      date: r.txn_date,
      type: r.type,
      amountPaise: r.amount_paise,
      external: r.external,
      categoryName: cat?.name ?? null,
      bucket: cat?.bucket ?? null,
      accountName: r.account_id ? accounts.get(r.account_id) ?? null : null,
      toAccountName: r.to_account_id ? accounts.get(r.to_account_id) ?? null : null,
      description: r.description,
      reference: r.reference,
      creditCategory: r.credit_category,
    };
  });

  return json(200, { from, to, items });
});
