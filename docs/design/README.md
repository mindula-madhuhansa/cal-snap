# Design source

Imported from the Claude Design project on 8 August 2026.
Source: https://claude.ai/design/p/0119ba61-f6d4-452e-ac4f-f5c1b66dde70

## Files

| File | What it is |
|---|---|
| `CalSnap.dc.html` | The full interactive design: every screen plus the state logic that drives it. Design canvas format, so it is a mock, not product source. |
| `classical.css` | The design system tokens and component classes. This is the source of truth for the look, and what the real design system should be ported from. |

Two files in the design project were deliberately not imported. `support.js` is the generated design canvas runtime, a React based interpreter for the `x-dc`, `sc-if`, and `sc-for` tags. `ios-frame.jsx` is a copied starter device frame marked `@ds-adherence-ignore`, only there to draw an iPhone bezel around the preview. Both are preview harness, and neither belongs in the app.

## The visual language

Classical and quiet, not the usual fitness app look. Warm paper ground (`#f3f2f2`), near black ink (`#201f1d`), a single antique gold accent (`#b68235`) with a deeper shade for emphasis (`#7d5411`). Cormorant Garamond for headings and every number, Lora for body text. Hairline rules instead of cards and shadows, almost no fills, tabular figures on all numerals. Radii are tiny (2px, 4px, 7px). Nothing shouts.

## Screens in the design

Onboarding (5 steps: welcome, about you, activity, goal, calculated allowance), Today, Camera, Result, Add by hand, Exercise, Ledger, Coach, Settings, and a 5 tab bar (Today, Ledger, Snap, Coach, Settings).

## Decisions the design makes

These were open questions in `docs/scope/scope.md`. The design answers them, and the answers should be carried into the specs rather than decided again.

- Daily target uses Mifflin St Jeor, activity multipliers `1.2 / 1.375 / 1.55 / 1.725`, goal adjustment `-500 / 0 / +350` kcal, rounded to the nearest 10.
- Macro split is 30% protein, 40% carbohydrate, 30% fat, protein and carbs at 4 kcal per gram, fat at 9.
- Exercise calories return to the day's allowance. Remaining is `target - eaten + burned`.
- Going over target is shown calmly: the ring turns a deeper gold and the label reads `over`, with no red and no alarm.
- The camera returns several separate items per plate, each with its own portion stepper, rather than one lump total.

## Where the design and the scope disagree

Worth resolving before building, not after.

1. **Onboarding says "Nothing leaves the phone", but the scope chose accounts with cloud sync.** These cannot both be true. Either the copy changes or the storage decision does.
2. **The design has no sign in, no privacy or terms screen, and no account deletion.** Scope features 5 and 10 have no design yet.
3. **The design covers work the scope placed in later releases**: Add by hand, Exercise, Ledger with the weekly bars and the weight trend, and the Coach chat, which the scope has in Deferred.
4. **The design connects a health app in onboarding and in Settings**, which the scope deferred.
