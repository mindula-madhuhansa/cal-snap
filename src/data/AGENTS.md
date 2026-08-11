# Data model

## Overview

The diary itself: the tables, the pure calculations over them, and the functions that read and
write the local database. Each table is declared once, as plain data, and the SQLite statements,
the Postgres statements, and the TypeScript types are all generated from that one declaration, so
the phone's database and Supabase can never drift apart.

Everything here runs without a phone. Nothing in this folder imports a React Native or Expo module
except `ids/device.ts` and `local/database-file.ts`, which are the two deliberate edges. `remote/`
holds sync as rules over a narrow port and knows nothing about Supabase; the adapter that does is
`@/account/supabase-transport.ts`, which is what lets the push and pull rules be tested with no
network and no client.

## Key files

| File                               | Owns                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| `schema/types.ts`                  | The table description type, and the terse constructors table files use         |
| `schema/tables/*.ts`               | One file per table, plain data, no database imports                            |
| `schema/tables/all.ts`             | `releaseOneTables` (frozen), `onboardingTables`, and `syncedTableDeclarations` |
| `schema/to-sqlite.ts`              | The SQLite generator, pure                                                     |
| `schema/to-postgres.ts`            | The Postgres generator, pure: row level security, and the arbitration triggers |
| `schema/checks.ts`                 | The one type mapping table, and how a check renders as SQL                     |
| `schema/resolve.ts`                | The lifecycle and device only columns each dialect gets                        |
| `schema/parity.ts`                 | Reads both generated schemas back and compares them (AC-1)                     |
| `calculations/*.ts`                | Portion rescaling, the local day, the meal type guess, units, rounding         |
| `calculations/calorie-target.ts`   | Mifflin-St Jeor, the activity multipliers, the pace, the safety floor. Pure    |
| `calculations/onboarding-steps.ts` | The setup question order and the arithmetic of moving through it               |
| `calculations/unit-default.ts`     | Which unit family a locale implies. A default only                             |
| `ids/uuid.ts`                      | UUID version 7 and version 5, pure; `ids/sha1.ts` backs version 5              |
| `ids/device.ts`                    | The device's real randomness. The only Expo import in `ids/`                   |
| `local/database.ts`                | The narrow `SqlDatabase` port the whole data layer talks to                    |
| `local/migrations.ts`              | The generated SQL for migrations 2, 3 and 4, each with its fingerprint guard   |
| `local/meals.ts`                   | `saveMeal`, `listMealsForDay`, `deleteMeal`, `totalsForDay`                    |
| `local/daily-targets.ts`           | `getOrCreateDailyTarget`, which takes the calorie formula as an argument       |
| `local/target-formula.ts`          | The formula that argument is filled with: the override, else Mifflin-St Jeor   |
| `local/target-overrides.ts`        | A target the person set for themselves, applying from one date forward         |
| `local/onboarding.ts`              | The setup draft, and the one transaction that turns it into a real profile     |
| `local/profile.ts`                 | `readProfile` and `updateProfileAnswers`, for changing an answer after setup   |
| `local/past-items.ts`              | `searchPastItems`, the add by hand search over your own history                |
| `local/streak.ts`                  | `computeStreak`                                                                |
| `local/database-file.ts`           | The per user database file, opened on sign in and removed on sign out          |
| `local/database-name.ts`           | Naming and validating that file from a Clerk identifier. Pure                  |
| `local/pending.ts`                 | `countPendingPushes` (the gate) and `countPendingMeals` (what a person reads)  |
| `local/rows.ts`                    | The database row shapes, and the mapping into the app's shapes                 |
| `remote/transport.ts`              | The narrow `SyncTransport` port, and `BEGINNING_OF_TIME`                       |
| `remote/push.ts`                   | Dirty rows up, upserted on the key, and the server's reply written back        |
| `remote/pull.ts`                   | Rows down by keyset from the watermark, with the sticky delete rule            |
| `remote/sync.ts`                   | `runSync`: push, then pull, with a reason. Safe to call repeatedly             |
| `remote/codec.ts`                  | Row shapes across the wire, and the device only columns kept off it            |
| `remote/sync-state.ts`             | Reading and advancing the per table pull watermark                             |

## Commands

| Command                          | What it does                                                             |
| -------------------------------- | ------------------------------------------------------------------------ |
| `npm test`                       | The whole suite, including the parity and fingerprint checks             |
| `npm test src/data/schema`       | Just the generators and the parity check                                 |
| `npm run gen:supabase-migration` | Rewrites all three files in `supabase/migrations/` from the declarations |

