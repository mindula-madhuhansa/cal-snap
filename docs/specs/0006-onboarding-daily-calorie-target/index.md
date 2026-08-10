# 0006. Onboarding and the daily calorie target for CalSnap

**Date**: 2026-08-10
**Status**: Proposed

## Summary

A new person answers six short questions, one per screen, and the app works out how many calories
they should eat each day. The number comes from Mifflin-St Jeor, a published equation that estimates
how many calories a body burns at rest, scaled by how active the person is and adjusted by how fast
they want to lose or gain. It is never allowed below a safe minimum, and it is presented as an
estimate they can change rather than a verdict. Nothing already shipped is edited: two new tables
carry the in progress answers and a lasting manual target.

## Requirements

**User stories**:
- As a new person, I want to answer a few plain questions so the app knows how much I should eat,
  without it feeling like filling in a medical form.
- As someone the estimate does not fit, I want to set my own daily target and have it stick.
- As someone interrupted halfway through setup, I want to carry on where I left off.
- As someone whose life changed, I want to update my activity level or pace without redoing setup.

**Acceptance criteria** (the contract, each independently checkable):

- **AC-1**: A signed in person whose `profiles.onboarded_at` is null lands on the setup flow. One
  whose profile is complete never sees it again, including on a second device where the profile
  arrived by sync.
- **AC-2**: Setup asks, one question per screen with visible progress and a working back step:
  consent, sex, age, height, weight, activity level, goal direction, and goal pace. Nothing else is
  asked. A person answering without hesitation finishes in under a minute.
- **AC-3**: The consent step comes before the first health question and states plainly what is
  collected and why. Accepting it writes `profiles.consented_at` and `profiles.consent_version`.
  Setup cannot continue without it.
- **AC-4**: Height and weight open in the unit family implied by the device locale (imperial in the
  US and UK, metric elsewhere), switchable inline on the field itself. Storage is always centimetres
  and kilograms whatever was typed, and `profiles.unit_preference` records what the person used.
- **AC-5**: Every answer is written to `onboarding_draft` the moment it is given. Force quitting and
  reopening the app returns the person to the question that was next, with earlier answers intact.
- **AC-6**: Finishing setup writes, inside one transaction: the complete `profiles` row with
  `onboarded_at`, `age_recorded_on`, and `timezone`; a `weight_entries` row with
  `source: 'onboarding'`; and today's `daily_targets` row. The `onboarding_draft` row is then
  deleted. A failure at any point leaves the person on the last screen with an honest message and
  the draft intact.
- **AC-7**: The computed target is Mifflin-St Jeor resting rate, times the activity multiplier for
  the stored `activity_level`, plus or minus the daily calorie change the goal pace implies, rounded
  to a whole number, stored with `formula_version: 'mifflin-st-jeor-v1'` and `source: 'computed'`.
  The same inputs always produce the same number.
- **AC-8**: The target is never below 1200 kcal for a female profile or 1500 for a male one. When
  the floor binds, the result screen says in plain words that the pace was reduced to keep the
  target safe, and names the pace actually being applied.
- **AC-9**: The result screen states the target in one plain sentence naming the goal it serves, plus
  an expandable detail naming the formula and saying the number is an estimate that may need
  adjusting. The number is never presented as fact.
- **AC-10**: A target override with `effective_from` set to a date makes every day from that date
  forward use it, stored with `source: 'manual'`. Clearing it returns later days to computed. Days
  before `effective_from` are unaffected, and so is any day whose row already exists.
- **AC-10b**: Setting an override, clearing it, and setting a new one for the same date works, and
  the new one survives a sync. No cleared override is ever revived.
- **AC-11**: No change to a profile answer, and no override, ever rewrites a `daily_targets` row
  that already exists. Setting either says in plain words that the new target starts tomorrow.
- **AC-12**: Settings carries a "Your goal" section showing today's target, whether it is computed or
  manual, and paths to change any answer, to set an override, and to clear one.
- **AC-13**: `onboarding_draft` exists only in SQLite: it is absent from the generated Postgres
  schema and never appears in a sync push. `target_overrides` exists in both, syncs, and carries the
  row level security policy and the spec 0005 arbitration triggers like every other synced table.
