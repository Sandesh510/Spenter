/** Matches a Log search such as "swiggy 450". Every word must appear somewhere in the entry. */
export function matchesSearch(query: string, fields: { title: string; category: string; account: string; description: string | null; amountPaise: number }): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const rupees = fields.amountPaise / 100;
  const haystack = [fields.title, fields.category, fields.account, fields.description ?? '', String(rupees), rupees.toLocaleString('en-IN')].join(' ').toLowerCase();
  return words.every(w => haystack.includes(w.replace(/,/g, '')) || haystack.includes(w));
}
