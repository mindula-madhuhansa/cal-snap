# Scope: CalSnap

A calorie counter for everyday people losing weight. You point your camera at a meal, the app tells you what is in it, and one simple screen shows how much of your day you have left.

**Build approach:** Skateboard (ship the smallest complete app a real person would use, then grow it, shippable at every release).
**Workflow:** Beta (after `/develop`, run `/check verify`, then `/test`). The project default level of rigor. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag (e.g. `· GA`) to do more or less.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 1 | Stack & architecture | Foundation | done |
| 2 | Coding standards & tooling | Foundation | done |
| 3 | Data model | Foundation | in-progress |
| 4 | Design system & UI foundation | Foundation | done |
| 5 | Account & sign in | Release 1 | in-progress |
| 6 | Onboarding & daily calorie target | Release 1 | planned |
| 7 | Snap a meal: AI nutrition scan | Release 1 | planned |
| 8 | Review & save a meal | Release 1 | planned |
| 9 | Today screen | Release 1 | planned |
| 10 | Privacy, terms & account deletion | Release 1 | planned |
| 11 | Analytics & error monitoring | Release 1 | dropped |
| 12 | Log exercise burn | Release 2 | planned |
| 13 | Meal history | Release 2 | planned |
| 14 | Daily reminders | Release 3 | planned |
| 15 | Weight tracking & trend | Release 3 | planned |

## Foundations

Nothing here is a feature a user sees, and all of it is ground the releases stand on. Build it once, cheaply, in this order.

### 1. Stack & architecture · done
Choose the mobile stack, the backend, and how the phone talks to it, then scaffold a project that runs on both iOS and Android. Every later feature rests on this one, and the AI scan and cloud sync both depend on the shape it sets.
**Done when:** the decision is recorded in a spec, and an empty app boots on an iOS simulator and an Android emulator and passes a build.
- [x] Decide the stack (spec): `/architect stack & architecture`
- [x] Scaffold from the decision: `/develop stack & architecture`
   - [x] Expo project, TypeScript strict, Expo Router tabs (AC-1..3)
   - [x] Classical theme module and fonts, from `docs/design/classical.css` (AC-4)
   - [x] Local SQLite that opens, migrates, and survives a restart (AC-5)
   - [x] Lint, format, pre-commit hooks, config validation, and the GitHub Actions check (AC-6..8)
- [x] Verify it: `/check verify stack & architecture` — 8 of 9 criteria proven on 9 August 2026. The iOS boot is untested: no Apple device was available. See the spec's `verify.md`.
- [ ] Test it: `/test stack & architecture` — skipped on purpose. The scaffold's only durable logic is three small modules, and its two screens are throwaway, so there was nothing worth locking in yet. Vitest is chosen and recorded in `test-preferences.json`; the first real feature sets the suite up.
Spec [0001](../specs/0001-stack-architecture/index.md) · code in `src/` (`app/`, `design-system/`, `db/`, `config/`, `startup/`)

### 2. Coding standards & tooling · done
Capture the conventions from the real scaffolded project, then install lint, formatting, type strictness, and pre commit checks so every later file follows the same rules.
**Done when:** root `AGENTS.md` reflects the real stack, and lint, format, and type checks run clean.
- [x] Capture conventions + tooling choices: `/audit` — done. Root `AGENTS.md` now reflects the real stack in full (its own footer confirms `/audit` drafted it) and the Tooling section describes the real lint, format, type, and CI setup; the note above describing it as `<to be filled>` was itself stale.
- [x] Install the tooling: `/develop tooling` — the scaffold already had lint, format, pre commit hooks, and CI, so this run made the linter enforce the `AGENTS.md` rules that nothing checked: no default exports (routes and `app.config.ts` excepted), no `any`, no `@ts-ignore`, no non null assertions, no parameter mutation, prefer const.
Code in `eslint.config.js` (rules), `.lintstagedrc.json` + `.husky/pre-commit` (commit checks), `.github/workflows/ci.yml` (push checks)