- **AC-14**: `CORE_DATA_MODEL_FINGERPRINT` and `SYNC_STATE_FINGERPRINT` are unchanged by this work,
  and the schema parity check passes with the new tables present.
- **AC-15**: Every screen meets WCAG AA: labelled controls, touch targets of at least 44 points,
  correct behaviour at the largest system font size, and the result sentence announced to a screen
  reader rather than only drawn.
- **AC-16**: Answers that pass the schema checks but look physiologically unusual are accepted and
  calculated. Nothing blocks, warns, or lectures; the safety floor is the only intervention.
- **AC-17**: Signing out during setup discards the draft along with the per account database file.
  Signing back in starts setup from the first question.

## Decision

**Chosen option**: Option 1: Mifflin-St Jeor with an activity multiplier, a pace based deficit, an
absolute safety floor, and a dated override table.

Setup collects the six answers `profiles` already has columns for, one question per screen, drafted
locally as it goes; the daily target is computed by a pure Mifflin-St Jeor function clamped to a sex
based minimum, and a person can supersede it from any date onward with a row in a new
`target_overrides` table.

**Implementation skills**: `expo-native-ui` (`expo/skills`, `.agents/skills/expo-native-ui/`) ·
`supabase-postgres-best-practices` (`supabase/agent-skills`,
`.agents/skills/supabase-postgres-best-practices/`) · `supabase` (`supabase/agent-skills`,
`.agents/skills/supabase/`)

## Rationale

Reasoning, the options weighed, and the premise challenge: see [rationale.md](rationale.md).

## Feature design

### Data model sketch

Nothing already declared is edited. `profiles`, `weight_entries`, and `daily_targets` are used
exactly as spec 0002 shipped them, which is what keeps `CORE_DATA_MODEL_FINGERPRINT` green (AC-14).

**New table `target_overrides`** · `presence: 'both'` · `timestamps: true` · `softDelete: true`

| Column | Type | Rule |
|---|---|---|
| `id` | `uuid` | primary key. UUID **version 7**, a fresh identifier per row, via the same `IdSource` every event shaped table uses. Deliberately **not** the day scoped version 5 the other date keyed tables use; see the note below, this is load bearing |
| `user_id` | `text` | required, the Clerk `sub`. No foreign key, as everywhere else |
| `effective_from` | `date` | required, the first local date this target applies to |
| `calories` | `integer` | required, check greater than 0 |
| `created_at`, `updated_at`, `deleted_at` | `timestamptz` | the standard lifecycle set. Clearing an override is a tombstone, so the clearing syncs |

Indexes: `(user_id, effective_from)`; `(user_id)`. **No unique index**, on purpose.

**Why not a day scoped identifier here.** `daily_targets` and `weight_entries` derive their identifier from
the user and the date, so two offline devices creating the same day produce one row rather than colliding
on a unique index the conflict rule cannot see. Copying that here would be a bug. An override is set,
cleared, and set again for the same date as an ordinary user action, and clearing it is a tombstone. A
deterministic identifier means the second set has to revive that exact row, which spec 0005's sticky
tombstone trigger refuses to do: the push would come back as the tombstone, `pushChanges` would write that
whole row back into SQLite, and the person's new override would vanish with no error at all.

Version 7 avoids it completely, because a cleared override is never the row a later one writes. The unique
index goes with it: two offline devices each setting an override for the same date now produce two live
rows, which is fine, because resolution orders rather than assuming one. The rule is the newest live row
with `effective_from <= on_date`, ordered `(effective_from DESC, updated_at DESC, id DESC)`, which is the
explicit tie break `src/data/AGENTS.md` already requires wherever `created_at` can tie.

**New table `onboarding_draft`** · `presence: 'sqlite'` · `timestamps: true` · `softDelete: false`

