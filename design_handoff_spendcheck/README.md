# Handoff: SpendCheck — mobile spend journal & "should I buy this?" checker

## Overview
SpendCheck is a mobile-first, one-handed personal finance app for logging spends and running a fast "should I buy this?" budget check mid-purchase. Target stack (per product owner): **React + Supabase + Netlify**. Primary usage is on a phone, often while standing in a shop or ordering online, so the whole UI is built around the thumb zone: bottom navigation, large tap targets, a keypad-first entry flow, and an add flow completable in under ~10 seconds.

Currency is **INR (₹)**, single user, dark-mode-first with a light theme. Six screens: Home / Dashboard, Add (a stepped Quick Add + a Manual Entry form), Transactions Log, Monthly Trends/Summary, Settings, and a Passcode lock.

## About the Design Files
The files in this bundle are **design references authored in HTML** (a Design-Component prototype). They are prototypes showing intended look and behavior — **not production code to copy directly**. The task is to **recreate these designs in the target codebase** (React + Supabase + Netlify) using that project's established patterns, component library, and conventions. Business logic shown in the prototype (budget math, verdict rules, the auto-advance timer) is illustrative — reimplement it idiomatically in React with Supabase as the data layer.

The prototype uses inline styles and CSS custom properties (design tokens) rather than a class system; the token values are all listed below under **Design Tokens** so you don't need the prototype runtime to build the real thing.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, layout, and interactions are all specified. Recreate the UI to match, mapping the tokens below onto the project's styling approach (CSS variables, Tailwind config, styled-components theme — whatever the codebase uses). The one thing intentionally *not* final is the visual design system's fonts if the codebase already standardizes on something else — see Typography.

---

## Screens / Views

The app renders inside a single phone viewport. A persistent **bottom navigation bar** is shown on the four top-level screens (Home, Log, Trends, Settings). The Add flow, Ask verdict, Manual entry, and Lock screens are full-screen overlays that **hide** the bottom nav.

