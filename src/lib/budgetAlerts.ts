/**
 * Budget alerts: categories close to, or past, their plan for the month.
 * A category warns from 80% of its plan and is over once spending passes the plan. Savings categories
 * are left out, since spending more than planned on savings is a goal met, not a problem.
 */

export const WARN_AT_PCT = 80;

export type AlertLevel = 'warn' | 'over';

export interface AlertCategory {
  id: string;
  name: string;
  bucket: 'need' | 'want' | 'save';
  plannedPaise: number | null;
  spentPaise: number;
}

export interface BudgetAlert {
  categoryId: string;
  name: string;
  level: AlertLevel;
  /** Spent as a share of the plan, in whole percent. */
  pct: number;
  plannedPaise: number;
  spentPaise: number;
  /** How far past the plan, zero unless over. */
  overPaise: number;
}

function levelOf(spent: number, planned: number): AlertLevel | null {
  if (spent > planned) return 'over';
  return (spent / planned) * 100 >= WARN_AT_PCT ? 'warn' : null;
}

/** Categories to warn about now, worst first (most over, then the highest share). */
export function budgetAlerts(categories: AlertCategory[]): BudgetAlert[] {
  const out: BudgetAlert[] = [];
  for (const c of categories) {
    if (c.bucket === 'save' || !c.plannedPaise || c.plannedPaise <= 0) continue;
    const level = levelOf(c.spentPaise, c.plannedPaise);
    if (!level) continue;
    out.push({
      categoryId: c.id,
      name: c.name,
      level,
      pct: Math.round((c.spentPaise / c.plannedPaise) * 100),
      plannedPaise: c.plannedPaise,
      spentPaise: c.spentPaise,
      overPaise: Math.max(0, c.spentPaise - c.plannedPaise),
    });
  }
  return out.sort((a, b) => Number(b.level === 'over') - Number(a.level === 'over') || b.overPaise - a.overPaise || b.pct - a.pct);
}

/**
 * The alert an entry causes: set only when adding `addPaise` takes the category to a worse level than
 * it was at (below 80% to warn or over, or warn to over). Nothing is said for an entry that changes nothing.
 */
export function alertAfterSpend(category: AlertCategory, addPaise: number): BudgetAlert | null {
  if (category.bucket === 'save' || !category.plannedPaise || category.plannedPaise <= 0) return null;
  const before = levelOf(category.spentPaise, category.plannedPaise);
  const after = levelOf(category.spentPaise + addPaise, category.plannedPaise);
  if (!after || after === before) return null;
  return budgetAlerts([{ ...category, spentPaise: category.spentPaise + addPaise }])[0] ?? null;
}