| Column | Type | Rule |
|---|---|---|
| `user_id` | `text` | primary key |
| `current_step` | `text` | required, which question comes next |
| `sex`, `age_years`, `height_cm`, `weight_kg`, `activity_level`, `goal_direction`, `goal_rate_kg_per_week`, `goal_weight_kg`, `unit_preference`, `consented_at` | as on `profiles` and `weight_entries` | **all nullable**, which is the whole point: a partial answer set is impossible in `profiles`, where every one of these is `NOT NULL` |
| `created_at`, `updated_at` | `timestamptz` | |

Local only, so it never reaches Postgres and never enters a push (AC-13). It lives inside the per
account database file, which is what makes AC-17 free.

**Relationships**: everything keys on `user_id`, the Clerk identifier. `profiles` and
`onboarding_draft` are one row per user; `target_overrides`, `weight_entries`, and `daily_targets`
are many. Nothing references anything, because identity lives at Clerk.

### State transitions

Onboarding, held in `onboarding_draft.current_step`:

`consent → sex → age → height → weight → activity → goal direction → goal pace → result`

Forward only on an answered question, backward freely. Every transition writes the draft first
(AC-5). `result` is terminal: leaving it commits (AC-6) and deletes the draft. There is no path back
into the flow once `profiles.onboarded_at` is set; changing an answer later re-enters the same
question screens from Settings in single question mode, never as a flow (AC-12).

A day's target has no state machine. It is written once and never recomputed (spec 0002), which is
precisely why a change starts tomorrow (AC-11).

### The calculation, in full

The builder invents none of these numbers.

**Resting metabolic rate**, Mifflin-St Jeor, kilograms and centimetres:

```
rmr = 10 × weightKg + 6.25 × heightCm − 5 × ageYears + s
  where s = +5 for male, −161 for female
```

**Activity multiplier**, a frozen constant table keyed by the five stored `activity_level` values:

| `activity_level` | Multiplier | Shown on screen as |
|---|---|---|
| `sedentary` | 1.2 | Mostly sitting |
| `light` | 1.375 | On my feet some of the day |
| `moderate` | 1.55 | On my feet most of the day, or I train a few times a week |
| `active` | 1.725 | Physically demanding days, or I train most days |
| `very_active` | 1.9 | Hard physical work, or I train twice a day |

**The daily change from the pace**: `goal_rate_kg_per_week × 7700 ÷ 7`, subtracted for `lose`,
added for `gain`, and exactly zero for `hold` (where `goal_rate_kg_per_week` is 0 by its default).

**Order of operations**, which matters at values near the floor:

```
maintenance = rmr × multiplier
raw         = maintenance − change     (or + for gain)
rounded     = roundCalories(raw)       (calculations/rounding.ts, whole number)
calories    = max(rounded, floor)      floor = 1200 female, 1500 male
```

Rounding happens before clamping, so a bound floor is exactly 1200 or 1500 and never 1199 or 1201.
`flooredFrom` is set to `rounded` only when the clamp actually moved the number.
`effectiveRateKgPerWeek` is then inverted from the number really being applied,
`(maintenance − calories) × 7 ÷ 7700`, which is what AC-8 puts on screen.

**Reference value the test holds to**: a 35 year old female, 165 cm, 70 kg, `moderate`, losing at
0.5 kg per week. RMR is 1395.25, maintenance is 2162.6375, the daily change is 550, so the raw
number is 1612.6375 and the target is **1613 kcal**, with no floor applied.

### API surface

Local functions, not HTTP. There is no new server endpoint: `target_overrides` reaches Postgres
through the existing `runSync`.

