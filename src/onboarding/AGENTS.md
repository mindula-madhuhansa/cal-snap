# Onboarding and the daily target

## Overview

First run setup: the questions a new person answers, the target that comes out of them, and the
"Your goal" section in Settings that changes it later. Spec 0006 owns all of it.

The whole flow is **one route** (`src/app/onboarding.tsx`) rendering one step at a time, not nine
routes. The step is read from `onboarding_draft.current_step` in SQLite, so the flow is driven by
stored state rather than by the navigation stack. Screens here never touch the database directly:
`use-onboarding.ts` is the only effectful piece, and everything under it is given values and
callbacks.

## Key files

| File                  | Owns                                                                       |
| --------------------- | -------------------------------------------------------------------------- |
| `use-onboarding.ts`   | The flow's state, and the only place setup reads or writes the database    |
| `step-frame.tsx`      | What every question screen shares: progress, the question, the back step   |
| `steps.tsx`           | The eight question components, one per stored `current_step` value         |
| `result-step.tsx`     | The target, the floor sentence, and the expandable detail                  |
| `result-sentences.ts` | What the result screen says. Pure                                          |
| `goal-section.tsx`    | "Your goal" in Settings: today's target, single answer edits, the override |
| `goal-sentences.ts`   | What that section says, including "this starts tomorrow". Pure             |

The data these read lives next door: `@/data/local/onboarding.ts` (the draft and the completing
transaction), `@/data/local/profile.ts` (changing an answer later),
`@/data/local/target-overrides.ts`, and the pure `@/data/calculations/calorie-target.ts`.

## Conventions

- **Every sentence a person reads is a pure function first.** `result-sentences.ts` and
  `goal-sentences.ts` hold the wording and are tested at a desk. A screen renders a sentence; it
  does not compose one. This is what makes the honesty rules testable rather than aspirational.
- **Effects are read once, at the edge, and passed down.** The device timezone, today's local date,
  and the locale's unit family are read in `use-onboarding.ts` (or `goal-section.tsx`) and handed to
  the data layer as arguments. Nothing below that line asks the device anything.
- Screens build only from `@/design-system/components`, like every other screen (see
  [src/app/AGENTS.md](../app/AGENTS.md)). No literal colour, space, or type value.
- Every input screen enforces the same bounds its column's `checks` declare (age 13 to 120, weight
  20 to 500, pace 0 to 1.5), so a check constraint violation is unreachable and nobody meets a
  generic database error where a specific sentence belongs.
- A health number is never presented as fact. The result uses `NumberText`'s `estimated` flag, which
  marks it in the figure and in what a screen reader says.

## Gotchas

- **Leaving setup takes two steps and needs both.** The startup gate mounts one screen at a time, so
  finishing must call `onboardingFinished()` (from `@/account/session`) to change what the gate
  declares, **and then** navigate once the gate has declared the tabs. Changing what the gate
  declares does not move the route already showing; doing only that leaves the finished setup screen
  up for ever. A device found this on 10 August 2026.
- **Finishing setup must survive a retry.** The screen tells the person their answers are saved and
  to try again, so the second press has to be able to work. `completeOnboarding` upserts `profiles`
  and `weight_entries` for that reason: both carry a uniqueness rule, and a bare insert made an
  unfinished profile row, a weigh in already logged today, or one failed attempt fail identically
  for ever. Same device, same day.
- **The data layer returns expected failures as values, but a database that cannot be read still
  throws.** Every loader here catches, because an uncaught rejection leaves the screen on its
  loading line with nothing said, which reads exactly like lost data.
- The draft is `presence: 'sqlite'`, so it never syncs and never reaches Postgres. Signing out
  removes the per account file and the unfinished draft with it, which is why abandoning setup on
  one device leaves nothing behind.
- The result screen computes its number with the same pure function the write path uses, so the
  number shown is the number stored. Do not recompute it a second way.
- `CONSENT_VERSION` in `@/config/consent.ts` ships as a placeholder with placeholder copy. Scope
  feature 10 must replace the copy **and** bump the constant together, or people are recorded as
  having agreed to text that did not exist yet.
- Settings only ever offers **tomorrow** as an override's `effective_from`. A day's target is read
  once, when its row is first created, so a backdated date cannot reach a day already written.

## Related specs

- [0006. Onboarding and the daily calorie target](../../docs/specs/0006-onboarding-daily-calorie-target/index.md),
  which owns every acceptance criterion here. Its `verify.md` lists what still needs a real phone.

_Drafted by /sync from the introducing change, worth a quick human pass._
