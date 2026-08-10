# 0006. Reasoning: onboarding and the daily calorie target

The build spec is [index.md](index.md). This file is the decision record. `/develop` skips it.

## Context

> ⚠️ Premise note: the whole product rests on one estimated number, and that number will be
> meaningfully wrong for a large minority of people. Every prediction equation carries an error
> band of roughly plus or minus 10 percent even for the population it was fitted to, and real
> weight loss slows below what a fixed calorie deficit predicts, because resting expenditure falls
> as body mass and lean tissue fall. The failure mode is well known in this product category: a
> person eats to the number, stalls after six weeks, concludes the app is broken, and uninstalls.
> The right framing is that the calculated target is a **starting point that the person is
> expected to adjust**, not an answer the app hands down. That is why the manual override is part
> of this feature rather than a later nicety, why the result screen states the number is an
> estimate, and why scope feature 15 (weight tracking and trend) is the real long term correction.
> Design accordingly: never present the target as authoritative.

CalSnap can show a person how much of their day is left only once it knows how much their day is.
Nothing in the app currently produces that number. Scope feature 5 delivered the account, the
session gate, and sync, and it routes a signed in person with no finished profile to
`src/app/onboarding.tsx`, which is an honest placeholder saying the setup is not built. Feature 9
(the Today screen) and feature 7 (the scan) both need a target to compare against, so this is the
last thing standing between a real account and a usable app.

Most of the storage already exists and cannot be redesigned. Spec 0002 shipped `profiles` with
every answer column this feature collects, `weight_entries` for the first weigh in, and
`daily_targets` with a `formula_version` column reserved explicitly for this feature's decision.
`src/data/local/daily-targets.ts` already implements `getOrCreateDailyTarget` and takes the
calorie formula as a parameter rather than inventing one. So the open question is genuinely narrow:
what the formula is, how the answers are collected, and where a changed target lives.

Three forces constrain the answer sharply. First, the scope's own wording: setup has to feel like
four taps and not a medical form, so every extra question has to earn itself. Second, the schema is
frozen: `profiles` sits inside SQLite migration 2, which has shipped, and
`CORE_DATA_MODEL_FINGERPRINT` fails the test suite the moment a covered declaration changes, so a
new column on `profiles` is not available. Third, this is the point where CalSnap first collects
health data (sex, age, height, weight), which both app stores treat as requiring explicit consent
before collection, and which the project's own rules say must never be presented as more certain
than it is.

Not deciding leaves the app permanently unusable: a person can create an account, sign in, and then
reach a screen that tells them the product is not finished.

## Options considered

### Option 1: Mifflin-St Jeor with an activity multiplier, a pace based deficit, an absolute safety floor, and a dated override table

The setup asks the six questions the schema already has columns for, one per screen, saving each
answer to a local only draft table so an interrupted run resumes. Finishing writes the profile, the
first weigh in, and today's target in one transaction. The target is resting metabolic rate from
Mifflin-St Jeor, multiplied by an activity factor, adjusted by the calorie deficit or surplus the
chosen pace implies, then clamped to a sex based minimum. A separate `target_overrides` table, keyed
by the date the override starts, lets a person set a lasting number of their own.

**Pros**:
- Uses exactly the inputs already collected; no extra question, no extra column on a frozen table.
- Mifflin-St Jeor is the most accurate of the general prediction equations and is what nearly every
  consumer tracker uses, so CalSnap's number will broadly agree with what people have seen elsewhere.
- A dated override preserves spec 0002's invariant that a past day keeps the target it actually had,
  because an override that starts tomorrow cannot reach into yesterday.
- The new table follows the exact path `sync_state` already took, so it needs no new schema
  machinery and no change to a shipped fingerprint.

**Cons**:
- Two new tables for one feature, and two migrations to write and apply.
- The override table is a whole entity carrying essentially one integer, which reads as heavy until
  you need the start date.
- It is the first synced table to deliberately drop a uniqueness guarantee, so more than one live
  row per date is legal and the resolver has to order rather than assume.
- The 7700 kcal per kilogram conversion behind the pace is a linear simplification that overstates
  loss over months.

### Option 2: The same calculation, but the target is only ever computed, with no override

Setup and the formula are identical; a person changes their target by changing their answers, so
every stored target stays fully explained by the formula and its inputs.

**Pros**:
- Simplest data story by a wide margin: one new local only draft table, no new synced table, no
  second source of truth for the number.
- Every target on every past day is reproducible from the profile and the weigh in that produced it.

**Cons**:
- Fails the scope's own "done when" line, which requires a target the person can see **and change**.
- Someone given a number by a dietitian, or anyone who has learned their own maintenance calories
  from experience, cannot use the app as intended.
- Pushes people to lie about their activity level to reach a number they want, which corrupts the
  one input the formula is most sensitive to.

### Option 3: A per day editable target, no override entity

The target stays computed, and today's `daily_targets` row can be edited directly with
`source: 'manual'`, which the column already allows.

**Pros**:
- No new synced table and no new migration for the override at all; `daily_targets.source` already
  has the `manual` value.
- Matches the natural instinct that you are adjusting today.

**Cons**:
- The change silently reverts at local midnight, because tomorrow's row is computed fresh. Every
  user will read that as a bug, and they will be right.
- Offers no way to express "my target is 1800 from now on", which is what people actually mean.

### Option 4: Katch-McArdle, or a body composition aware formula

Calculate from lean body mass rather than total mass, which is the more accurate approach for lean
and athletic people.

**Pros**:
- Genuinely more accurate for the population it fits, and it sidesteps the sex coefficient entirely,
  since lean mass already carries that difference.