## Conventions

- A table is declared once, in `schema/tables/`, as plain data. Never hand write SQL for a table
  in either database. Change the declaration and the generators do both sides.
- The generators are pure functions. They take declarations and return text, with no database, no
  clock, and no randomness in them.
- The whole data layer depends on the narrow `SqlDatabase` port in `local/database.ts`, never on
  `expo-sqlite` directly. That is what lets the tests drive the real queries against plain
  `node:sqlite` with no phone and no mocking.
- Effects are passed in, not imported. `saveMeal` takes an `IdSource`; `getOrCreateDailyTarget`
  takes the calorie formula (scope feature 6 owns that decision, not this folder).
- Expected failures return `{ kind: 'failed', message }` with a message a person could read as it
  stands. Only genuinely unexpected conditions throw.
- Every read filters `deleted_at is null`. Every list read is paginated with a keyset, never an
  offset.
- Every query is scoped by `user_id`, even though each account already has its own database file.
  The file split is the main defence and the filter is the second one.
- `user_id` is `text` holding the **Clerk** identifier (`user_...`), not a `uuid`, and it has no
  foreign key: the account lives at Clerk, so there is nothing in either database to reference.
  Never derive or type one; it always comes from the session's `sub` claim.
- Weight is kilograms and height is centimetres, everywhere. `calculations/units.ts` is display
  only and is never called on a write path.
- Macros round to one decimal and calories to a whole number, on write, via
  `calculations/rounding.ts`. That rule is what keeps SQLite `REAL` equal to Postgres
  `numeric(6,1)`; neither database enforces it.
- Tests sit beside the source as `*.test.ts`. A test that pins an acceptance criterion carries a
  `covers: AC-N` comment so the suite traces back to spec 0002.

## Gotchas

- **Never edit a table declaration that a shipped migration already covers.** SQLite migration 2's
  SQL is generated, so editing a declaration would rewrite what a phone already ran.
  `CORE_DATA_MODEL_FINGERPRINT` in `local/migrations.ts` catches this and `npm test` fails. The fix
  is always a new migration, never a new fingerprint.
- Rows keyed by a day (`daily_targets`, `weight_entries`) use a deterministic UUID version 5 from
  the user and the date, so two offline phones produce the same row and collide on the primary key
  where newest write wins can see it. Every other table uses version 7. Adding a day keyed table
  means using `dayScopedId`.
- **A date keyed table is not automatically day scoped, and `target_overrides` is the exception that
  proves it.** It carries an `effective_from` date and is soft deletable, and it deliberately uses
  version **7** with **no unique index**. A deterministic identifier would make setting an override,
  clearing it, and setting another for the same date a _revival_ of the tombstoned row, which spec
  0005's sticky delete trigger refuses: the push comes back as the tombstone, `pushChanges` writes
  that whole row into SQLite, and the person's new number vanishes with nothing failing. Reach for
  `dayScopedId` only when two devices creating the same day should produce **one** row and the row
  is never re-created after deletion. Otherwise take a fresh identifier and order on read.
  `weight_entries` and `daily_targets` still carry this hazard; it is on the scope as its own
  decision.
- **`releaseOneTables` is frozen; add a new synced table to `syncedTableDeclarations`.** That list
  generates migration 2, which has shipped, so appending to it would retroactively change what a
  phone already ran and `CORE_DATA_MODEL_FINGERPRINT` fails the suite. A new table goes in its own
  declaration, its own list (`onboardingTables`), its own SQLite migration with its own fingerprint,
  and its own Postgres file. `remote/tables.ts` and the parity check both read
  `syncedTableDeclarations`, so a table added there syncs and is compared with no edit in either
  place.
- **A retryable write must not be a bare insert.** `completeOnboarding` tells the person their
  answers are saved and to try again, so the second attempt has to be able to succeed:
  both its writes upsert. `profiles` is keyed on `user_id` and `weight_entries` is unique on
  `(user_id, on_date)` while live, so an unfinished profile row, a weigh in already logged today, or
  a single failed attempt otherwise makes every later attempt fail identically. A real device found
  this on 10 August 2026.
- `CALSNAP_NAMESPACE` in `ids/uuid.ts` is frozen. Changing it renames every existing day keyed row
  on every device.
- `eaten_on` is decided once at save time and never recomputed. A meal saved at 23:50 in Colombo
  stays on that date after the phone moves to London.
- A `daily_targets` row is never recomputed after it is written, on purpose. Backdating a weigh in
  does not change a target the person already ate against.
