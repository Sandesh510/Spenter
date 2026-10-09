/** Recent spending, to make adding the next entry quicker. Entries are expected newest first. */

export interface RecentSource {
  type: 'spend' | 'credit' | 'transfer';
  category_id: string | null;
  account_id: string | null;
  amount_paise: number;
  description: string | null;
}

export interface Repeatable {
  categoryId: string;
  accountId: string | null;
  amountPaise: number;
  description: string;
}

/** Category ids of the latest spends, each once, newest first. */
export function recentCategories(txns: RecentSource[], limit = 5): string[] {
  const out: string[] = [];
  for (const t of txns) {
    if (t.type !== 'spend' || !t.category_id || out.includes(t.category_id)) continue;
    out.push(t.category_id);
    if (out.length >= limit) break;
  }
  return out;
}

/** The latest distinct spends (same category, amount and note count once), to repeat in one tap. */
export function repeatables(txns: RecentSource[], limit = 3): Repeatable[] {
  const seen = new Set<string>();
  const out: Repeatable[] = [];
  for (const t of txns) {
    if (t.type !== 'spend' || !t.category_id) continue;
    const description = t.description ?? '';
    const key = `${t.category_id}|${t.amount_paise}|${description}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ categoryId: t.category_id, accountId: t.account_id, amountPaise: t.amount_paise, description });
    if (out.length >= limit) break;
  }
  return out;
}
