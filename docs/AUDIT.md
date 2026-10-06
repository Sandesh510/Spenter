# SpendCheck — Spend-checker audit (domain rules, not prototype numbers)

The prototype's figures (₹92,400 start, hard-coded `spent`, August dates) are illustrative only. This audit covers the rules a real "should I buy this?" spend checker must get right.

## Decisions (confirmed)

| Question | Decision |
|---|---|
| Starting balance | Entered **per month** (opening balance for that month). |
| Credits and transfers | **Change the balance.** |
| Savings | Counts against the balance and is **shown as its own balance figure**. |
| 4-digit lock | **Kept** as a second layer on top of Supabase Auth. |

## Balance model

- `opening(month)` — user-entered per month.
- `income` — credit rows (money in).
- `spend` — spend rows in categories with bucket Need or Want.
- `savings` — spend rows in the Savings bucket (Investment).
- `transfer` — moves money between accounts. Per-account balances change; the total is unchanged unless the destination is outside the tracked accounts (see Q1 below).

**Balance (spendable)** = opening + income − spend − savings. Savings is shown as a separate balance line (`Savings to date`), so the user sees both.

Rules:
1. Totals are always derived from transactions, never stored separately (the prototype's stored `spent` map is wrong).
2. Money is integer **paise**. Input is decimal rupees, converted once at the edge.
3. Balance may go negative; the UI must show it, not clamp it.
4. Transactions are dated in `Asia/Kolkata`; a month is the calendar month of `txn_date`.

## Verdict ("should I buy this?") — real rules

Inputs: amount `A`, category `C`, month `M`.

1. **Category budget**: `remaining_C = plan_C(M) − spent_C(M)`.
   - Plan exists and `A ≤ remaining_C` → **fits**.
   - Plan exists and `A > remaining_C` → **over plan** by `A − max(remaining_C, 0)`.
   - **No plan set (0 or missing)** → not "over by the full amount". Show **"no budget set for C"** and skip the category check.
2. **Balance check** (added — the prototype does not do this): if `A > spendable balance(M)` → **cannot afford** regardless of category budget.
3. Savings category: the verdict asks whether it *reduces* the savings goal, not whether it's over budget.
4. Verdict is advisory only; the user decides. It does not block saving.

## Real-world traps the prototype misses

| # | Trap | Rule for the real app |
|---|---|---|
| T1 | **Credit-card double counting.** `CC Bills` is listed as a Want. If a card purchase is logged as spend *and* the card bill is paid from the bank as spend, the money is counted twice. | Card purchases are spend. Paying the card bill is a **transfer** to the card account, not spend. `CC Bills` must not be a spend category; it's a transfer target. *(Needs your confirmation — see Q2.)* |
| T2 | **Refunds.** A refund is money back into a category; the prototype's credit doesn't reduce category `spent`. | A refund is a `credit` with a category; it reduces that category's spent for the month. |
| T3 | **Lending money** (Money Lent). Cash you lend leaves your balance until repaid. The spec says "no effect on balance". | Keep lent loans out of spend and out of categories (per spec), but flag: if you want the balance to reflect cash in hand, lending must be a transfer to a "Receivables" pot. *(Needs confirmation — see Q3.)* |
| T4 | **Backdating into a closed month.** Editing an old month silently changes its budget verdicts. | Allowed, but the month totals recompute; show a notice when an edit touches a closed month. |
| T5 | **Edits and deletes.** Hard deletes lose history. | Soft-delete (`deleted_at`) on transactions; totals exclude deleted rows. |
| T6 | **Duplicates.** Same amount, category, date, account entered twice. | Warn on save when an identical row exists the same day; do not block. |
| T7 | **Decimal amounts.** `parseInt` drops paise and the 9-digit cap is arbitrary. | Accept up to 2 decimals; cap at ₹1,00,00,000 (1 crore) per entry. |
| T8 | **Delayed asks.** A "delayed" decision must not create a transaction. | Only "bought" writes a transaction; "skipped" and "delayed" are stored as asks only. |
| T9 | **Verdict vs. actual.** Verdict reads from the same aggregates as Home so numbers never disagree. | One aggregate function used by Home, Log, Trends and verdict. |
| T10 | **Currency format.** Indian grouping (1,00,000) must apply to all figures, including negatives. | Single `formatINR` helper, unit-tested. |

## Open questions — implemented with defaults, still to confirm

- **Q1.** External transfer (e.g. paying a friend's UPI) reduces the balance. Implemented as `transfer` with `external = true`.
- **Q2.** Card bill payment is a transfer; `CC Bills` is not seeded as a spend category. Implemented in the seed trigger.
- **Q3.** Lent money stays out of the balance, per the README. Implemented: no lent table is read by `ledger.ts`.

## Schema implications

- `transactions.amount_paise bigint`, `txn_date date`, `deleted_at timestamptz`, `type ∈ spend|credit|transfer`, `category_id` required for spend/credit, `from_account_id`, `to_account_id`.
- `month_settings (user_id, month date, opening_paise bigint)` — per-month opening balance.
- `budgets (user_id, category_id, month date, planned_paise bigint)` — per-month plan.
- `asks (user_id, item, amount_paise, category_id, decision ∈ bought|skipped|delayed)`.
- `lent_loans` as in README.