**Cons**:
- Needs body fat percentage, which a person cannot supply accurately and which no four tap setup can
  ask for. Estimating it from height and weight reintroduces exactly the error it was meant to remove.
- Would leave the shipped `sex` column collected and unused.

## Rationale

Option 1 is chosen because the constraints in Context leave very little room and it fits them
exactly. The schema is frozen and already holds every input Mifflin-St Jeor needs, so the equation
that matches the collected data is the one that requires no new question and no change to a shipped
migration (basis: spec 0002's `profiles` columns, and `CORE_DATA_MODEL_FINGERPRINT` in
`src/data/local/migrations.ts`). Option 4 is more accurate in principle and unbuildable in practice
here, because it needs an input the four tap constraint forbids.

The override is the part worth defending, because Option 2 is otherwise the cleaner design. It earns
its place for the reason in the premise note: the calculated number will be wrong for many people,
and a product that offers no way to correct it either loses those people or teaches them to falsify
their activity level, which poisons the one input the formula is most sensitive to. Given that the
override has to exist, a **dated** override is the only shape that survives spec 0002's rule that a
past day keeps the target it actually had (basis: spec 0002, key invariants). Option 3's per day
edit fails that test in the opposite direction: it changes nothing durably and reverts overnight.

Putting the override in its own table rather than on `profiles` is forced, not preferred. The
project's rule is that a shipped migration is never edited and a declaration it covers is never
changed, and a new table with its own declaration, its own generator call, and its own fingerprint
is the path `sync_state` already proved (basis: `src/db/AGENTS.md`, the migration conventions).
Teaching the generators to emit column additions would honour the single declaration promise more
purely, and building new schema machinery to carry one integer is not a trade a small project should
make today.

The sex based absolute floor (1200 kcal for female, 1500 for male) is chosen over a floor at
resting metabolic rate because it is the number clinical guidance actually states for unsupervised
dieting, and because it is explainable in one sentence on screen. A floor at resting rate scales
better with body size and still lands below 1200 for a small woman, so it would need the absolute
floor underneath it regardless. Flooring quietly would have been the wrong call: the project's rules
say an uncertain health number says so, so the floor announces itself (basis: `AGENTS.md`, the rule
on health numbers shown to people who act on them).

One part of the override's shape was corrected by a cross check on a second model before this spec
was accepted, and it is worth recording because the reasoning is not obvious. The first draft gave
`target_overrides` a day scoped identifier, copying `daily_targets` and `weight_entries`. That was
wrong. Those tables are day scoped so two offline devices creating the same day converge on one row
instead of colliding on a unique index the conflict rule cannot see, which is right for data that is
created once per day. An override is different in kind: it is set, cleared, and set again for the
same date as ordinary use, and clearing is a tombstone. A deterministic identifier would force the
second set to revive that tombstone, which spec 0005's sticky delete trigger exists specifically to
refuse, and `pushChanges` writes the server's reply back in full, so the override would disappear
silently with nothing failing (basis: spec 0005, and the push write back note in `src/data/AGENTS.md`).
A version 7 identifier removes the collision entirely, and dropping the unique index with it is not a
loss: duplicates for a date are harmless once resolution orders explicitly, which is the same tie
break rule `searchPastItems` already uses. The same latent hazard exists on `weight_entries` and
`daily_targets` today and is recorded as a follow up rather than fixed here.

Macro targets are left null in release 1 deliberately. `daily_targets` reserves the three columns,
the scan will return macros per meal, and choosing a protein, carbohydrate, and fat split is a
nutrition opinion this project has not formed. Shipping the thinnest complete thing and growing it
is the stated build approach (basis: `AGENTS.md`, the Skateboard approach), and one number is the
thinnest complete thing.

## References

**Project sources** (verifiable, in this repo):
- `AGENTS.md`: the Skateboard build approach, the rule that health numbers state their uncertainty,
  the rule that expected failures return a result value, and the accessibility baseline of WCAG AA.
- Spec [0002](../0002-data-model/index.md): the `profiles`, `weight_entries` and `daily_targets`
  declarations, the never recompute invariant on a written target, the day scoped UUID version 5
  rule, and the explicit note that feature 6 owns the formula.
- Spec [0004](../0004-account-and-sign-in/index.md): the session gate that routes an unfinished
  profile to onboarding, and the `text` Clerk identifier with `auth.jwt() ->> 'sub'` policies.
- Spec [0005](../0005-sync-arbitration/index.md): the server owned `updated_at` and sticky tombstone
  triggers that any new synced table must be generated with.
- Spec [0003](../0003-design-system-ui-foundation/index.md): the component set the flow is built
  from, including `RadioRow`, `SegmentedControl`, `Stepper`, `Field`, and `Notice`.
- `src/data/AGENTS.md` and `src/db/AGENTS.md`: the one declaration rule, the fingerprint guard, and
  the rule that a shipped migration is never edited.
- `src/data/local/daily-targets.ts`: the existing `TargetFormula` seam this feature fills.

**Practices & standards**:
- Mifflin-St Jeor (1990), the resting metabolic rate equation adopted here, and the American
  Dietetic Association's evidence review finding it the most reliable of the general prediction
  equations for adults.
- The standard physical activity multipliers applied to resting rate (sedentary through very
  active), as used across dietetic practice.
- The widely applied 7700 kcal per kilogram of body mass conversion, used to turn a weekly pace into
  a daily calorie adjustment, with its known limitation that real loss slows over time as resting
  expenditure falls.
- The commonly stated clinical minimums for unsupervised calorie restriction, 1200 kcal per day for
  women and 1500 for men, used here as an absolute floor.
- Explicit consent before collecting health data, required by both the Apple App Store and Google
  Play for health and fitness apps.
- WCAG 2.2 level AA, the project's accessibility baseline.