| Function | Module | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `computeCalorieTarget` | `data/calculations/calorie-target.ts` | `sex`, `ageYears`, `heightCm`, `weightKg`, `activityLevel`, `goalDirection`, `goalRateKgPerWeek` | `{ calories, formulaVersion, effectiveRateKgPerWeek, flooredFrom? }` | pure, none | none. Returns `undefined` only when weight is absent |
| `readDraft` | `data/local/onboarding.ts` | `userId` | the draft row or `undefined` | local session | database failure returns `{ kind: 'failed', message }` |
| `saveDraftStep` | `data/local/onboarding.ts` | `userId`, the answered field, `nextStep` | `{ kind: 'ok' }` | local session | database failure returns a result value |
| `completeOnboarding` | `data/local/onboarding.ts` | `userId`, the full answer set, `timezone`, `consentVersion`, `idSource` | the written `DailyTarget` | local session | incomplete draft; transaction failure, both returned, never thrown |
| `resolveOverride` | `data/local/target-overrides.ts` | `userId`, `onDate` | the newest live override at or before the date, or `undefined` | local session | database failure returns a result value |
| `setOverride` | `data/local/target-overrides.ts` | `userId`, `effectiveFrom`, `calories`, `idSource` | the written row | local session | calories not greater than 0. **Never an upsert**: it tombstones every live row for that date, then inserts a fresh version 7 row, all in one transaction |
| `clearOverride` | `data/local/target-overrides.ts` | `userId`, `effectiveFrom` | `{ kind: 'ok' }` | local session | no live override to clear. Tombstones **every** live row for that date, since more than one can exist |
| `updateProfileAnswers` | `data/local/profile.ts` | `userId`, a partial answer set | the updated profile | local session | no profile row; a value outside its column's bounds. Writes straight to `profiles`, sets `is_dirty` and moves `updated_at` together, never through the draft |
| `getOrCreateDailyTarget` | `data/local/daily-targets.ts`, **existing, extended** | `userId`, `onDate`, `formula` | the day's target | local session | profile not onboarded, unchanged. No live weigh in returns the existing failure result |

Two existing types change, which is code and not schema, so no fingerprint moves: `TargetInputs`
gains the override resolved for `onDate`, and `ComputedTarget` gains `source`, because
`getOrCreateDailyTarget` currently writes `'computed'` as a literal.

### Value sourcing

| Action | Value produced or displayed | Source |
|---|---|---|
| `completeOnboarding` | `profiles.timezone` | the device IANA zone read once at completion, at the Expo edge, passed in as an argument |
| `completeOnboarding` | `profiles.age_recorded_on` | today's local date from `calculations/local-day.ts`, using that timezone |
| `completeOnboarding` | `weight_entries.weight_kg` | the weight answer, converted to kilograms by `calculations/units.ts` at the input edge, never on the write path |
| `completeOnboarding` | `weight_entries.on_date`, `recorded_at` | the same local date, and the wall clock instant |
| `completeOnboarding` | `profiles.consent_version` | `CONSENT_VERSION`, a constant in `src/config/`. Feature 10 replaces its value when the real policy text lands |
| `completeOnboarding` | `daily_targets` row for today | `getOrCreateDailyTarget` with the new formula, so the number shown is the number stored |
| `computeCalorieTarget` | resting metabolic rate | Mifflin-St Jeor over `sex`, `age_years`, `height_cm`, and the weight |
| `computeCalorieTarget` | the activity multiplier | a frozen constant table in `calorie-target.ts`, keyed by the five `activity_level` values |
| `computeCalorieTarget` | the daily calorie change | `goal_rate_kg_per_week` times 7700 divided by 7, added for `gain`, subtracted for `lose`, zero for `hold` |
| `computeCalorieTarget` | the safety floor | `profiles.sex`: 1200 female, 1500 male, constants in `calorie-target.ts` |
| `computeCalorieTarget` | `flooredFrom` | the rounded pre clamp number, present only when the clamp moved it, so the screen can say what changed (AC-8) |
| `computeCalorieTarget` | `effectiveRateKgPerWeek` | inverted from the number actually applied: `(maintenance − calories) × 7 ÷ 7700`. This is the pace AC-8 names on screen, and it equals the requested pace whenever the floor did not bind |
| `getOrCreateDailyTarget` | `daily_targets.source` | `'manual'` when `resolveOverride` returns a row for that date, else `'computed'` |
| `getOrCreateDailyTarget` | the weight used | unchanged: the newest live `weight_entries` at or before `on_date` |
| unit field default | metric or imperial | the device locale region, read at the Expo edge and passed in; never inferred inside a pure function |
| result and Settings | "starts tomorrow" date | tomorrow's local date derived from `profiles.timezone` through `calculations/local-day.ts` |
| Settings, "Your goal" | today's target and whether it is manual | the existing `daily_targets` row for today, its `calories` and `source` |

