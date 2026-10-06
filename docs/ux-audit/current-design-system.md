# Current design system

Phase 1 discovery. Describes what exists today, not what should exist.

## Tokens (`src/styles/tokens.css`)

Dark is default; light applies under `prefers-color-scheme: light` (guarded by `:root:not([data-theme='dark'])`) and `data-theme="light"`.

Short names are used everywhere in code (no semantic family layer yet):

| Token | Dark | Light | Used for |
|---|---|---|---|
| `--bg` | `#0b0f14` | `#f8fafc` | Page background |
| `--surface` | `#121821` | `#ffffff` | Cards |
| `--surface2` | `#1e2938` | `#e2e8f0` | Tracks, chips |
| `--line` | `#2a3649` | `#cbd5e1` | Borders |
| `--text` | `#f8fafc` | `#0f172a` | Primary text |
| `--muted` | `#94a3b8` | `#475569` | Secondary text |
| `--faint` | `#64748b` | `#64748b` | Tertiary text |
| `--amber` | `#f97316` | `#f97316` | Accent (buttons, active chips, kicker) |
| `--on-amber` | `#ffffff` | `#ffffff` | Text on accent |
| `--green` | `#22c55e` | `#16a34a` | Success, savings-met |
| `--red` | `#ef4444` | `#ef4444` | Danger, over plan |
| `--warning` | `#f59e0b` | `#f59e0b` | Warning |
| `--need` | `#06b6d4` | `#0e7490` | Needs bucket |
| `--save` | `#a78bfa` | `#8b5cf6` | Savings bucket |

Primary `#4f6bed` from the brief is not yet a token. The accent in use is still the handoff orange `--amber`, which conflicts with the palette the user asked for.

## Radius (ad-hoc, no scale)

Values used in TSX `borderRadius`: 3, 4, 5, 6, 9, 11, 12, 14, 16, 18, 50%. In CSS: 6, 10, 20, 999px.

## Type (ad-hoc, no scale)

Font sizes used in inline styles, most frequent first: 13 (27×), 13.5 (14×), 12.5 (10×), 12 (10×), 11 (10×), 15 (7×), 14 (7×), 24 (5×), 11.5 (5×), 10, 10.5, 14.5, 23, 42, 44, 46, 34, 26, 22, 19, 18, 9.5. Roughly 22 distinct sizes.

Font families: `Cormorant Garamond` (headings), `Lora` (body), set in `index.html` and `tokens.css`.

## Components

| Pattern | Where | Status |
|---|---|---|
| `.card` | Home, Settings, Lent, Verdict | Shared class, 9 uses |
| `.track` / `.fill` | Home, Trends, Verdict | Shared class |
| `.btn` | Several screens | Shared class, but many screens use inline-styled buttons instead |
| `.input` | Manual, Settings | Shared class, mixed with inline overrides |
| `.chip` / `.chiprow` | Manual, Log, Trends | Shared class |
| `.keypad` | Keypad.tsx | Shared component |
| Table | none | No `<table>` in the app. Log is a list of rows. |
| Form primitives | none | Each screen builds its own labels, inputs and pickers |
| Badge / tag | Verdict, Log, Home | Inline-styled spans with hard-coded tints |

## Inline style load

`style={{` occurrences by file: Settings 73, Trends 37, Lent 35, Home 35, QuickAdd 34, Manual 21, Log 18, Ask 16, Verdict 13, Lock 11, App 11, BottomNav 1.

## Hard-coded colours outside tokens (13 locations)

- `Verdict.tsx:66,68,72`: `rgba(255,255,255,0.02)`, `rgba(255,255,255,0.06)`, `rgba(249,115,22,.15)` plus `var(--amber)`.
- `categories.ts:5-7`: bucket tints `rgba(6,182,212,.2)`, `rgba(249,115,22,.15)`, `rgba(34,197,94,.16)`.
- `Home.tsx:133-135`: ask decision tints `rgba(34,197,94,.15)`, `rgba(239,68,68,.15)`, `rgba(249,115,22,.15)`.
- `Lent.tsx:152`: sheet scrim `rgba(0,0,0,0.45)`.
- `Log.tsx:91`: fallback tint `rgba(34,197,94,.16)`.
- `Trends.tsx:128`: plan marker `rgba(248,250,252,.16)`.
- `app.css:175`: `rgba(249,115,22,0.16)`.

## Accent usage

`var(--amber)` is referenced in 32 places. It is the only accent token, and it is used for both fills (buttons, progress) and text (kickers, links). Text on the light background uses the same orange, which is the contrast risk noted in earlier QA.

## Summary

- Colour: the token names are short and ad-hoc, there is no semantic family (danger/warning/success/info/reminder bg variants), and there is no accent-text or accent-tint pair.
- Type and radius: no scale; values are chosen per element.
- Components: only cards, tracks and chips are shared. Tables, forms, badges and buttons are re-implemented inline on each screen.
