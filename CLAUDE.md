# SpendCheck: working rules

Mobile-first personal spend tracker. Vite + React + TypeScript frontend, Supabase Postgres/Auth, Netlify Functions backend. The Supabase project is shared with another app, so every table is `spend_`-prefixed.

## UI rules (from the UX audit, `docs/ux-audit/`)

Apply these to every new or changed screen.

**Colour**
- Components use `--color-*` tokens only. Never write a hex or `rgba()` value outside `src/styles/tokens.css`.
- Status uses the semantic families: `success`, `warning`, `danger`, `info`, `reminder`, each with a `-bg` tint. Do not use a colour to mean a status it wasn't defined for.
- Accent is the palette blue `--color-accent`. Accent text uses `--color-accent-text` so it stays readable on light backgrounds.
- Every screen must work in both themes. Check light and dark before calling a screen done.

**Shared primitives first**
- Surfaces: `Card` (variants `compact`, `flush`, `group`; `as="section"` or `as="button"`).
- Buttons: `Button` (`primary`, `secondary`, `ghost`, `danger`; sizes `sm`, `md`, `lg`; `block`).
- Forms: `Field` (visible label, error text) wrapping `Input` (`numeric`, `boxed`). Placeholders are never the only label.
- Status: `Badge` with tone `success`, `info` or `neutral`.
- Do not add a new raw `btn`, `card` or `input` class in a screen. Use the primitive.

**Inline styles**
- Do not add `style={{ }}` for layout, spacing, colour or type. Use a utility class (`flex`, `gap-8`, `mt-16`, `fs-14`, `c-sec`) or a named class in `src/styles/components.css`.
- Inline styles are allowed only for values that depend on runtime data (for example a progress width).
- Font sizes come from the scale only: 11, 12, 13, 14, 15, 18, 22, 24, 26, 34, 44.
- Fonts: `--font-heading` (Playfair Display) for headings, `--font-body` (Inter) for text, and `--font-numeric` (Inter, tabular lining figures) for every amount via the `num` class, including large `heading num` balances. Do not set a font family anywhere else.
- Radii come from `--radius-*` or the card/button values in `components.css`.

**Semantics**
- One `h1` per screen (the topbar title). Sections use `h2`, items use `h3`.
- Lists are `ul`/`li`. Label/value pairs are `dl`/`dt`/`dd`.
- Choose-one controls are `aria-pressed` toggles. Tabs use `role="tablist"` with `role="tab"` and `aria-selected`.
- Icon-only buttons have an `aria-label`.
- Groups of chips are `fieldset` with a `legend`.

**Layout**
- The screen is a single phone-width column. No horizontal scrolling.
- Back buttons use `topbar topbar--inset` with `topbar__spacer` to balance the back button.

## Money and data rules

- Money is integer paise everywhere in the database and API. Convert at the edge with `parseRupeesToPaise` and `formatINR`.
- Totals are derived from transactions, never stored (`src/lib/ledger.ts` is the source of truth).
- A savings plan's saved amount is derived: `opening_paise` + live spend transactions with its `plan_id` (rules in `src/lib/savings.ts`). Contributions are spends in a Save-bucket category.
- Per-account balances are derived too: opening balance (`spend_accounts.opening_balance_paise` at the start of `opening_balance_on`; negative for card dues) plus live entries and loans since that date (`src/lib/accountBalance.ts`). Never store a running balance.
- Every Netlify Function scopes queries by the verified `user_id`. The service-role key stays server-side.
- Sessions: the device keeps the access and refresh tokens (`src/lib/session.ts`). `api()` renews the access token before it expires and retries a 401 once after a refresh; only a rejected refresh token signs the user out. Never call Netlify Functions with a raw stored token.
- New tables get RLS with the owner policy, in a numbered migration under `supabase/migrations/`.
- Limits shared by client and server live in `src/lib/limits.ts` (for example `MAX_ACCOUNTS = 10`).
- Balance = opening + income + got back + borrowed − spend − savings − outside transfers − money lent. Only Salary and Others are income; `gone_back` and `borrowed` credits never count as income.
- Recurring postings (commitments, insurance auto-debit) are idempotent through unique keys: `(commitment_id, commitment_month)` and `(policy_id, policy_due_on)`. Resuming moves the start or due date forward, so paused periods are never backfilled.
- Commitments post only months after `last_posted_month`; never cap posting by a count from the start date.
- A month with no budget rows copies the latest earlier month's budgets on first Home load (`carryBudgetsForward`). A budget cleared to 0 is a row, so it is not copied back.
- Safe to spend (`src/lib/safeToSpend.ts`) = balance − commitments due after today this month − unrecorded premiums due by month end. Verdicts check against it.
- The user-facing version of these rules is `src/screens/Rules.tsx` (Settings → Rules to remember). Update it whenever a money rule changes.

## Commands

- `npx tsc --noEmit -p tsconfig.json` before every commit.
- `npx vitest run` for the rules in `src/lib/`.
- `npx vite build` before every push.
- Dev-only mock data: `npm run dev`, then open `/?mock`.

## Git

- Remote: `https://github.com/Sandesh510/Spenter.git`, branch `main`.
- Commit and push after each completed round. Do not commit `netlify/` changes that were not part of the round.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