### Key invariants

- `profiles` holds only complete answer sets. A row exists only when every required answer is
  known, which is what `onboarding_draft` exists to make possible.
- `onboarded_at` is non null if and only if a `weight_entries` row with `source: 'onboarding'` and a
  `daily_targets` row for that same date exist. All three are written in one transaction.
- `computeCalorieTarget` is pure: same inputs, same output, no clock, no randomness, no storage.
- The returned target is never below the floor for the profile's sex, and clamping happens after
  rounding, so a bound floor is exactly the floor.
- `onboarded_at` being set implies at least one live `weight_entries` row exists, by AC-6. If every
  weigh in were somehow deleted, `getOrCreateDailyTarget` returns its existing readable failure
  rather than inventing a weight, and whatever screen asked shows that sentence.
- **More than one live `target_overrides` row may exist for a date, and that is legal.** Resolution
  orders rather than assuming uniqueness. A tombstoned override is never revived; a new one is
  always a new row.
- A written `daily_targets` row is never updated by this feature. Every change is forward dated.
- **An override is read only at the moment a day's `daily_targets` row is first created.** That is
  what makes a backdated `effective_from` harmless: it cannot reach a day already written, and it
  applies to any day from that date that has not been created yet. Settings only ever offers
  tomorrow, so the backdated case arises only from a device whose clock or timezone moved.
- Every input screen enforces the same bounds as its column's `checks` (age 13 to 120, height above
  zero, weight 20 to 500, pace 0 to 1.5), so a check constraint violation is unreachable and a
  person never sees a generic transaction failure where a specific message belongs.
- Height is centimetres and weight is kilograms in storage, always. `calculations/units.ts` is a
  display and input concern only, never called on a write path.
- `onboarding_draft` never appears in the generated Postgres schema and never in a push payload.

### Security model

Health data: sex, age, height, weight, and an activity level, all of it identifying enough to matter.
Ownership is the whole model, and it is enforced in three places that already exist. On the phone,
each account has its own SQLite file, and every query still filters `user_id` as the second defence.
In Postgres, `target_overrides` gets the same policy shape as every other table,
`(user_id = (select auth.jwt() ->> 'sub'))`, never `auth.uid()`, which returns null under Clerk and
would silently match nothing. Over the wire, the Supabase client always carries a Clerk token.

Compliance scope: consent before health data collection, required by both app stores for a health
app, is what AC-3 discharges. `consented_at` and `consent_version` are the record. There is no
regulated scope beyond that here: CalSnap is not a covered medical product and stores no clinical
record. Account deletion, which removes all of this, belongs to scope feature 10.

No audit log is added. The mutations here touch neither money nor access control, and every write is
already timestamped and synced.

### Configuration required

No new environment variables and no new third party credentials. `CONSENT_VERSION` is a source
constant in `src/config/`, not configuration, because a policy version has to be pinned in the
build that displayed the policy.

### Critical test scenarios

- Happy path: a signed in person with no profile answers all eight screens and lands on a target;
  `profiles`, `weight_entries`, and `daily_targets` all exist afterwards and the draft does not,
  verifies **AC-2**, **AC-6**, **AC-9**.
- Formula: the reference profile above (35, female, 165 cm, 70 kg, moderate, 0.5 kg per week) yields
  exactly 1613, held to that literal in the test, verifies **AC-7**.
- Floor: a small, light female profile on the fastest pace lands exactly on 1200 with `flooredFrom`
  set and `effectiveRateKgPerWeek` below the requested pace, and the screen names that slower pace,
  verifies **AC-8**, **AC-16**.
- Bounds: an answer at each column's boundary (age 13 and 120, pace 0 and 1.5) is accepted by both
  the screen and the write, and one past it is stopped by the screen with its own message rather
  than by the check constraint, verifies **AC-16**.
- Resume: answers are written for the first three steps, the process is dropped, and reading the
  draft returns those three answers and the fourth step, verifies **AC-5**.
- Failure case: the completing transaction fails partway; no `profiles` row exists, the draft
  survives intact, and a readable message is returned rather than thrown, verifies **AC-6**.
