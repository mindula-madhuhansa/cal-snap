# Local database

## Overview

The on device SQLite store, opened and migrated once at startup. Every screen reads from here,
which is what makes the app instant; the Supabase sync (feature 5 onward) pushes and pulls around
it rather than sitting in front of it. There is no ORM and no migration library.

## Key files

| File            | Owns                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------- |
| `migrations.ts` | The ordered migration list, `latestVersion`, and `pendingMigrations`                         |
| `client.ts`     | `DATABASE_NAME`, `openDatabase`, and `asSqlDatabase`, the adapter onto the data layer's port |

## Conventions

- Migrations are numbered and applied in order against `PRAGMA user_version`. `version` is the
  migration's position in the sequence, starting at 1, with no gaps.
- A migration that has shipped is never edited. Add the next number instead.
- Each migration runs inside a transaction, so a failure leaves the previous version intact rather
  than a half applied schema.
- Opening the database returns a result value (`{ kind: 'ready' }` or `{ kind: 'failed', message }`)
  rather than throwing, because a full disk or a corrupt file is an expected outcome the user has
  to be told about honestly.
- Opening the database is the only edge. Everything downstream works with the plain `SQLiteDatabase`
  handle, or with the narrow `SqlDatabase` port that `asSqlDatabase` wraps it in. The old
  `use-database.ts` hook was removed with feature 5: the database is no longer opened once at
  startup under a fixed name, it is opened per account by `@/account/session`, which is what makes
  one file per person possible. See [src/account/AGENTS.md](../account/AGENTS.md).

## Gotchas

- SQLite turns foreign keys off by default on every connection, so `PRAGMA foreign_keys = ON` is
  set on each open in `client.ts`. Do not remove it.
- `PRAGMA user_version` cannot take a bound parameter, so the version number is interpolated into
  the statement. That value is only ever a migration's own integer, never anything from outside the
  app. Never interpolate anything else.
- `openDatabase` is safe to call on every launch: an up to date database applies nothing.
- Migration 1 stands the database up with an `app_meta` table. Migration 2 creates the six product
  tables from spec 0002, and its SQL is **generated** from the declarations in `src/data/schema/`,
  not written here. `migrations.ts` imports it as `coreDataModelSql`. Migration 3 adds the
  `sync_state` watermark table, generated the same way and guarded by its own fingerprint.
- The database file is no longer a single fixed name. `DATABASE_NAME` remains for the scaffold
  path, but a signed in person gets `calsnap-<clerk user id>.db`, opened by
  `@/data/local/database-file.ts`. One file per account is the main isolation defence on the phone.
- Because migration 2 is generated and has shipped, editing a table declaration it covers would
  retroactively change what a phone already ran. `CORE_DATA_MODEL_FINGERPRINT` in
  `src/data/local/migrations.ts` guards that, and `npm test` fails if it moves. The fix is always
  migration 3, never a new fingerprint. See [src/data/AGENTS.md](../data/AGENTS.md).

## Related specs

- [0001. Stack and architecture](../../docs/specs/0001-stack-architecture/index.md), AC-5 and the
  SQLite migrations scaffold decision.
- [0002. Core data model](../../docs/specs/0002-data-model/index.md), which owns migration 2 and
  everything in it.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