### 3. Data model · in-progress
The core entities everything else reads and writes: a user, their profile and goal, their calculated daily target, a logged meal with its nutrition numbers, and later an exercise entry and a weight entry. This is the most expensive thing to get wrong, because changing it after people have real diaries means a migration.
**Done when:** the entities and their relationships support meals, exercise, weight, and history without a breaking change, days roll over correctly in the user's own timezone, and one person can never read another person's data.
- [x] Design it (spec): `/architect data model`
- [ ] Build it: `/develop data model`
   - [x] Schema declarations plus the SQLite and Postgres generators, with the parity test (AC-1, AC-13)
   - [x] Local tables and the data access layer over them, paginated and tombstone aware (AC-1, AC-4, AC-5, AC-7, AC-8, AC-9, AC-15, AC-16)
   - [x] The pure calculations: portion rescaling, the local day resolver, the meal type guess, unit conversion (AC-3, AC-6, AC-12)
   - [x] Per user database file lifecycle, opened on sign in and removed on sign out (AC-11)
   - [ ] The cloud half: Postgres migration with row level security, sync, account deletion, retention sweep (AC-2, AC-5, AC-10, AC-14, AC-17) — the Postgres migration is applied and row level security is live and confirmed on all six tables, and **sync is built** (feature 5 brought `src/data/remote/` and its three triggers), though not yet run on a phone. Two remain: account deletion, which lost its `auth.users` cascade to the Clerk decision and now needs a `user.deleted` webhook (feature 10), and the retention sweep, which still has no scheduler
- [ ] Verify it: `/check verify data model`
- [x] Test it: `/test data model` — 238 Vitest tests across 16 files, each pinned criterion tagged `covers: AC-N`. Replaced the earlier `check:schema` and `check:data` scripts, so `npm test` is now the single gate in CI.
Spec [0002](../specs/0002-data-model/index.md) · code in `src/data/` (`schema/`, `calculations/`, `ids/`, `local/`), `src/db/migrations.ts`, `supabase/migrations/`, tests beside the source plus `test/support/`

### 4. Design system & UI foundation · done
The visual language and the base building blocks: type scale, color, spacing, buttons, cards, inputs, the tab bar, and the empty and loading states. This is the feature that decides whether people keep the app, so it is a foundation and not a coat of paint applied later.
**Done when:** `design.md` defines type, color, spacing, motion, and the base components; the components respect the system font size setting and meet contrast requirements; a sample screen built only from them looks finished.
- [x] Design it (spec): `/architect design system & UI foundation`
- [x] Build it: `/develop design system & UI foundation`
   - [x] The thinnest system standing under a real screen: token additions and the colour role rule, the type spine with font scaling, `Screen`, `Icon`, `Button`, `Card`, `Tag`, `ListRow`, `Divider`, the typographic tab bar, and the Today tab rebuilt from them (AC-2..AC-5, AC-7, AC-8, AC-10, AC-14, AC-15)
   - [x] Thicken it to what Release 1 needs: haptics, `Stepper`, the form set with its accessibility wiring, the empty, loading and error states, and reduce motion (AC-3, AC-5, AC-6, AC-9, AC-11, AC-12)
   - [x] Make it hold: the ESLint rules, Vitest over every pure function, `docs/design/design.md` in full, and the accessibility sweep (AC-1, AC-2, AC-3, AC-6, AC-13, AC-14, AC-16)
- [x] Verify it: `/check verify design system & UI foundation` — passed in full on 9 August 2026: an emulator pass covered lint/typecheck/tests/contrast math/most UI, then the engineer confirmed the remaining device-only steps (screen reader, haptics, safe area, live font scaling) on a real EAS development build. Detail in the spec's `verify.md`.
- [x] Test it: `/test design system & UI foundation` — 22 new tests over `theme.ts`'s derived colour tokens and `haptics.ts`'s fire-and-forget contract (309 total, all passing).
Spec [0003](../specs/0003-design-system-ui-foundation/index.md) · code in `src/design-system/` (`theme.ts`, `components/`, the pure rules and their tests), `src/app/(tabs)/` (both screens and the tab bar), `eslint.config.js`, `docs/design/design.md`

## Release 1: The smallest usable app

The thinnest version you would genuinely ship: you set up once, snap meals, and see how much of your day is left. No exercise, no history, no chat. Someone could use only this and get real value.

