# Local database

## Overview

The on device SQLite store, opened and migrated once at startup. Every screen reads from here,
which is what makes the app instant; the Supabase sync (feature 5 onward) pushes and pulls around
it rather than sitting in front of it. There is no ORM and no migration library.

## Key files

| File              | Owns                                                                       |
| ----------------- | -------------------------------------------------------------------------- |
| `migrations.ts`   | The ordered migration list, `latestVersion`, and `pendingMigrations`       |
| `client.ts`       | `DATABASE_NAME`, opening the database, applying migrations, `openDatabase` |
| `use-database.ts` | The React hook that runs the open once at startup and reports its state    |

## Conventions

- Migrations are numbered and applied in order against `PRAGMA user_version`. `version` is the
  migration's position in the sequence, starting at 1, with no gaps.
- A migration that has shipped is never edited. Add the next number instead.
- Each migration runs inside a transaction, so a failure leaves the previous version intact rather
  than a half applied schema.
- Opening the database returns a result value (`{ kind: 'ready' }` or `{ kind: 'failed', message }`)
  rather than throwing, because a full disk or a corrupt file is an expected outcome the user has
  to be told about honestly.
- `useDatabase` is the only edge. Everything downstream works with the plain `SQLiteDatabase`
  handle it hands back.

## Gotchas

- SQLite turns foreign keys off by default on every connection, so `PRAGMA foreign_keys = ON` is
  set on each open in `client.ts`. Do not remove it.
- `PRAGMA user_version` cannot take a bound parameter, so the version number is interpolated into
  the statement. That value is only ever a migration's own integer, never anything from outside the
  app. Never interpolate anything else.
- `openDatabase` is safe to call on every launch: an up to date database applies nothing.
- The product tables (user, profile, meal, exercise entry, weight entry) are deliberately not
  invented here. They are scope feature 3's decision. Migration 1 only stands the database up with
  an `app_meta` table.

## Related specs

- [0001. Stack and architecture](../../docs/specs/0001-stack-architecture/index.md), AC-5 and the
  SQLite migrations scaffold decision.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
