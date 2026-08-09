# 0002. Core data model, rationale

The decision record behind [index.md](index.md). Nothing here is needed to build; it explains why the model is shaped the way it is.

## Context

> ⚠️ Premise note: two prerequisites this model rests on have no spec yet. Feature 5 owns sign in and therefore owns what `auth.users` actually is, and feature 6 owns the formula that produces a daily target. This spec proceeds by naming both as explicit constraints (the auth user is the single identity, and `daily_targets.formula_version` is reserved for whatever feature 6 decides) rather than by guessing at either. If feature 5 chooses something other than Supabase Auth, every foreign key in this model changes.

CalSnap keeps a person's food diary in two databases at once. Spec 0001 settled that shape: SQLite on the phone so no screen ever waits on a network, and Supabase Postgres in the cloud so a new phone does not mean a lost history, with sync written by hand rather than delegated to a sync engine. That decision is what makes the data model expensive to get wrong. A schema mistake in a single database app is one migration. Here it is two migrations that must agree, plus sync code that assumed the old shape.

The scope calls this the most expensive thing in the product to get wrong, and it is right for a second reason: people will have real diaries in it. Once someone has logged three months of meals, a change to how a meal is stored is a change applied to their data, not to an empty table. The model therefore has to be designed for everything through release 3 (exercise in release 2, weight in release 3) even though only release 1 gets built, and the scope explicitly asks for billing to be planned for without being built.

Three forces shaped almost every column. The first is that a calorie diary is organised by day, and a day is a local calendar date rather than a span of hours. Someone eating at 23:50 means that meal to count against the day they were awake for, and someone flying between timezones does not expect yesterday's lunch to move. The second is that rows are created on a phone that may be offline and may not be the only phone, so identity, ordering, and deletion all have to work without a server present to arbitrate. The third is honesty: the project's own rules say a health number reaches someone who acts on it, so an uncertain value must be able to say it is uncertain. That is a schema requirement, not a UI one, because once a number is saved a guess and a typed value are indistinguishable unless the schema separates them.

The product design at `docs/design/CalSnap.dc.html` also turned out to be a source of decisions rather than just a look. It names meal categories, a day streak, an "add by hand" food search, and states plainly that burned calories return to the day's allowance. Each of those is a schema commitment, and each was read out of the design rather than invented here.

Finally, compliance. This is health data by any ordinary reading: weight, height, age, sex, and a complete record of what someone eats. It is not medical data, because nothing here is a clinical record and no clinician touches it, but both app stores treat health apps as a category with rules, and consent, deletion, and export have to be supported by the schema rather than bolted on once there are real users.

## Options considered

### Option 1: hand write both schemas, with a test that compares them

Write the SQLite migration and the Supabase migration separately, each idiomatic in its own dialect, and add a test that reads both and asserts the columns match.

**Pros**

- No generator to build, own, or debug. Each migration file reads naturally to anyone who knows that database.
- The test still catches drift, and it is cheap to write.
- Zero abstraction between the engineer and the SQL that actually runs.

**Cons**

- The test tells you about drift after you have written the mistake, and only if you remember to keep the test's own list of tables current.
- Every schema change is two edits in two dialects, which is exactly the moment a column gets forgotten.
- The TypeScript types are a third hand written thing that can disagree with both.

### Option 2: one TypeScript declaration per table, generating both schemas

Declare each table once as plain data (columns, types, nullability, checks, indexes), and write two pure functions that turn a declaration into SQLite DDL and Postgres DDL, plus one that derives the TypeScript type.

**Pros**

- Drift becomes impossible rather than detectable. There is one place a column can exist.
- The declarations are plain data and the generators are pure functions, so both test without a phone and without a database, which is exactly what the project's rules ask for.
- The row type, the SQLite table, and the Postgres table cannot disagree, because all three come from the same source.
- Dialect differences (no `numeric` in SQLite, no `jsonb` in SQLite, `boolean` as an integer) are handled once, in one function, instead of being remembered at every table.

**Cons**

