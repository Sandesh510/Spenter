import { checkPurchase } from '../lib/verdict';
import { formatINR } from '../lib/money';
import { BUCKET_TAG } from '../lib/categories';
import type { Bucket } from '../lib/types';
import { Icon } from './Icon';

interface Props {
  amountPaise: number;
  category: { name: string; bucket: Bucket; plannedPaise: number | null; spentPaise: number };
  spendableBalancePaise: number;
}

/** The "should I buy this?" card. Copy follows the README's verdict rules. */
export function Verdict({ amountPaise, category, spendableBalancePaise }: Props) {
  const v = checkPurchase({
    amountPaise,
    bucket: category.bucket,
    planPaise: category.plannedPaise,
    spentPaise: category.spentPaise,
    spendableBalancePaise,
  });

  const plan = category.plannedPaise ?? 0;
  const remaining = v.remainingPaise ?? 0;

  let head: string;
  let colour: string;
  let icon: string;
  let title: string;
  let body: string;

  switch (v.status) {
    case 'fits':
      head = 'Looks fine';
      colour = 'var(--color-success)';
      icon = 'check';
      title = `${formatINR(remaining)} left in ${category.name}`;
      body = `This fits — you'd have ${formatINR(v.afterPaise ?? 0)} left of your ${formatINR(plan)} plan.`;
      break;
    case 'over_plan':
      head = 'Over plan';
      colour = 'var(--color-danger)';
      icon = 'alert-triangle';
      title = remaining > 0 ? `Only ${formatINR(remaining)} left in ${category.name}` : `${category.name} already over plan`;
      body = `This puts you ${formatINR(v.overByPaise)} over your ${formatINR(plan)} monthly plan.`;
      break;
    case 'no_budget':
      head = 'No budget';
      colour = 'var(--color-text-secondary)';
      icon = 'info';
      title = `No budget set for ${category.name}`;
      body = 'Set a monthly plan for this category in Settings to check purchases against it.';
      break;
    default:
      head = 'Savings';
      colour = 'var(--color-need)';
      icon = 'info';
      title = `Goes to ${category.name}`;
      body = 'Savings count toward your goal, not against a spending plan.';
  }

  const spentShare = plan > 0 ? Math.min(1, category.spentPaise / plan) : 0;
  const overShare = v.status === 'over_plan' && plan > 0 ? Math.min(1 - spentShare, v.overByPaise / plan) : 0;

  return (
    <div className="pop" style={{ border: `1px solid ${colour}`, borderRadius: 16, padding: '15px 16px', background: 'transparent' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--color-surface-muted)', color: colour, display: 'grid', placeItems: 'center' }}>
          <Icon name={icon} size={15} />
        </span>
        <span style={{ fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: colour }}>{head}</span>
        <span style={{ marginLeft: 'auto', padding: '3px 9px', borderRadius: 6, background: 'var(--color-accent-tint)', color: 'var(--color-accent-text)', fontSize: 11 }}>
          {category.name} · {BUCKET_TAG[category.bucket]}
        </span>
      </div>
      <div className="heading" style={{ fontSize: 19, lineHeight: 1.2, margin: '11px 0 3px' }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{body}</div>

      {v.status === 'over_plan' && plan > 0 && (
        <>
          <div className="track" style={{ height: 8, marginTop: 12, display: 'flex' }}>
            <div style={{ height: '100%', width: `${spentShare * 100}%`, background: 'var(--color-accent)' }} />
            <div style={{ height: '100%', width: `${overShare * 100}%`, background: 'var(--color-danger)' }} />
          </div>
          <div className="num" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, fontSize: 11, color: 'var(--color-text-secondary)' }}>
            <span>{formatINR(category.spentPaise)} spent</span>
            <span style={{ color: 'var(--color-danger)' }}>+{formatINR(v.overByPaise)} over</span>
          </div>
        </>
      )}

      {v.cannotAfford && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--color-danger)' }}>
          This is more than your balance left to spend ({formatINR(spendableBalancePaise)}).
        </div>
      )}
    </div>
  );
}