- Override: an override effective tomorrow leaves today's existing row untouched and makes
  tomorrow's row `manual` with that number; clearing it returns the day after to `computed`,
  verifies **AC-10**, **AC-11**.
- Override revival: set, clear, then set again for the same date, and drive it through the fake
  server in `test/support/fake-server.ts`, which models the sticky tombstone. The second override
  survives the round trip and the row written back is not a tombstone, verifies **AC-10b**.
- Backdating: an override whose `effective_from` is a past date whose target already exists leaves
  that target untouched, verifies **AC-10**, **AC-11**.
- Missing weight: a profile with `onboarded_at` set but every weigh in tombstoned returns the
  readable failure rather than a target computed from a guessed weight, verifies **AC-6**.
- Schema: both fingerprints are unchanged, parity passes, `onboarding_draft` is absent from the
  Postgres output, and `target_overrides` carries both arbitration triggers, verifies **AC-13**,
  **AC-14**.
- Auth and permission: a second account's identifier reads no draft, no override, and no profile,
  and the Postgres policy on `target_overrides` denies a token whose `sub` differs, verifies
  **AC-13**.

## Build plan

Ordered the Skateboard way. Slice 1 makes the number real with no screens at all, so the calculation
can be proven at a desk. Slice 2 is the thinnest setup a person can actually finish. Slice 3 makes
the number changeable, which is what the premise note says the product depends on. Slice 4 makes it
hold up. One migration covers both tables, because they ship together.

**Slice 1: the number, headless**

1. Declare `target_overrides` and `onboarding_draft` in `src/data/schema/tables/`, add SQLite
   migration 4 generated by `toSqlite([targetOverrides, onboardingDraft])` with its own fingerprint,
   and generate the Postgres migration file for `target_overrides` alone, with its row level security
   policy and its spec 0005 arbitration triggers. Extend the parity test to cover it, satisfies
   **AC-13**, **AC-14**.
2. Write `src/data/calculations/calorie-target.ts`: pure Mifflin-St Jeor, the frozen activity
   multiplier table, the pace to daily calories conversion, and the rounding then clamping order
   returning `flooredFrom` and `effectiveRateKgPerWeek`, all to the numbers in *The calculation, in
   full*. Tests beside it pinning the reference value and each boundary, satisfies **AC-7**,
   **AC-8**, **AC-16**.
3. Write `src/data/local/target-overrides.ts` (`resolveOverride` with its explicit ordering,
   `setOverride` tombstoning then inserting a fresh version 7 row, `clearOverride` tombstoning every
   live row for the date), extend `TargetInputs` with the resolved override and `ComputedTarget`
   with `source`, and make `getOrCreateDailyTarget` write that source instead of the `'computed'`
   literal, satisfies **AC-10**, **AC-10b**, **AC-11**.

**Slice 2: a setup a person can finish**

4. Write `src/data/local/onboarding.ts`: `readDraft`, `saveDraftStep`, and `completeOnboarding`
   writing profile, weigh in, and today's target in one transaction and deleting the draft,
   satisfies **AC-5**, **AC-6**, **AC-17**.
5. Build the question screens under `src/app/onboarding/` from the design system only (`RadioRow`
   for sex, activity, and goal direction, `Stepper` and `Field` for the numbers,
   `SegmentedControl` for the pace), with the progress indicator and the back step, satisfies
   **AC-2**, **AC-15**.
6. Add the locale driven unit default with the inline unit toggle on height and weight, converting
   through `calculations/units.ts` at the field edge and recording `unit_preference`, satisfies
   **AC-4**.
7. Add the consent step ahead of the first health question, writing `consented_at` and
   `CONSENT_VERSION`, with placeholder policy copy that feature 10 replaces, satisfies **AC-3**.
8. Build the result screen: the plain sentence, the floor sentence when it bound, and the
   expandable detail naming the formula and calling it an estimate, satisfies **AC-8**, **AC-9**.
9. Replace the `src/app/onboarding.tsx` placeholder with the real entry point, resuming from
   `current_step`, and confirm the session gate routes to it and away from it correctly, satisfies
   **AC-1**, **AC-5**.

