import { describe, expect, it } from 'vitest';
import { netWorth } from './netWorth';

const acc = (id: string, kind: string, balance: number | null) => ({ id, nickname: id, kind, balance_paise: balance });

describe('netWorth', () => {
  it('adds accounts, savings and money lent, and takes off cards and loans', () => {
    const r = netWorth({
      accounts: [acc('bank', 'bank', 6_000_000), acc('wallet', 'wallet', 50_000), acc('card', 'credit_card', -1_500_000)],
      plans: [{ id: 'p', name: 'Emergency', saved_paise: 9_500_000, active: true }],
      loans: [{ id: 'l', name: 'Home loan', outstandingPaise: 45_000_000 }],
      lentOutstandingPaise: 300_000,
    });
    expect(r.assets.totalPaise).toBe(6_000_000 + 50_000 + 9_500_000 + 300_000);
    expect(r.liabilities.totalPaise).toBe(1_500_000 + 45_000_000);
    expect(r.netPaise).toBe(15_850_000 - 46_500_000);
  });

  it('a negative balance on a card is a card due, on any other account it is overdrawn', () => {
    const r = netWorth({ accounts: [acc('cc', 'Credit card', -100), acc('b', 'bank', -50)], plans: [], loans: [], lentOutstandingPaise: 0 });
    expect(r.liabilities.cards.map(l => l.paise)).toEqual([100]);
    expect(r.liabilities.overdrawn.map(l => l.paise)).toEqual([50]);
    expect(r.netPaise).toBe(-150);
  });

  it('lists accounts with no balance apart, and ignores paused plans and paid-off loans', () => {
    const r = netWorth({
      accounts: [acc('cash', 'wallet', null), acc('b', 'bank', 0)],
      plans: [{ id: 'p', name: 'Old', saved_paise: 500, active: false }],
      loans: [{ id: 'l', name: 'Done', outstandingPaise: 0 }],
      lentOutstandingPaise: -5,
    });
    expect(r.untrackedAccounts).toEqual(['cash']);
    expect(r.netPaise).toBe(0);
  });
});