### 5. Account & sign in · in-progress · GA
Create an account, sign in, stay signed in, and have your data belong to you so it survives a new phone. This is also the first path that runs phone to backend to database end to end, so it proves the stack is truly connected.
**Done when:** a new person can create an account and sign in, the session survives closing the app, signing in on a second device shows the same data, and failure states (wrong details, no network) say something useful.
- [x] Design it (spec): `/architect account & sign in` — decided Clerk for identity rather than Supabase Auth, which reverses spec 0001's Auth row and turns every `user_id` into text. A cross check on a second model found nine gaps, all closed before acceptance.
- [x] Build it: `/develop account & sign in`
   - [x] The door works: the schema change to text identifiers with the new policies, Clerk wired into the splash gate, the combined sign in screen, session routing, and sign out in Settings (AC-1, AC-2, AC-4..AC-8, AC-11, AC-14, AC-16) — landed and confirmed by hand on a development build on 9 August 2026: sign up by emailed code, the session surviving a force quit, the written failure messages, and sign out. The gate is green too (336 tests, lint and typecheck clean).
     **AC-3 (native Google and Apple) was dropped on 9 August 2026**, on your call, and spec 0004 is amended to match. Email is the only sign in method.
     The live Postgres now holds the identity change (all six tables on `text` with the `auth.jwt() ->> 'sub'` policies, confirmed), and Clerk's password attribute is optional, so sign up can complete. One thing is still owed and it belongs to the next slice rather than this one: Clerk has to be registered with Supabase as a third party auth provider, with `role: authenticated` on the session token. Without it the startup profile pull just fails to `stale` and the app carries on offline, so the door works either way; sync is where it becomes load bearing.
   - [x] The data follows you: the Supabase client on Clerk's token, `runSync` with its three triggers, the restoring screen on a fresh device, the syncing marker, and the draining sign out (AC-9, AC-10, AC-11, AC-11b, AC-15) — built on 10 August 2026 and green on the gate (372 tests, lint, format and typecheck clean), but **not yet confirmed on a phone**. Two things are owed before it can be: Clerk still has to be registered with Supabase as a third party auth provider with `role: authenticated`, without which every sync request is refused; and spec 0002's two server side rules (Postgres stamping `updated_at` on receipt, and a tombstone the server keeps) have no trigger behind them, so the pushing device currently wins a conflict. That second one changes the generated Postgres migration, which has already been applied, so it is a decision rather than a fix: `/architect account & sync arbitration`.
   - [x] It holds up: every failure message written out, a session ending mid use handled, the accessibility sweep, and specs 0001 and 0002 amended to match (AC-7, AC-12, AC-13, AC-16) — the code half landed on 10 August 2026 and is green on the gate (383 tests, lint, format and typecheck clean): a session ending mid use now finishes the sync in flight, keeps the local file, and returns you to sign in with the reason written out, and the sweep added an announced `Notice` so every failure sentence is spoken and not just drawn. The spec amendments landed on 10 August 2026 (`/architect`): specs 0001 and 0002 now record Clerk, `text` identifiers, and the `auth.jwt() ->> 'sub'` policies, checked against the live database rather than assumed. `/sync` then wrote `src/account/AGENTS.md` and reconciled the rest of the context files, which closes this milestone.
- [ ] Verify it: `/check verify account & sign in`
- [x] Test it: `/test account & sign in` — 22 tests over `supabase-transport.ts`, the one module in this feature still untested that could be tested without mocking (it imports Supabase as types only, so a fake client drives it). Suite now 400 passing plus 5 expected failures across 35 files. Those tests caught a real bug, **since fixed by `/debug` on 10 August 2026**: the lost connection rule matched `timeout` but never `timed out`, `ETIMEDOUT`, `ENOTFOUND`, or `EAI_AGAIN`, so DNS failures and timeouts read as `rejected` when `transport.ts` documents them as `offline`. It turned out to exist in two drifted copies, and the sign in one was worse: 7 of 10 real network failures produced "Something went wrong signing you in" instead of the connection sentence. Now one shared rule in `network-failure.ts`, written from real platform messages, with its own tests. Suite 431 passing. Still untested and blocked on architecture rather than effort: `sign-out.ts`, `draining.ts`, `use-sign-in-or-up.ts`, and the three providers, all of which import Expo or Clerk at module level and would need mocking the project deliberately avoids.
- [ ] Review it (fresh model): `/check review account & sign in`
- [ ] Document it: `/document account & sign in`
Spec [0004](../specs/0004-account-and-sign-in/index.md) · code in `src/data/schema/` (text identifiers, the jwt sub policies, `tables/sync-state.ts`), `src/data/local/` (`database-name.ts`, `pending.ts`, `database-file.ts`, migration 3), `src/data/remote/` (`push.ts`, `pull.ts`, `sync.ts`, the transport port and the codec), `src/account/` (the session gate, sign in, sync triggers, sign out and draining, `session-end.ts`, `sync-marker-label.ts`), `src/design-system/components/notice.tsx` + `captcha-mount.tsx`, `src/config/env.ts` + `app.config.ts` + `.env.example` (the three variables), `supabase/migrations/`, conventions in `src/account/AGENTS.md`