- No total is ever stored. A meal total and a day total are always summed over the live items at
  read time.
- `meal_items` carries its own `user_id` even though `meal_id` implies it, so no row level security
  policy needs a join.
- `saveMeal` stamps one `created_at` for the whole meal, so every item in a meal shares an instant
  exactly, and two meals saved in the same millisecond do too. Never pick "the most recent row"
  with `MAX(created_at)` and bare columns: SQLite resolves that tie arbitrarily. Order explicitly
  by `(created_at DESC, id DESC)`, as `searchPastItems` does.
- SQLite carries `is_dirty` and `synced_at`; Postgres deliberately does not. The parity check
  asserts they are absent from Postgres rather than ignoring them.
- **Never write `auth.uid()` in a policy.** Every Postgres policy reads
  `(user_id = (select auth.jwt() ->> 'sub'))`, because identity comes from a Clerk token now.
  `auth.uid()` still exists and still runs, it just returns null here, so a policy written from a
  Supabase example silently matches **nothing** rather than failing. Nothing catches this yet;
  spec 0002 carries a follow up to add a guard in `schema/to-postgres.ts`.
- A table with no `sync_state` row pulls from `BEGINNING_OF_TIME`, not from now. That default is
  the only reason a fresh phone receives an existing diary at all.
- `runSync` with reason `sign-out` pushes and deliberately does **not** pull, because pulling a
  diary the app is about to delete is work for nothing.
- **`updated_at` in Postgres belongs to the server, and a push believes the reply rather than its
  own request** (spec 0005). A trigger stamps it, freezes `created_at`, and refuses to move
  `deleted_at` back to null, so what comes back is not always what went out: a push that tried to
  revive a deleted row comes back as the tombstone. `pushChanges` writes the whole returned row into
  SQLite because of that. Keeping only the timestamp would leave a deleted meal on one phone
  forever, marked clean, with the watermark already past the tombstone that would have fixed it.
- **Every local write that sets `is_dirty = 1` must also move `updated_at`.** `pushChanges` decides
  whether a row changed while its push was in flight by comparing that stamp, so a write that
  dirties a row without moving it would have the person's edit silently overwritten by the reply.
  True today in `local/meals.ts`; nothing enforces it.
- **`withTransactionAsync` must serialise every other writer on the connection.** Both
  implementations do, because both hold a single connection, and `pushChanges` depends on it: it
  reads a row and then writes it as two statements. `local/database.ts` carries the full note. An
  implementation letting two connections share one file would reopen that race with nothing failing
  to compile.
- `supabase/migrations/` is generated. Do not hand edit it; run `npm run gen:supabase-migration`.
  **Both files are rewritten in full on every run, so an applied one must keep generating exactly
  what was applied.** `20260809000000_core_data_model.sql` is applied, so regenerating it must leave
  `git diff` empty; a non empty diff there means a later change leaked into a migration a database
  has already run, and that is the failure signal. A new change gets its own emitter and its own
  file, the way `toPostgresSyncTriggers` did. There are three files now, all applied: the core
  model, the arbitration triggers, and `20260810120000_target_overrides.sql` (spec 0006).
- Test files and `test/support/` typecheck under `tsconfig.test.json`, not the app config, so Node
  globals stay out of app source.

## Agent skills

- [supabase-postgres-best-practices](../../.agents/skills/supabase-postgres-best-practices/):
  `supabase/agent-skills`, load before changing a table, an index, or a policy.
- [supabase](../../.agents/skills/supabase/): `supabase/agent-skills`, for the client, auth, edge
  functions, and storage when feature 5 wires them.

MCP servers: Supabase (connected; the live project is `Cal Snap`).

## Related specs

- [0002. Core data model](../../docs/specs/0002-data-model/index.md), the source of truth for every
  table, invariant, and acceptance criterion here. Its `verify.md` records what is proven and what
  is still owed.
- [0004. Account and sign in](../../docs/specs/0004-account-and-sign-in/index.md), which amended
  0002's identity model (`text` identifiers, `auth.jwt() ->> 'sub'` policies) and settled when
  sync runs. Session conventions live in [src/account/AGENTS.md](../account/AGENTS.md).
- [0005. Sync arbitration](../../docs/specs/0005-sync-arbitration/index.md), which amended 0002
  again: it supplied the mechanism behind three rules 0002 stated but nothing implemented, and
  replaced "newest write wins" with the last push winning, since a server owned clock makes them
  the same event.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