### Bottom Navigation (persistent)
- Fixed to the bottom, height **82px**, top hairline border (`--line`), background is a top-fading gradient from `--bg` (so list content scrolls under it).
- Five slots, evenly spaced (`justify-content: space-around`), each a column (icon over 10px label), width 54px.
- Order: **Home** (`home` icon) · **Log** (`receipt-text`) · **Add** (center, raised FAB) · **Trends** (`bar-chart-3`) · **Settings** (`settings`).
- **Center Add FAB**: a 58×58 circle, `background: --amber`, icon color `#231a0c`, `plus` icon at 26px, raised up with `margin-top:-20px`, soft amber glow `box-shadow: 0 10px 22px -6px color-mix(in srgb, var(--amber) 70%, transparent)`. Label "Add" in `--amber`. Tapping it opens the Quick Add flow.
- Active slot uses `--amber` for icon+label; inactive uses `--faint`.
- Icons are **Lucide** (https://lucide.dev) throughout the app.

---

### 1. Home / Dashboard
**Purpose:** At-a-glance view of the month — how much is left to spend, how the three top-level buckets are tracking, and recent asks.

**Layout:** Vertical scroll, page padding `8px 20px` with `108px` bottom padding to clear the nav. Sections top to bottom:
1. **Header row** (`space-between`): left = kicker "THIS MONTH" (11px, uppercase, letter-spacing .14em, `--amber`) over "August 2026" (heading font, 23px, semibold); right = 42px circular avatar button (1px `--line` border, `user` icon) → opens Settings.
2. **Balance card**: bordered (1px `--line`), radius 18px, padding `20px 20px 17px`, `background: --surface`.
   - Row: label "Balance left to spend" (12.5px `--muted`) + `info` icon (`--faint`).
   - Big figure: heading font, **47px**, semibold, tabular numerals — value = `start − totalSpent`, e.g. **₹20,400**.
   - Thin progress track (7px, radius 6, `--surface2`) with an `--amber` fill at `spent/start` width.
   - Footer row (`space-between`, 12.5px `--muted`, tabular): "Started ₹92,400" · "Spent ₹72,000" (the numeric values in `--text`).
3. **Budgets** section: kicker row "BUDGETS" (11px uppercase `--muted`) + right meta "day 21 / 31". Then three stacked bars (gap 19px), one per bucket — **Needs / Wants / Savings**. Each bar:
   - Row: bucket name (14px `--text`) + `spent / planned` (12px, spent in `--text`, planned in `--muted`, tabular).
   - Track: 9px tall, radius 6, `--surface2`, with a color fill at `spent/planned` width (capped 100%).
   - Sub-row (11px): left = "N% of plan" (or "of goal" for Savings); right = a colored note.
   - **Color rules** (spend buckets Needs/Wants): green `--green` when ≤90% of plan, amber `--amber` when 90–100%, red `--red` when over. Note reads "₹X left" (green/amber) or "₹X over" (red). **Savings** bucket: `--need` (blue-grey) until goal met, then `--green`; note reads "₹X to go" / "goal met".
4. **Recent asks**: kicker row "RECENT ASKS" + "See all →" (`--amber`) linking to Log. List of rows (each: 35px circular verdict icon, item name + "Decision · Category" subtitle, amount on the right).
   - Verdict icon/colors: Bought = `check` on green tint; Skipped = `x` on red tint; Delayed = `clock` on amber tint (tints listed in tokens).

**Sample data shown:** Start balance ₹92,400; planned totals Needs ₹42,000 / Wants ₹26,500 / Savings ₹20,000 (sums of category plans below). Recent asks: "Zomato dinner ₹640 Skipped · Food Wants", "Monthly bus pass ₹1,100 Bought · Transportation", "Running sneakers ₹4,200 Delayed · Clothes", "Paracetamol strip ₹85 Bought · Health/medical".

---

### 2. Add — Quick Add flow (the core, keypad-first, ≤10s)
Opened from the center **Add** FAB. A 4-step full-screen flow with a header: back button (left; `x` on step 1, `chevron-left` after), centered title + "STEP n OF 4" kicker in `--amber`, and a close `x` (right) → returns to Log.

**Step 1 — Amount** (title "Add money"): a blank screen with a large centered amount — `₹` glyph (34px `--muted`) + the number (heading font, **66px**, tabular) + a blinking amber caret (3px×52px, `scblink` 1.1s steps(1) infinite). Below it an idle hint: "Type the amount" → once a value is entered, "Pause a second — we'll move on automatically". A numeric keypad fills the bottom (3-col grid, keys `1–9`, `00`, `0`, `⌫`, each 52px tall, heading font 23px, `:active` tints to `--surface2`).
- **Auto-advance:** after the last keypress, a **2000ms** idle timer fires and advances to Step 2 automatically (cleared on every keypress and on manual nav). A **Continue** button (amber, `arrow-right`) also appears once amount > 0 for users who don't want to wait.
- A footer link "Adding an older transaction? **Manual entry →**" opens the Manual Entry form (section 3).

**Step 2 — Category** (title "What kind?"): the entered amount shown centered (heading 30px, tabular). Categories laid out in three labeled groups — **NEEDS / WANTS / SAVINGS** (group label in the bucket color) — as wrapping pill chips (padding `10px 15px`, radius 22, 13.5px). Unselected = 1px `--line` border on transparent, `--muted` text; selected = amber (`border --amber`, `background rgba(227,164,88,.16)`, text `--amber`).
- **Ask is automatic here:** selecting a category does **not** advance — it reveals the budget **verdict card** inline directly below the chips (see Ask/Verdict spec), plus a **Continue** button (amber, `arrow-right`) that proceeds to Step 3. This is the "should I buy this?" check folded into the add flow.

**Step 3 — Description** (title "Add a note"): amount + selected-category tag shown centered at top. Label "WHAT WAS IT FOR?" then a single underlined text input (transparent, 2px `--amber` bottom border, 20px text, placeholder "e.g. Coffee with Ana (optional)"). The input **auto-focuses / launches the keyboard** on entering this step. Description is optional. A bottom **Next** button (amber, `arrow-right`) → Step 4. Date defaults to **Today** (not asked here — Quick Add always logs Today).

**Step 4 — Account** (title "Paid from"): amount + category tag + a "description · Today" line. Then "PAID FROM" and a 2-column grid of **account cards** (see Accounts spec). Tapping an account **saves the transaction** (adds it to the log with a "scpop" entry animation, increments the category's spent, routes to Log) and fires a confirmation toast "Added ₹X · Category". If fewer than 6 accounts exist, a dashed "+ Add account" card is shown as the last cell.

---

### 3. Add — Manual Entry (older / known spends, and non-spend types)
Reached from the "Manual entry →" link on Quick Add step 1. Header: back `chevron-left` → Quick Add, title "Manual entry". Single scrolling form, keypad inline at the bottom, one **Save** button.

- **Type selector** (horizontal scroll chips, radius 11, with a leading icon): **Spend** (`arrow-up-right`) · **Transfer** (`arrow-left-right`) · **Self transfer** (`repeat`) · **Credit / money in** (`arrow-down-left`). Selected chip uses the amber selected style.
- **Amount card**: bordered surface card, centered `₹` + number (heading 40px, tabular).
- **Transfer / Self transfer** → shows a **FROM → TO** pair of account pickers (two cards with a small `arrow-right` between; tap cycles through accounts). No category.
- **Spend / Credit** → shows a **Category** chip row (horizontal scroll; categories below) and a single **Account** row (tap cycles accounts).
- **Note & date**: a full-width "Description" text input, then a date row (`calendar` icon, current label, "change" affordance) that **cycles** Today → Yesterday → Sat, 2 Aug → Thu, 31 Jul (i.e. supports back-dating).
- Inline numeric keypad (same keys as Quick Add, 46px rows).
- **Save** button (amber, `check`): label reads "Save spend / transfer / self transfer / credit" per type. On save: adds a transaction to the log (with `scpop` animation), Spend increments category spent; Transfer/Self/Credit post as **incoming** rows (green, prefixed "+"). Empty amount → error toast "Enter an amount first". Routes to Log + success toast.

---

### 4. Transactions Log
**Purpose:** Chronological history, grouped by date.
**Layout:** Header row: title "Transactions" (heading 25px) + a 40px circular amber `plus` button (opens Quick Add). Filter chips row (horizontal scroll): **All** (active, amber fill) · **Category ▾** · **Account ▾** · **August ▾** (the latter three are outlined `--line` with a `chevron-down`). Then date groups.
- **Date group header** (`space-between`): date label (11px uppercase `--muted`) + group total (11.5px `--faint`, tabular).
- **Transaction row**: 39px rounded-square icon tile (radius 11) tinted by bucket, then description (14px, truncates) over a meta row (a color-coded category tag pill 10.5px + account name in `--faint`), amount on the right (14.5px, tabular). Incoming types (transfer/self/credit) render the amount green with a "+" prefix and use an `arrow-left-right` / `arrow-down-left` icon; spends use the category's Lucide icon.
- **Bucket tint = tag color**: Need = blue-grey tint, Want = amber tint, Save = green tint (exact tints in tokens).

**Sample rows:** Today — Zomato dinner ₹640 (Food Wants, Paytm). Yesterday — BigBasket groceries ₹2,380 (Food Needs, HDFC), SIP Index fund ₹5,000 (Investment, HDFC), Netflix ₹649 (Utilities, ICICI). Fri 1 Aug — House rent ₹11,000 (EMI, HDFC), Electricity bill ₹1,180 (Home, HDFC).

---

### 5. Monthly Summary / Trends
**Purpose:** Patterns and plan-vs-actual for the month.
**Layout:**
1. Header: "August" (heading 25px) + "This month ▾".
2. **Donut card** (bordered surface): a 126px conic-gradient donut with a `--surface` hole (inset 20px) showing "₹57.5k / spent" in the center. Slices are **Needs (`--need`) / Wants (`--amber`) / Savings (`--green`)** sized by share of total spent. Legend on the right: colored square + name + computed % + a faint target "/ 50", "/ 30", "/ 20" (the 50/30/20 rule). A caption under the card notes proximity to the 50/30/20 target.
3. **Planned vs actual** bars: kicker row with a legend ("▬ plan" faint, "▬ spent" text). One row per category (Food Needs, EMI, Home, Transportation, Personal, Food Wants, Clothes, Investment): name + "spent / planned" (spent colored by status). The visual is two stacked mini-bars — a faint **plan** bar (5px) above a colored **spent** bar (6px), both scaled against a fixed max (₹20,000). Spent color: red if over plan, amber if ~at plan, green if under; Savings uses `--need`.
4. **Patterns** cards: bordered cards with a 3px colored left border, a Lucide icon, and a text callout. Examples: "Food Wants: asked 6× this month, skipped 2. Spent ₹3,600 vs ₹3,000 planned — ₹600 over." / "Clothes ran ₹400 over plan. 2 delayed asks are still open — revisit or drop them." / "Needs held at 68% of plan with 10 days left. On track."

---

### 6. Settings
**Purpose:** Manage budgets/categories, accounts, security, appearance.
**Layout:** Title "Settings", then bordered surface groups:
1. **BUDGETS & CATEGORIES** (kicker + "Edit"): rows of colored dot + category name + bucket tag ("NEED/WANT/SAVE") + planned amount. A "Show all 15 categories" expander row at the bottom.
2. **ACCOUNTS** (kicker + "+ Add"): rows of a 34px rounded icon tile + nickname over "Bank · type" subtitle + a `pencil` rename affordance. **Add** and **rename** use a prompt in the prototype — in the real app these are proper modals/sheets. **Max 6 accounts** (Add is disabled/hidden past 6).
3. **SECURITY**: "Lock now · passcode" row (`lock`, opens the Lock screen) + "Biometric unlock" row with an on-style amber toggle.
4. **APPEARANCE**: **Theme** row with a **Dark / Light segmented control** (the active segment is an amber fill with `#231a0c` text; inactive is transparent with `--muted`). This is the live theme switch — see Theming. Then a "Currency — ₹ INR" row.

---

### 7. Passcode Lock
**Purpose:** Simple single-user app lock.
**Layout:** Centered: a 60px rounded-square outline tile with a `lock-keyhole` icon (amber), "SpendCheck" title, "Enter your passcode" subtitle, and a row of **4 dots** (filled amber as digits are entered). Below: a numeric keypad (3-col, 58px circular keys, blank key at position 10, `⌫` at 12). A "Use Face ID" row (`scan-face`, amber) at the bottom. Entering 4 digits unlocks (routes to Home) — any 4 digits in the prototype; wire to real auth.

---

## Interactions & Behavior
- **Navigation:** bottom nav switches the four top-level screens. Add FAB → Quick Add. Log's + → Quick Add. Home avatar / "See all" → Settings / Log.
- **Quick Add auto-advance:** 2000ms idle timer on the amount step advances to category; cleared on keypress and on any manual navigation. Steps can also be advanced manually (Continue/Next) and reversed (header back).
- **Ask / Verdict (automatic):** computed the moment a category is selected (in Quick Add) or when both amount and category exist (standalone). Shows remaining budget in that category and flags over-plan. **Rules:** `remaining = plan − spent`. If `amount ≤ remaining` → green "Looks fine" card: title "₹{remaining} left in {cat}", body "This fits — you'd have ₹{after} left of your ₹{plan} plan." If `amount > remaining` → red "Over plan" card: head "Over plan", a "{cat} · {bucket}" tag, title "Only ₹{remaining} left in {cat}" (or "{cat} already over plan" when remaining ≤ 0), body "This puts you ₹{over} over your ₹{plan} monthly plan." Card animates in with `scpop` (translateY 10px + scale .985 → none, opacity 0→1, .35s ease).
- **Decision buttons** (standalone Ask screen, if retained): Bought / Skipped / Delayed — large 58px, outlined in green/red/amber. Bought also creates a Today transaction and increments spent. Every decision prepends to Recent Asks and shows a toast.
- **Toast:** bottom-anchored pill (above nav), icon + message, `sctoast` keyframe (rise+hold+fall over 2.4s), auto-dismiss ~2.3s.
- **Entry animation:** new log rows animate with `scpop`; step transitions use `scin` (translateX 28px → 0, opacity 0→1, .28s ease).
- **Pressable feedback:** tappable elements scale to .97 on `:active`; keypad keys tint to `--surface2` on `:active`.
- **Number formatting:** Indian grouping (e.g. 1,00,000). Numerals are tabular everywhere they appear as figures.

## State Management
Prototype state (map to React state + Supabase tables):
- `route` (home | log | trends | settings | quickadd | manualadd | ask | lock) — use the app router in production.
- `theme` (dark | light) — persist per user (see Theming). Prototype does **not** persist (resets on reload) — product owner to confirm; recommend persisting to `localStorage` and/or a `profiles.theme` column.
- Quick Add: `qaStep`, `qaAmount`, `qaCat`, `qaDesc`; idle timer ref.
- Ask: `askAmount`, `askCat`.
- Manual: `manType`, `manAmount`, `manCat`, `manDesc`, `manFromIdx`, `manToIdx`, `manDateIdx`.
- Lock: `lockCode`.
- Data: `accounts[]` (id, nick, bank, kind, icon), `spent{category: amount}`, `txns[]` (id, date, desc, cat, account, amount, type, isIncoming), `asks[]` (id, item, amount, cat, verdict, decision).
- **Supabase model (suggested):** tables `categories` (name, bucket, planned_amount, color), `accounts` (nickname, bank, kind, icon), `transactions` (amount, category_id, account_id, description, occurred_on, type ∈ spend|transfer|self|credit), `asks` (item, amount, category_id, verdict, decision). Monthly aggregates (spent per category/bucket, balance) are derived — compute via a view or client-side. Verdict math is pure and can live client-side.

---

## Design Tokens

### Colors — Dark theme (default)
| Token | Value | Use |
|---|---|---|
| `--page` | `#0e0d0a` | app surround behind the phone |
| `--bg` | `#181510` | screen background |
| `--surface` | `#211d17` | cards, groups |
| `--surface2` | `#2b2620` | tracks, key press, toast bg |
| `--text` | `#f1ede4` | primary text |
| `--muted` | `#a89f8e` | secondary text |
| `--faint` | `#6f685c` | tertiary/inactive |
| `--line` | `rgba(241,237,228,.10)` | hairline borders |
| `--amber` (accent) | `#e3a458` | accent, FAB, Wants |
| `--green` | `#84b06f` | under budget / savings met |
| `--red` | `#d76f5e` | over budget |
| `--need` | `#93a0b8` | Needs bucket / savings pending |
| FAB icon/text on amber | `#231a0c` | dark text on amber fills |

### Colors — Light theme
| Token | Value |
|---|---|
| `--page` | `#e7e5e1` |
| `--bg` | `#f6f5f3` |
| `--surface` | `#ffffff` |
| `--surface2` | `#ecebe7` |
| `--text` | `#201f1d` |
| `--muted` | `#6b665e` |
| `--faint` | `#9a948a` |
| `--line` | `rgba(32,31,29,.12)` |
| `--amber` | `#b68235` |
| `--green` | `#5f8a4c` |
| `--red` | `#c0503d` |
| `--need` | `#5b6683` |

### Bucket tints (icon tiles & tags, both themes use these rgba)
- Need tile/tag: bg `rgba(147,160,184,.15)`, fg `#aeb9cf`
- Want tile/tag: bg `rgba(227,164,88,.15)`, fg `--amber`
- Save tile/tag: bg `rgba(132,176,111,.16)`, fg `--green`
- Verdict good: border/fg `--green`, tint bg `rgba(132,176,111,.07)`, icon bg `rgba(132,176,111,.16)`
- Verdict over: border/fg `--red`, tint bg `rgba(215,111,94,.07)`, icon bg `rgba(215,111,94,.16)`
- Chip selected: border `--amber`, bg `rgba(227,164,88,.16)`, text `--amber`

### Typography (Classical design system)
- **Headings:** Cormorant Garamond, semibold cap (never heavier). Display sizes set at normal weight.
- **Body:** Lora.
- Sizes in use: display balance 47px; Quick Add amount 66px; screen titles 23–25px; verdict title 19px; body 13–14px; labels/kickers 11px uppercase (letter-spacing ~.12–.14em); nav labels 10px.
- **Numerals: tabular** (`font-feature-settings:'tnum'`) on every figure — balances, amounts, counts, tables, chart values.
- If the target codebase standardizes on a different type system, keep the **scale, weights, and tabular-numeral rule**; the specific faces (Cormorant/Lora) are the design-system default and may be swapped for the app's brand fonts.

### Spacing / radius / elevation
- Page padding 20px horizontal; bottom padding 108px (clears the 82px nav).
- Radii: cards 14–18px, phone screen 36px, chips/pills 20–22px, key tiles 10–12px, icon tiles 9–11px, FAB/circular 50%.
- Progress tracks: 7–9px tall, radius 6.
- Elevation is a whisper — the only real shadow is the FAB glow and the phone frame drop shadow. Keep shadows subtle (Classical: no heavy drop shadows).
- Density is airy — don't tighten leading or crowd margins.

### Keyframes
- `scpop`: `0% {translateY(10px) scale(.985); opacity 0} 100% {none; 1}` — cards & new rows, .35s ease.
- `scin`: `0% {translateX(28px); opacity 0} 100% {none; 1}` — step transitions, .28s ease.
- `scblink`: opacity 1→.2→1, 1.1s steps(1) infinite — amount caret.
- `sctoast`: rise (0→12%), hold (→88%), fall (→100%) over 2.4s.
- Pressable `:active` → `scale(.97)`; key `:active` → `background --surface2`.

## Theming
Dark is the default. The Settings → Appearance segmented control toggles a `sc-light` modifier on the app root that overrides the color tokens (values above). Implement as a theme context / CSS-variable swap / Tailwind dark-mode equivalent. **Recommend persisting** the choice (prototype currently resets on reload). A "match system" option is a reasonable addition (owner didn't request it).

## Categories (use these exact names — real data, do not invent)
- **Needs:** Food Needs, Health/medical, Home, Transportation, EMI, UPI Lite
- **Wants:** Personal, Party/Contro, Utilities, Trip/Travel, Other, Clothes, CC Bills, Food Wants
- **Savings:** Investment

Sample planned monthly amounts used in the mock (owner to confirm real values): Food Needs ₹12,000 · Health/medical ₹3,000 · Home ₹8,000 · Transportation ₹6,000 · EMI ₹11,000 · UPI Lite ₹2,000 · Personal ₹5,000 · Party/Contro ₹2,000 · Utilities ₹3,000 · Trip/Travel ₹4,000 · Other ₹1,500 · Clothes ₹2,000 · CC Bills ₹6,000 · Food Wants ₹3,000 · Investment ₹20,000. Start balance ₹92,400.

## Accounts (sample; user-managed, max 6, nicknamable)
Salary (HDFC Bank · Debit, `wallet`) · Rewards (ICICI · Credit card, `credit-card`) · Cash (Wallet · Cash, `banknote`) · Paytm (Paytm · UPI wallet, `smartphone`). Each has a **nickname** (editable) shown as the primary label, with "bank · type" as subtitle.

## Assets
- **Icons:** Lucide (https://lucide.dev) — names referenced throughout this doc (home, receipt-text, plus, bar-chart-3, settings, help-circle, user, info, chevron-*, arrow-right, arrow-left-right, arrow-down-left, arrow-up-right, repeat, wallet, credit-card, banknote, smartphone, calendar, lock, lock-keyhole, fingerprint, scan-face, moon, indian-rupee, tag, pencil, check, x, clock, alert-triangle, circle-check, utensils, shopping-basket, bus, shirt, tv, trending-up, landmark, zap, cross, party-popper, plane, shapes). Use the codebase's existing icon setup (lucide-react is the natural fit).
- **Fonts:** Cormorant Garamond + Lora (Classical design system). No image assets — no photography or illustration in this app.
- No proprietary/brand assets.

---

## Money Lent (separate section) + Database

**Screen 8 — Money lent.** Opened from the "Money lent" card on Home (below the balance card). Not part of budgets or the Log; no effect on balance.
- **Summary card:** "Yet to get back" total (heading 42px) + "N people owe you".
- **Outstanding:** one row per person (initial avatar, name, "N loans · since <date>", amount owed, chevron). Tap expands that person's loans: each shows amount, note, date, and a **Got back** button; plus **All returned** and **Lend more** buttons.
- **Settled:** people with nothing outstanding, amount struck/green check.
- **Record money lent:** sticky amber button → bottom sheet with Name (quick-pick chips of previous names; same name appends to that person), Amount (₹, numeric), Note (optional), Save.

### Suggested Supabase schema (Postgres, RLS: `user_id = auth.uid()` on every table)
```sql
create table accounts (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), nickname text not null, bank text, kind text, icon text, position int, created_at timestamptz default now());
create table categories (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), name text not null, bucket text check (bucket in ('need','want','save')), planned_monthly numeric(12,2) default 0);
create table transactions (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), txn_date date not null default current_date, description text, type text not null check (type in ('spend','credit','transfer','self')), amount numeric(12,2) not null, category_id uuid references categories, account_id uuid references accounts, to_account_id uuid references accounts, created_at timestamptz default now());
create table asks (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), item text, amount numeric(12,2) not null, category_id uuid references categories, decision text check (decision in ('bought','skipped','delayed')), created_at timestamptz default now());
create table lent_loans (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(), person_name text not null, amount numeric(12,2) not null check (amount > 0), lent_on date not null default current_date, note text, settled_at timestamptz, created_at timestamptz default now());
create index on lent_loans (user_id, person_name);
```
- Outstanding per person = `sum(amount) where settled_at is null group by person_name`. "Got back" sets `settled_at = now()`; "All returned" sets it for every open loan of that person.
- Enable RLS on all tables with `using (user_id = auth.uid()) with check (user_id = auth.uid())`.
- Env for Netlify: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## Files (in this bundle)
- `SpendCheck App.dc.html` — the **working interactive prototype** (all six screens, the stepped Quick Add, Manual entry, live verdict, theme toggle, lock). This is the primary reference. It is a Design Component and expects the `support.js` runtime + the Classical stylesheet to render — treat it as a spec/reference, not a build target.
- `screens/ScreenHome.dc.html`, `ScreenAsk.dc.html`, `ScreenLog.dc.html`, `ScreenAdd.dc.html`, `ScreenSummary.dc.html`, `ScreenSettings.dc.html`, `ScreenLock.dc.html` — the original static single-screen mockups (cleaner per-screen reference for layout).
- `support.js` — the prototype runtime (only needed if you want to open the `.dc.html` files locally).
- To view a `.dc.html`: open it in a browser served from a folder that also contains `support.js` and the Classical `styles.css` (see the design system). You don't need it running to implement — this README is self-sufficient.

---
*This README is intended to be self-sufficient: a developer who wasn't in the design conversation should be able to implement SpendCheck from this document alone.*