- It is a layer you own. A bug in the generator lands in both databases at once.
- The declarations are less immediately readable than SQL to someone who wants to know what the table looks like, until the generated files are checked in beside them.
- It is more upfront work than writing two migrations, and the payoff only arrives on the third or fourth schema change.

### Option 3: an ORM covering both databases

Adopt a library that already speaks both SQLite and Postgres and generates migrations for each from one model definition.

**Pros**

- Someone else maintains the generator, the dialect differences, and the migration tooling.
- Query building and types come along with it.
- Well travelled path with documentation and community answers.

**Cons**

- Spec 0001 explicitly chose no ORM and no migration library, for the local database. Reversing that here is a stack decision, not a data model decision.
- The two databases are used very differently: SQLite is queried constantly by screens, Postgres is only ever written and read by sync. An abstraction that treats them the same hides that asymmetry.
- It adds a dependency to a mobile bundle for a schema with eight tables.

### Option 4: Postgres is the full model, SQLite is a lean denormalised cache

Design the real model in Postgres only, and give the phone a flattened cache shaped for the screens that read it.

**Pros**

- Each side is optimal for its job: normalised and constrained in the cloud, wide and fast on the phone.
- Screen reads need no joins at all.

**Cons**

- Two models, not one, so sync becomes a translation layer with its own bugs and its own tests.
- The phone is where every write starts, so the "cache" is actually the source of truth for new data, which makes the naming a lie and the reconciliation harder.
- Any schema question now has two answers.

## Rationale

Option 2 wins on the specific force that dominates this decision: two databases that must agree, changed by one person, over a product whose scope already names three releases of schema growth. Option 1 is the honest, cheap alternative and it would be the right pick for a schema that changes twice and then settles. This one will not settle. Between release 1 and release 3 the scope adds exercise and weight, and the deferred list adds barcode products, saved meals, and a coach. Each of those is a schema change made twice, and the test in Option 1 only fires after the mistake is written and only if its own table list was kept current. That is a maintenance burden that quietly decays, which is the failure mode the scope was warning about when it called this the most expensive thing to get wrong.

Option 2 also lands squarely on the project's stated rules rather than fighting them. Table declarations as plain data and generators as pure functions is precisely "pure by default, side effects at the edges": the whole schema layer becomes testable with no phone, no simulator, and no database, which is the same property that made the calorie calculations worth keeping pure. The generator's cost is real and it is bounded, because it only has to handle the eight tables and the handful of types this product actually uses, not the general case an ORM must cover.

Option 3 was rejected on a boundary rather than on merit. Spec 0001 already decided no ORM and no migration library, with reasons, and reopening that is a stack decision that belongs in an architecture spec if it is to be reopened at all. Option 4 was rejected because it inverts where writes begin: in a local first app the phone is where data is born, so calling its store a cache would be wrong in a way that misleads every later reader.

Two choices inside the model deserve their own defence, because both go against ordinary good practice.

**Soft deletes.** The standard advice is that soft deletes are wrong: they pollute every query, they break unique constraints, and they leave ghost data. All three are true here, and the model pays each cost, with `deleted_at is null` on every read and partial unique indexes on `daily_targets` and `weight_entries`. Offline sync leaves no alternative. Without a tombstone, a device that was offline when a meal was deleted has no way to distinguish a row that was removed from a row it has not yet been told about, so the deleted meal comes back on the next pull. The separate deletions log alternative moves the ghost data rather than removing it, and adds a second thing to keep in step. The 90 day sweep is what keeps this bounded: the cost is paid for three months per deleted row, not forever.

**A stored daily target.** The general rule is never to compute and store a derived value, because stored derivations go stale. The daily target looks like a violation and is not one, because it is not a cache of a current calculation. It is a record of what was true on a particular day. When someone loses five kilograms their target changes, and a June diary entry must still show June's target or the history becomes a lie that flatters the present. Every other total in the model does follow the rule: meal totals and day totals are sums computed on read, with nothing stored to drift.

