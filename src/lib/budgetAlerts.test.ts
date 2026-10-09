import { describe, expect, it } from 'vitest';
import { alertAfterSpend, budgetAlerts, type AlertCategory } from './budgetAlerts';

const cat = (id: string, spent: number, planned: number | null, bucket: AlertCategory['bucket'] = 'want'): AlertCategory => ({ id, name: id, bucket, plannedPaise: planned, spentPaise: spent });

describe('budgetAlerts', () => {
  it('warns from 80% and marks over after the plan, worst first', () => {
    const r = budgetAlerts([cat('a', 79_00, 100_00), cat('b', 80_00, 100_00), cat('c', 100_00, 100_00), cat('d', 130_00, 100_00), cat('e', 150_00, 100_00)]);
    expect(r.map(x => [x.categoryId, x.level])).toEqual([['e', 'over'], ['d', 'over'], ['c', 'warn'], ['b', 'warn']]);
    expect(r[0]).toMatchObject({ pct: 150, overPaise: 50_00 });
  });

  it('ignores savings, categories without a plan and a plan of zero', () => {
    expect(budgetAlerts([cat('s', 500_00, 100_00, 'save'), cat('n', 500_00, null), cat('z', 500_00, 0)])).toEqual([]);
  });
});

describe('alertAfterSpend', () => {
  it('speaks only when the entry moves the category to a worse level', () => {
    const c = cat('a', 70_00, 100_00);
    expect(alertAfterSpend(c, 5_00)).toBeNull(); // 75%: still fine
    expect(alertAfterSpend(c, 10_00)).toMatchObject({ level: 'warn', pct: 80 });
    expect(alertAfterSpend(c, 40_00)).toMatchObject({ level: 'over', overPaise: 10_00 });
  });

  it('does not repeat a level already reached', () => {
    expect(alertAfterSpend(cat('a', 85_00, 100_00), 5_00)).toBeNull();
    expect(alertAfterSpend(cat('a', 110_00, 100_00), 5_00)).toBeNull();
    expect(alertAfterSpend(cat('a', 85_00, 100_00), 20_00)).toMatchObject({ level: 'over' });
  });

  it('is silent for savings and unplanned categories', () => {
    expect(alertAfterSpend(cat('s', 0, 100_00, 'save'), 500_00)).toBeNull();
    expect(alertAfterSpend(cat('n', 0, null), 500_00)).toBeNull();
  });
});