**Slice 3: a number you can change**

10. Write `src/data/local/profile.ts`'s `updateProfileAnswers`, then add the "Your goal" section to
    Settings: today's target and its basis, single question edit paths reusing the same screens, and
    setting or clearing an override, each confirming that the change starts tomorrow, satisfies
    **AC-10**, **AC-11**, **AC-12**.

**Slice 4: make it hold**

11. Write every failure message out in full (draft write failure, transaction failure, override
    write failure), run the accessibility sweep across all nine screens including the largest font
    size and the announced result, and confirm on a development build that a fresh second device
    receives the profile and the override and skips setup, satisfies **AC-1**, **AC-6**, **AC-13**,
    **AC-15**.

## Consequences

**Positive**:
- The app becomes usable end to end: an account leads to a target, which is what feature 7 and
  feature 9 both need.
- The formula is a pure function with the effects passed in, so it is fully testable at a desk, which
  is the same seam spec 0002 deliberately left open.
- A past day keeps the target it was actually eaten against, because every change is forward dated.
  History stays honest without any special case.
- The person can correct a number the app got wrong, which is the difference between a plateau being
  the app's fault and being something they can act on.
- Nothing shipped is edited, so both fingerprints and the applied migrations stay exactly as they are.

**Negative and tradeoffs**:
- Two new tables and two new migration files, one of them applied to the live database, for a
  feature whose visible output is a single integer.
- `target_overrides` is a whole synced entity carrying essentially one number, and it can conflict
  across devices like any other row.
- The 7700 kcal per kilogram conversion is a linear model of a non linear process. Someone on a
  0.75 kg per week pace will lose less than that after a couple of months, and the app has no way to
  tell them why until feature 15 lands the weight trend.
- Nine screens, each needing accessibility work and each needing to survive the largest system font
  size, is the largest UI surface built so far.
- The manual override means two different explanations for where a target came from, in Settings and
  wherever a past day is shown later.
- The sex question offers only female and male, because the equation has only two coefficients. That
  is a real limitation stated plainly on screen rather than solved.

**Neutral**:
- Macro columns on `daily_targets` stay null through release 1. Nothing breaks; anything reading them
  must handle absence, which it already must.
- `formula_version` becomes load bearing for the first time. A future formula ships as
  `mifflin-st-jeor-v2` or a different name, and old rows keep saying what produced them.
- Consent copy is a placeholder until feature 10. The columns and the version constant are real from
  day one, so no migration is needed when the real text arrives.
- `goal_weight_kg` is collected and stored but unused in release 1; feature 15 is what reads it.

## Follow-up

- [ ] **`weight_entries` and `daily_targets` carry the same tombstone revival hazard this spec had
      to design around, and nothing has fixed it.** Both are day scoped (a deterministic version 5
      identifier) and soft deletable, so deleting a weigh in and adding another the same day, or
      deleting a target and letting it be recreated, produces a push the sticky tombstone trigger
      refuses, which `pushChanges` then writes back as a tombstone with no error shown. This spec
      does not touch either table, so it is left as found rather than widened, but it is a real
      latent data loss path and belongs on the scope as its own decision.
- [ ] `CONSENT_VERSION` ships with placeholder policy copy. Feature 10 must replace the copy **and**
      bump the constant, or people will be recorded as having consented to text they never saw.
- [ ] The spec 0002 follow up asking for a guard in `schema/to-postgres.ts` against `auth.uid()`
      becomes more valuable here, because this feature adds the first new policy since that risk was
      identified.
- [ ] Feature 15 (weight tracking and trend) is the real correction for the linear pace model. When
      it lands, decide whether a stalled trend should prompt the person to adjust their target, and
      record that as its own decision.
- [ ] Macro targets are deferred, not dropped. The three `daily_targets` columns stay reserved; a
      later spec decides the split.
- [ ] Consider whether changing an answer should offer to backfill nothing at all, as decided here,
      or to write tomorrow's target immediately rather than lazily. Left to `/develop`; both satisfy
      **AC-11**.