The remaining choices follow from the three forces in Context with less argument. `eaten_on` as a stored local date, decided once at save time, is what makes "today" a simple equality match and what stops a flight rewriting last week. UUID version 7 generated on the device is what lets a row be named while offline, with time ordering so the indexes do not fragment the way version 4 would. Text with a check constraint rather than a native Postgres enum is what keeps the two dialects identical, since SQLite has no enum at all. And row level security with `auth.uid()` wrapped in a subselect, with `user_id` indexed on every table and carried on `meal_items` so no policy joins, is the installed Postgres skill's guidance applied directly; it is also the only way to satisfy the scope's requirement that one person can never read another's data without depending on every query being written correctly forever.

## Evidence: the cross check, and what it changed

An independent model reviewed this spec before it was accepted, looking for values the spec required but never sourced. It found eight, and all eight were applied rather than argued with. Recorded here because each one is a decision, not a typo, and a later reader deserves to know it was deliberate.

| Gap it found | What it would have cost | Resolution written into the spec |
|---|---|---|
| AC-6 promised a hand typed value would stop rescaling, with no column recording which field was typed | AC-6 was not buildable as written, and adding the column after real diaries exist is the exact breaking migration this spec claims to prevent | `meal_items.edited_fields` |
| Two offline devices could create a target or weigh in for the same day with different identifiers | They collide on the unique index, where the conflict rule cannot see them, breaking the one row per day invariant | Deterministic UUID version 5 identifiers for `daily_targets` and `weight_entries` |
| Newest write wins could resurrect a deleted row | Direct contradiction of AC-5 | Deletion is sticky and always wins |
| The pull watermark had no home | The builder would invent one | The SQLite only `sync_state` table |
| AC-16 required a stable paging order that was never defined | Rows skipping or repeating during paging | Keyset orders named per read path |
| The remaining calories formula used burned calories that do not exist in release 1 | A value with no source on the most important screen | Burned reads zero until release 2 |
| AC-10 claimed a cascade would remove photos | A foreign key cannot reach Supabase Storage, so deleted accounts would leave their food photos behind | Deletion named explicitly in all three places it must reach |
| `updated_at` never said who stamps it, and sign out left the diary on disk | A phone with a fast clock wins every conflict forever, and a full health record sits on a shared phone after sign out | Server stamped `updated_at`; sign out removes the file once nothing is unpushed |

The cross check also challenged the generator itself, arguing that this spec's own rationale ("the payoff only arrives on the third or fourth schema change") is an argument for hand writing the two migrations first and building the generator when the pace of change justifies it. That is a fair reading. It was put back to the engineer and the generator was kept, on the ground that the third and fourth schema changes are release 2 and release 3, both already on the scope, so the payoff falls inside the current plan rather than in a hypothetical future. Had the scope ended at release 1, Option 1 would have been the better pick.

## Evidence: what the product design already decided

Read out of `docs/design/CalSnap.dc.html` during this design conversation, and each one changed the model:

| Found in the design | Effect on the schema |
|---|---|
| Breakfast, Lunch, Dinner, Snack headings | `meals.meal_type` and `meal_type_source`, rather than a free text meal name |
| "day streak" on the Today screen | No new table; a definition was needed, and the index on `(user_id, eaten_on)` serves it |
| "Add by hand" with a food search and results carrying name, meta, and calories | An index on `(user_id, lower(name))` over `meal_items`, sourcing suggestions from the user's own history |
| "What you burn returns to the day's allowance" | `profiles.exercise_credit` defaults to `full` rather than `none`, settling a question the scope had left open |
| Onboarding asks for Age, not a birth date | `age_years` plus `age_recorded_on`, rather than `date_of_birth` |
| Macros shown as protein, carbs, fat only | No fibre, sugar, or sodium columns |
| Portion stepper on the review screen | Confirmed the base rate plus quantity plus resolved value shape |
| Weight start, now, and delta on the ledger | Confirmed `weight_entries` as a series, not a single current value |

The design also contains an "Ask the coach" screen, which is on the scope's deferred list. No schema is reserved for it.
