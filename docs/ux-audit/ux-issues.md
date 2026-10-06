# UX issues

Phase 1 findings. Severity: **High** blocks a task or hurts readability; **Medium** inconsistent or hard to scan; **Low** polish. No fixes applied yet.

| # | Sev | Area | Issue | Where |
|---|---|---|---|---|
| 1 | High | Light theme contrast | Orange accent used for text (kickers, links, "Delayed", "Only X left") is low contrast on white | Home, Verdict, Log, Trends, app.css |
| 2 | High | Light theme contrast | "Needs" cyan tag was unreadable on light; fixed by darkening `--need` to `#0e7490`, but the bucket tint is still a hard-coded rgba | categories.ts:5 |
| 3 | High | Quick Add layout | Step 1 keypad left large blank space on phones; keypad now fills the screen, but the fix is in one screen only | QuickAdd.tsx, app.css `.keypad--fill` |
| 4 | High | Palette | Brief asks for primary `#4f6bed`; app uses orange `#f97316` as the accent everywhere | tokens.css `--amber` |
| 5 | Medium | Hard-coded colours | 13 locations bypass tokens (rgba tints, scrim, plan marker) | See current-design-system.md |
| 6 | Medium | Type scale | About 22 font sizes used with no scale; 13 px used 27 times, 13.5 px 14 times, 12.5 px 10 times, 12 px 10 times | All screens |
| 7 | Medium | Radius | 10+ radius values (3–18 px) with no scale; same-role elements use different radii (cards 16/18, tracks 6/9) | All screens |
| 8 | Medium | Inline styles | About 300 inline `style={{}}` objects; Settings alone has 73. Styling is hard to change consistently | Settings, Trends, Lent, Home, QuickAdd |
| 9 | Medium | Buttons | Primary action buttons mix `.btn` and inline-styled buttons; heights vary (Manual save 52 px, others auto) | Manual.tsx:127, others |
| 10 | Medium | Lists vs tables | Log and Lent show rows as divs with no column headers; amounts are not aligned as a table would align them | Log.tsx, Lent.tsx |
| 11 | Medium | Forms | Each form (Manual, Settings budgets, Lent sheet, account edit) builds labels and inputs differently | Manual, Settings, Lent |
| 12 | Medium | Status colours | Verdict, ask decisions, bucket bars and savings use different greens/ambers for the same meaning | Home, Verdict, categories.ts |
| 13 | Low | Savings colour | Savings is blue (`--need`) on Home's progress bar until the goal is met, but green (`--green`) in the bucket tint table (`categories.ts:7`) used by Log. The purple `--save` token is defined but not used for savings. Confirm which one is intended | Home.tsx:94, Log.tsx:91, categories.ts:7 |
| 14 | Low | Focus | Focus outline is set per control; custom buttons and chips may not show a visible focus ring | app.css, inline buttons |
| 15 | Low | Empty states | Home asks empty state is a plain sentence; other empty states differ in weight | Home.tsx:78 |
| 16 | Low | Manual title | Screen title "Add transaction" conflicts with the centre "+" button label | Manual.tsx:77 |
| 17 | Low | Date control | Manual uses a native date input on one field and a picker on another; styling differs | Manual.tsx:102 |

## Not in scope for this pass

- The Chrome "Desktop site" mode cannot be fixed with CSS.
- Dev-only mock layer.
