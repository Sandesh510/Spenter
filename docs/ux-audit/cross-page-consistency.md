# Cross-page consistency

Phase 1 check across the screens. Compares the same role on each screen.

Caveat: this table is built from grep counts and the files read so far. Cells marked with ranges (icon sizes, error text, empty states) were not measured one by one and need a per-screen pass in phase 2.

| Element | Home | Log | Trends | Settings | Lent | Manual | Quick Add | Ask | Lock | Consistent? |
|---|---|---|---|---|---|---|---|---|---|---|
| Screen title | Kicker + h1 (22 px) | Topbar | Kicker + h1 | Topbar | Topbar | Topbar, "Add transaction" | Topbar | Topbar | Heading | No: two title patterns (kicker+h1 vs topbar) |
| Card | `.card` | Inline | Inline | `.card` + inline | Inline | Inline bordered row | Inline | Inline | Inline | No |
| Primary button | Inline | Inline | n/a | Mixed | Inline | `.btn` 52 px | Keypad confirm | Inline | Keypad | No |
| Section label (kicker) | 11 px uppercase | 11 px | 11 px | 11 px | 11 px | 11 px, margin 16/7 | 11 px | 11 px | n/a | Mostly yes; margins differ |
| Amount display | Heading 44 px | List 13–14 px | Heading | Inline | Heading | Heading 42 px | Heading | Heading | n/a | No: sizes 42, 44, 46 |
| Empty state | Plain text | Plain text | n/a | n/a | Plain text | n/a | n/a | n/a | n/a | No: weight varies |
| Error text | `--red` inline | `--red` inline | n/a | Toast/inline | `--red` | `--red` 13 px | Inline | Inline | Inline | Mostly yes |
| Icon size | 15–19 px | 14–17 px | 14–17 px | 14–19 px | 14–16 px | 13–18 px | 13–19 px | 13–17 px | 14–18 px | No: no icon size scale |
| Bottom padding | 108 px (`.screen`) | Scroll | Scroll | Scroll | Scroll | 24 px inline | Scroll | Scroll | n/a | No: Manual overrides |
| Back navigation | n/a | n/a | n/a | n/a | Topbar back | Topbar back | Topbar back | Topbar back | n/a | Yes |
| Haptics on success | n/a | n/a | n/a | n/a | n/a | Yes | Yes | Yes | Yes | Yes |

## Summary

- The biggest inconsistencies are title pattern, card styling, primary button styling, and amount size. These come from inline styling, so fixing the shared primitives (card, button, amount, title) will address most of them.
- Haptics and back navigation are consistent.