### 6. Onboarding & daily calorie target · needs a decision
The first run: a few plain questions about height, weight, age, sex, activity level, and whether you want to lose, hold, or gain, and from those the app calculates the calories you should eat each day. It has to feel like four taps, not a medical form.
**Done when:** a new person finishes setup in under a minute and lands on a daily target they can see and change; the calculation and its formula are recorded; unsafe targets are floored rather than shown; the answers are saved so setup never repeats.
- [ ] Design it (spec): `/architect onboarding & daily calorie target`

### 7. Snap a meal: AI nutrition scan · needs a decision
Point the camera at food, and get back what it is plus calories, protein, carbs, and fat. This is the whole promise of the product and the one feature that must feel like magic.
**Done when:** a photo returns a named food with calories and a macro breakdown in a few seconds; a low confidence or unrecognized result says so honestly instead of guessing silently; slow network, no network, and a refused camera permission all fail gracefully; the per scan cost is known.
- [ ] Design it (spec): `/architect snap a meal: AI nutrition scan`

### 8. Review & save a meal
The screen between the scan and the diary: confirm what the AI found, fix the name, change the portion size, adjust the numbers, then save it to today. Being able to correct a wrong guess is what keeps a wrong guess from making people quit.
**Done when:** portion changes rescale the nutrition numbers live, any value can be edited by hand, saving adds the meal to today immediately, and discarding leaves nothing behind.
- [ ] Build it: `/develop review & save a meal`

### 9. Today screen · needs a decision
The home screen and the reason to open the app: your target, what you have eaten, what is left, and the meals you logged today, with the camera one tap away. If any screen has to be beautiful, it is this one.
**Done when:** eaten, target, and remaining are correct and update the moment a meal is saved; today's meals are listed and can be deleted; going over the target is shown calmly rather than as a failure; the empty first day still looks intentional; the day rolls over at local midnight.
- [ ] Design it (spec): `/architect today screen`

### 10. Privacy, terms & account deletion · GA
A privacy policy and terms, a clear explanation of what is collected before you hand over health details, and a real way to delete your account and everything in it. Both app stores require this of a health app, so it is part of release 1 and not something to defer.
**Done when:** policy and terms are reachable from inside the app and from the store listing; consent is explicit before health details are collected; deleting the account removes the user and all their meals, and is confirmed to the person.
- [ ] Build it: `/develop privacy, terms & account deletion`

### 11. Analytics & error monitoring · dropped
De-scoped on 8 August 2026: you decided you do not want product analytics or error monitoring in this product at all. Kept here for history rather than deleted, so the plan stays honest about what changed.

One knock on effect worth remembering: the success measure at the top of this scope, people still logging in week two, is now something you judge by using the app and talking to people, not something the app reports to you.

## Release 2: Calories in and out

The same app, more useful: what you burn, and what you did yesterday.

### 12. Log exercise burn · needs a decision
Add an activity and the calories it burned, so the today screen shows eaten, burned, and what is genuinely left. Whether burned calories give you more to eat is a real product decision and not just arithmetic.
**Done when:** an activity can be added in a few taps and appears on today; the remaining number reflects it under a rule that is stated in the app; entries can be edited and deleted.
- [ ] Design it (spec): `/architect log exercise burn`

### 13. Meal history
Look back at previous days: what you ate, what you hit, and a simple week view. Seeing a streak of good days is a large part of why people keep logging.
**Done when:** any past day can be opened and shows its meals and totals; a week at a glance shows target versus actual; days with no data read as empty rather than as zero.
- [ ] Build it: `/develop meal history`

## Release 3: Habit and progress

What turns a useful app into a daily one.

