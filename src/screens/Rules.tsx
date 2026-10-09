import { Card } from '../components/ui/Card';
import { Icon } from '../components/Icon';
import { MAX_ACCOUNTS, MAX_EXPORT_MONTHS } from '../lib/limits';
import type { Route } from '../App';

interface RuleGroup {
  title: string;
  icon: string;
  rules: string[];
}

/** How SpendCheck counts money. Keep in step with src/lib/ledger.ts and the posting rules on the server. */
const GROUPS: RuleGroup[] = [
  {
    title: 'Balance left to spend',
    icon: 'indian-rupee',
    rules: [
      'Home hides the balance, the starting balance and the credit card amounts whenever the app opens. Tap the eye to show them. Spent and Safe to spend are always shown.',
      'Balance = starting balance + money in − spend − savings − transfers outside your accounts − money lent.',
      'Totals are always worked out from your entries. Edit or delete an entry and every total updates.',
      'Each month starts fresh. Set a starting balance once a month, or choose "none". Nothing carries over by itself.',
      "When last month had a starting balance and money was left, you are offered that closing balance as the new starting balance. You can use it, type another amount, or choose none.",
      'Safe to spend = balance left to spend − subscriptions, SIPs, EMIs and insurance premiums still due this month. "Should I buy this?" checks against it.',
    ],
  },
  {
    title: 'Money in',
    icon: 'arrow-down-left',
    rules: [
      'Salary and Others are income.',
      'Got back is money you lent coming back. It returns to your balance but is not income.',
      'Borrowed is a loan you received. It adds to your balance but is not income. You repay it through EMIs.',
    ],
  },
  {
    title: 'Money lent',
    icon: 'banknote',
    rules: [
      'Lending takes the money out of your balance in the month you lend it. It is not spend and does not touch any budget.',
      'Record repayments as Got back, linked to the loan. The amount still owed is the loan less what has come back.',
      'When money comes back you choose the account it came into, and it is added to that account. A loan lent from a credit card is owed on the card until you pay the bill; the money returned lands where you received it.',
      "A loan's amount can't be set below what has already come back.",
    ],
  },
  {
    title: 'Spend, savings and budgets',
    icon: 'receipt-text',
    rules: [
      'Every spend needs a category. Its bucket (Needs, Wants or Savings) decides which budget it counts against.',
      'Savings (such as SIPs) leave your balance but count towards your savings goal, not your spending.',
      "Budgets are set per month and category. A new month starts with the previous month's budgets; a change applies from that month on.",
      'Home lists the 5 categories with the most spending (over-budget ones first). Tap Show all to see the rest.',
      'A bar is marked tight above 90% of plan and turns red when over.',
      'Deleting a category that has entries asks you to move them to another category first.',
    ],
  },
  {
    title: 'Transfers and credit cards',
    icon: 'arrow-left-right',
    rules: [
      'Home shows the credit card bill in a small row; open it for more. In your accounts = balance left to spend + card bill still to pay. Left after the card bill is the balance itself, because card use is already taken out of it.',
      'Trends has a Spend by account chart: what you spent from each account this month (spend and savings entries). Money lent and transfers are not spending, but they still change the account balance.',
      'Trends has a Credit card section under Money in and out: the total spent on cards this month (spend and savings entries only; money lent from a card is on the bill but is not counted as spending) and a bar chart of the 5 categories it went to.',
      'Card bill still to pay = what went on cards this month (spend, savings, money lent) less bill payments made this month. It is never below zero.',
      'A transfer between your own accounts does not change your balance.',
      'A transfer to someone outside your accounts counts as money out.',
      'Card purchases count as spend on the day you buy, against their category.',
      'Paying the card bill is a transfer from your bank account to the card account, never a spend. Recording it as spend counts the money twice.',
    ],
  },
  {
    title: 'Account balances',
    icon: 'landmark',
    rules: [
      'Account balance = opening balance + money in − spend − transfers out + transfers in − money lent from it, counting entries on or after the opening date.',
      'The opening balance is what the account held at the start of its "As on" day, before that day\'s entries. It is optional; without it no balance is shown.',
      'For a credit card, enter what you owe. Purchases add to it, a bill payment brings it down, and Settings shows it as Owed.',
      'Match my bank sets the balance to what your bank shows now. It moves the opening date to today, so today\'s entries still count once.',
      'Balances are worked out from your entries every time, never stored. Editing an old entry changes the balance.',
    ],
  },
  {
    title: 'Commitments',
    icon: 'repeat',
    rules: [
      'Subscriptions, SIPs and EMIs post automatically on their day, once a month, when you open the app.',
      'A month is never posted twice, even if the app is open on two devices.',
      'Pausing stops posting. Resuming starts again from the next due date. Paused months are skipped, not added later.',
      'Deleting a posted EMI gives its principal and one instalment back to the loan. The month is not posted again.',
      'An existing loan only tracks EMIs. A new loan also records the amount received as Borrowed.',
    ],
  },
  {
    title: 'Insurance',
    icon: 'shield',
    rules: [
      'Premiums due within 7 days, and overdue ones, show on Home.',
      'Auto-debit policies post the premium on the due date. "Remind me" policies need Mark paid.',
      'A premium is recorded once per due date. A manual payment and an auto-debit can never both count.',
      "Premiums go to the Insurance category unless you choose another one. Changing a policy's category also moves its past premiums.",
      'A premium due on the 29th, 30th or 31st moves to the last day of shorter months and goes back to its day afterwards.',
    ],
  },
  {
    title: 'Savings plans',
    icon: 'piggy-bank',
    rules: [
      'A contribution is a spend in a Savings category. It leaves your balance and counts toward your Savings budget.',
      'Saved = already saved (before you started tracking) + contributions. It is always worked out from your entries.',
      'Emergency fund target = months × your average monthly Needs + Wants spend, over the last 3 complete months that had spending. You can change it.',
      'You can have one emergency fund and any number of goals.',
      'Removing a plan keeps its past contributions in the Log as savings.',
    ],
  },
  {
    title: 'Entries and accounts',
    icon: 'wallet',
    rules: [
      'Amounts are rupees with up to 2 decimals and must be more than zero.',
      "A credit card can have a limit (Settings, Accounts). The card shows what is owed and how much credit is left.",
      'Every new entry starts with your default account (Settings, Entries). You can change it on each entry.',
      'Quick Add always uses today and goes straight to the Log when saved. Use Manual entry for back-dated entries.',
      'Add many entries has two ways. Pick dates: tap days on a calendar and fill in the account, amount and category; the entries are saved together. Paste a list: lines of date, account, amount (and an optional description), each saved only when you tap Save; a possible duplicate is flagged but not blocked.',
      'After saving in Manual entry, you can add another entry for the same date and account.',
      `You can have up to ${MAX_ACCOUNTS} accounts. An account with entries can't be deleted.`,
      `Export transactions (CSV) in Settings saves up to ${MAX_EXPORT_MONTHS} months of entries. Amounts are positive; the Direction column says In, Out or Transfer.`,
    ],
  },
];

export function Rules({ go }: { go: (r: Route) => void }) {
  return (
    <div className="scroll">
      <div className="topbar topbar--inset">
        <button className="iconbtn" onClick={() => go('settings')} aria-label="Back to Settings"><Icon name="chevron-left" size={18} /></button>
        <h1 className="topbar__title">Rules to remember</h1>
        <span className="topbar__spacer" aria-hidden="true" />
      </div>
      <p className="fs-13 c-sec mt-8">How SpendCheck counts your money.</p>
      <ul className="grid gap-10 list-reset mt-12">
        {GROUPS.map(g => (
          <li key={g.title}>
            <Card as="section" variant="compact" aria-label={g.title}>
              <h2 className="fs-15 m-0 flex ai-c gap-8 fw-600">
                <span className="c-accent"><Icon name={g.icon} size={16} /></span>
                {g.title}
              </h2>
              <ul className="rules-list mt-8 fs-13 c-sec">
                {g.rules.map(r => <li key={r}>{r}</li>)}
              </ul>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
