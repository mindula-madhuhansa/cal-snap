# Data model

## Overview

The diary itself: the tables, the pure calculations over them, and the functions that read and
write the local database. Each table is declared once, as plain data, and the SQLite statements,
the Postgres statements, and the TypeScript types are all generated from that one declaration, so
the phone's database and Supabase can never drift apart.

Everything here runs without a phone. Nothing in this folder imports a React Native or Expo module
except `ids/device.ts` and `local/database-file.ts`, which are the two deliberate edges.

## Key files

| File                     | Owns                                                                     |
| ------------------------ | ------------------------------------------------------------------------ |
| `schema/types.ts`        | The table description type, and the terse constructors table files use   |
| `schema/tables/*.ts`     | One file per table, plain data, no database imports                      |
| `schema/tables/all.ts`   | `releaseOneTables`, in dependency order                                  |
| `schema/to-sqlite.ts`    | The SQLite generator, pure                                               |
| `schema/to-postgres.ts`  | The Postgres generator, pure, including row level security               |
| `schema/checks.ts`       | The one type mapping table, and how a check renders as SQL               |
| `schema/resolve.ts`      | The lifecycle and device only columns each dialect gets                  |
| `schema/parity.ts`       | Reads both generated schemas back and compares them (AC-1)               |
| `calculations/*.ts`      | Portion rescaling, the local day, the meal type guess, units, rounding   |
| `ids/uuid.ts`            | UUID version 7 and version 5, pure; `ids/sha1.ts` backs version 5        |
| `ids/device.ts`          | The device's real randomness. The only Expo import in `ids/`             |
| `local/database.ts`      | The narrow `SqlDatabase` port the whole data layer talks to              |
| `local/migrations.ts`    | SQLite migration 2's SQL, generated, plus its fingerprint guard          |
| `local/meals.ts`         | `saveMeal`, `listMealsForDay`, `deleteMeal`, `totalsForDay`              |
| `local/daily-targets.ts` | `getOrCreateDailyTarget`, which takes the calorie formula as an argument |
| `local/past-items.ts`    | `searchPastItems`, the add by hand search over your own history          |
| `local/streak.ts`        | `computeStreak`                                                          |
| `local/database-file.ts` | The per user database file, opened on sign in and removed on sign out    |
| `local/rows.ts`          | The database row shapes, and the mapping into the app's shapes           |

## Commands

| Command                          | What it does                                                 |
| -------------------------------- | ------------------------------------------------------------ |
| `npm test`                       | The whole suite, including the parity and fingerprint checks |
| `npm test src/data/schema`       | Just the generators and the parity check                     |
| `npm run gen:supabase-migration` | Rewrites `supabase/migrations/` from the declarations        |

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
- SQLite carries `is_dirty` and `synced_at`; Postgres deliberately does not. The parity check
  asserts they are absent from Postgres rather than ignoring them.
- `supabase/migrations/` is generated. Do not hand edit it; run `npm run gen:supabase-migration`.
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

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