### 14. Daily reminders · needs a decision
A gentle nudge to log meals. This is the strongest driver of habit in tracking apps and also the fastest way to get uninstalled, so how often and when it fires matters more than the code.
**Done when:** reminders can be turned on, off, and timed by the user; they respect the phone's notification permission and quiet hours; someone who already logged is not nudged again; tapping one opens the right screen.
- [ ] Design it (spec): `/architect daily reminders`

### 15. Weight tracking & trend
Log your weight now and then and see the line move, with the daily target recalculated as you change. It closes the loop between the effort and the result.
**Done when:** a weight entry can be added and edited; the trend over time is shown; the daily target updates from the newest weight; the trend is presented without shaming a bad week.
- [ ] Build it: `/develop weight tracking & trend`

## Deferred

Out of scope for the current build pass, kept so the plan stays honest.

- **AI coach chat**: ask questions about your intake and progress in plain language · needs a decision
- **Apple Health & Google Fit**: read activity and write nutrition back out · needs a decision
- **Subscription & billing**: paid plans and scan limits, planned for in the data model but not built · needs a decision · GA
- **Barcode scanning**: packaged food from a food database · needs a decision
- **Describe a meal in words**: log by text when a photo is not possible · needs a decision
- **Saved and repeat meals**: log the breakfast you eat every day in one tap
- **Works offline**: log and view without a connection, syncing later · needs a decision
- **Account settings, including changing your password**: spec 0004 deliberately left this out of release 1, because an emailed code means nobody is ever locked out, but there is currently no way to change a password once set · from spec 0004
- **More languages**: English only for now, with text kept out of the screens so this stays cheap

## Legend

**The decision box.** Every feature carries exactly one, the sub task whose label ends with `(spec)`. Its wording varies (`Design it (spec)` normally, `Decide the stack (spec)` on Stack & architecture), so skills locate it by that `(spec)` suffix, never by an exact label. Every other box is an execution box and `/architect` never ticks one.

**Feature lifecycle**: the scope updates as a feature moves; each row is what it shows and who sets it:

| State | Set by | The feature shows |
|---|---|---|
| `planned` · needs a decision | `/scope` | one box: `Design it (spec): /architect <feature>` |
| `in-progress` (designed) | **`/architect` at spec capture** | `Design it` ticked; spec linked; `Build it: /develop <feature>` + **2 to 5 milestones**; the tier's closing boxes (`Verify it` Alpha+, `Test it` Beta+, `Review it` + `Document it` GA); any surfaced follow up enrolled |
| `in-progress` (building) | `/develop` | milestone sub boxes tick one by one; code pointer filled |
| `in-progress` (verified) | `/check verify` | `Build it` + milestones ticked; `Verify it` ticked |
| `done` | **you, when you decide it is** (any skill sets it when you say so); `/sync` reconciles | boxes you ran ticked, skipped ones marked skipped; the tier's last stage (`Prototype` → after `/develop`; `Alpha` → after `/check verify`; `Beta`/`GA` → after `/test`) is the suggested point to call it done; `/sync` captures conventions |

- **Next step** = the first unticked box (always a command or a tracked milestone).
- **needs a decision** = run `/architect` first; otherwise straight to `/develop` (or `/audit` for standards & tooling). The tag drops once the spec is captured.
- **Atomic build tasks live in the spec's `## Build plan`, not here**: the scope carries only the milestone rollup.
- **Status** `planned` → `in-progress` → `done`, plus `existing` (pre workflow) and `dropped` (de scoped, kept for history).
- **Approach tag** beside a heading (e.g. `· Facade`) overrides the project default for that feature; no tag = inherits it.
- **Workflow tier tag** beside a heading (e.g. `· GA`, `· Prototype`) sets that one feature's rigor above or below the project default; no tag inherits the default. It decides the feature's check boxes and each skill's next suggestion.
- **Workflow** (header line) is the project default, what runs after `/develop`: **Prototype** = nothing (trust develop's own build time self check); **Alpha** = `/check verify`; **Beta** = `/check verify` then `/test`; **GA** = adds a fresh model `/check review` then `/document`. A feature built on an unratified decision (an `Assumed` spec) stays flagged, but that never blocks `done`.
- **Pointer line** (`spec <n> · code in <path>`): the spec link added by `/architect`, the code path by `/develop`.
