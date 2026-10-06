# SpendCheck: code and personal-finance audit (7 Oct 2026)

Reviewed: ledger (`src/lib/ledger.ts`), commitments and insurance posting (`netlify/functions/_lib/commitments.ts`, `_lib/insurance.ts`), transactions, lent, categories, accounts, budgets, profile/passcode, and the Home, Manual, Quick Add, Lent, Commitments and Settings screens.

The basics are right: money is stored as integer paise, totals are worked out from transactions rather than stored, every query is scoped to the signed-in user, tables have RLS, and recurring postings can't run twice for the same month. The problems are in the money rules, which can show a wrong balance, and in two posting bugs that will appear over time.

## P0: wrong numbers or wrong postings

| # | Finding | What goes wrong | Change required |
|---|---|---|---|
| 1 | **Got back counts as income, but lending never reduced the balance.** `monthTotals` adds every credit to income. Lent money is kept out of the ledger. | Lend ₹10,000 and the balance stays the same. When it comes back, the balance rises by ₹10,000. "Money in" and "Balance left to spend" are overstated by everything repaid. | Pick one model. **Recommended:** lending is an outflow from the debit account, now that it's linked, and Got back is an inflow. Neither is income. Count both in the balance, and show them in Trends as "Lent out" and "Got back", not under income. |
| 2 | **A new loan's money counts as income.** It's recorded as a credit under Others. | Taking a ₹2 L loan shows ₹2 L "money in" that month, which inflates income and makes the savings rate look better than it is. | Keep it in the balance, since the cash is real, but mark it as borrowed and leave it out of income totals and Trends income. |
| 3 | **Commitments stop posting after 24 months.** `dueMonths` caps at 24 months counted from the start date, not from today. | A SIP started Jan 2026 posts through Dec 2027, then never again. Nothing warns you. | Add `last_posted_month` to `spend_commitments` and post only months after it, capped from today. |
| 4 | **Resuming a paused commitment or auto-debit backfills the paused months.** Resume only sets `active = true`. Posting runs from `starts_on` (commitments) or the old `next_due_on` (insurance). | Pause Netflix Jan–Mar, resume in April: three phantom ₹649 debits appear. Same for a paused auto-debit policy. | On resume, move `starts_on` (or `next_due_on`) to the next due date from today. |
| 5 | **Insurance is filed under the wrong category.** No "Insurance" category is seeded, so the form falls back to the first category, "Food Needs". | Premiums inflate food spending and the Needs budget unless the user notices and changes the category. | Seed the larger default list (Insurance, Rent, Fuel, Medical, Bills, Education, …) for new and existing users. Require the category to be chosen when none is named Insurance. |
| 6 | **Deleting a category used by an insurance policy fails with a server error.** Policies reference categories with `on delete restrict`, and the delete flow only checks transactions and commitments. | The delete returns a 500 error instead of offering to move the policy. | Include `spend_insurance_policies` in the in-use count and in the reassignment. |

## P1: gaps a careful money manager will hit

| # | Finding | Why it matters | Change required |
|---|---|---|---|
| 7 | **Budgets don't carry forward.** Budgets are stored per month, with no copy step. | On the 1st of every month all plans are blank. Home shows "no plan set" and the Ask verdicts lose their plan check. | When a month has no budgets, copy last month's on first load, and offer "Same as last month". |
| 8 | **"Balance left to spend" ignores commitments still due this month.** | On the 3rd, a ₹15,000 EMI due on the 10th isn't reserved, so Ask says "fits" when it doesn't. | Show **Safe to spend** = balance − active commitments and premiums still due this month. Use it in verdicts. |
| 9 | **No per-account balance, so nothing can be reconciled.** | You can't check SpendCheck against your bank or card statement, which is the main way errors get caught. | Add an opening balance per account, show a derived balance per account, and add a "Reconcile" action that records the difference as an adjustment. |
| 10 | **Credit-card handling is easy to double-count.** Card spend correctly counts when you buy. But the bill payment must be a transfer to the card account, and nothing guides the user. | Recording the bill as a spend counts the same money twice. | In Manual, when the destination is a Credit card account, label it "Card bill payment" (an internal transfer). Show the card's outstanding: spends on the card − payments. |
| 11 | **Got back can exceed the loan.** The overpay check is only in the browser. | A stale screen or a second device can record more than is owed. | Check the outstanding amount on the server in `transactions.ts`. |
| 12 | **Deleting a posted EMI doesn't restore the loan's outstanding.** | Remove a wrong EMI and the loan still shows that principal as repaid. | Work out outstanding and tenure from the posted EMIs, the way Lent derives what's still owed, instead of updating them in place. |
| 13 | **Opening balance is entered by hand each month.** | Easy to forget or mistype, which breaks month-to-month continuity. | Suggest last month's closing balance as the default, which the user can override or decline. |
| 14 | **No export or backup.** | Your financial history is held in one shared Supabase project with no way out. | CSV export of transactions, filtered by month or range, from Settings. |

## P2: robustness and hygiene

| # | Finding | Change |
|---|---|---|
| 15 | Every Home load posts sequentially: one upsert per commitment per month since its start date (up to 24 each), plus insurance. Load time grows as commitments are added. | Fixing #3 (`last_posted_month`) also fixes this. Batch the upserts. |
| 16 | Deleting an account used by a commitment or policy says "has transactions". | Say what's using it. |
| 17 | Passcode is a salted SHA-256 of 4 digits. It's fine as a convenience lock behind Supabase Auth, but trivial to brute-force if the hash leaks. | Use scrypt (already in Node) and keep the server lockout. |
| 18 | The `/?mock` dev data has no insurance or category edits, so new screens can't be checked offline. | Add fixtures. |
| 19 | Category reorder does one update per category. | Use a single RPC or `upsert` of `{id, sort_order}`. |

## Still pending from the feature list

- Default account (item 1): not built.
- Larger default category list (item 2): not built. See #5.
- Comma-separated parser `date,account type,amount` (item 3): not built.
- Savings plans and emergency fund (item 4): not built. Recommended after #1, #8 and #9, because the emergency-fund target depends on accurate monthly spend.

## Recommended order

1. **P0 #1–#6:** fixes to the money rules and posting. Needs one migration: `last_posted_month`, plus the category seed backfill.
2. **#7 budget carry-forward and #8 safe-to-spend:** biggest everyday improvement.
3. **#9–#10 account balances and credit cards:** makes reconciliation possible.
4. Remaining features: default account, parser, savings plans.
5. P2 items as you go.
