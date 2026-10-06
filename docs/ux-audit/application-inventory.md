# Application inventory

Phase 0 discovery. Read-only: nothing in `src/` was changed for this audit.
Baseline commit: `0104256` (working tree restored to it after an unapproved colour-rename attempt).

## Routes and screens

| Route | Screen file | Shown in bottom nav | Purpose |
|---|---|---|---|
| `home` | `src/screens/Home.tsx` | Home | Balance left, lent total, budget bars, recent asks |
| `log` | `src/screens/Log.tsx` | Log | Transaction list; tap a row to delete (with confirm) |
| `trends` | `src/screens/Trends.tsx` | Trends | 50/30/20 donut, plan vs actual, patterns |
| `settings` | `src/screens/Settings.tsx` | Settings | Budgets, starting balance, accounts, lock, appearance |
| `ask` | `src/screens/Ask.tsx` | No | Purchase check (verdict) |
| `quickadd` | `src/screens/QuickAdd.tsx` | Centre "+" button | 4-step keypad flow, 2 s auto-advance |
| `manual` | `src/screens/Manual.tsx` | No (from Quick Add) | Manual entry: type chips, pickers, date |
| `lent` | `src/screens/Lent.tsx` | No (from Home) | Money lent: outstanding, settled, bottom sheet form |
| Lock | `src/screens/Lock.tsx` | No | 4-digit passcode gate |

Shared shell: `src/App.tsx` (routing, `Frame`, idle lock), `src/components/BottomNav.tsx`, `src/components/Verdict.tsx`, `src/components/Keypad.tsx`, `src/components/Icon.tsx`.

## Logic modules (`src/lib/`)

- `money.ts`, `ledger.ts`, `verdict.ts`: pure, unit-tested (17 tests).
- `api.ts`, `cache.ts`, `useApi.ts`: data access and client cache.
- `prefs.ts`, `haptics.ts`, `dates.ts`, `categories.ts`, `types.ts`, `supabase.ts`.

## Backend (`netlify/functions/`)

Endpoints: `bootstrap`, `home`, `transactions`, `accounts`, `budgets`, `asks`, `profile`, `lent`, `month-opening`, `auth-login`, `auth-signup`, `me`, `health`. Shared helpers in `_lib/` (handler, auth, data, input, month, response, seed).

## Database (`supabase/migrations/`)

- `0001_init.sql`: all `spend_*` tables with RLS owner policies.
- `0002_passcode_lockout.sql`: `pin_failures`, `pin_locked_until` on `spend_profiles`.

## Styling

- `src/styles/tokens.css` (174 lines), `src/styles/app.css`. Details in `current-design-system.md`.

## Scope notes

- The shared Supabase project is used by another app; every table is `spend_`-prefixed.
- Dev-only mock layer (`src/dev/mockApi.ts`, `?mock`) is excluded from production builds. It is not user-facing and is out of audit scope.
- The "Color Reference (standalone).html" named in the runbook was not found in the workspace, so the colour values in this audit are taken from the current tokens, not from that reference.
