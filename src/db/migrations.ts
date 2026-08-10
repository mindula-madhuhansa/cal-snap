/**
 * Numbered migrations, applied in order against `PRAGMA user_version`. No ORM
 * and no migration library (spec 0001, "Scaffold decisions").
 *
 * Rules that keep this honest:
 *   - A migration that has shipped is never edited. Add the next number.
 *   - `version` is its position in the sequence, starting at 1, no gaps.
 *   - Each one runs inside a transaction, so a failure leaves the previous
 *     version intact rather than a half-applied schema.
 */
import { coreDataModelSql, syncStateSql } from '@/data/local/migrations';

export type Migration = {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
};

/**
 * The product tables are scope feature 3's decision and are deliberately not
 * invented here. This first migration only stands the database up.
 */
const initial: Migration = {
  version: 1,
  name: 'initial',
  sql: `
    CREATE TABLE app_meta (
      key   TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    INSERT INTO app_meta (key, value)
    VALUES ('schema_created_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
  `,
};

/**
 * The six release 1 tables from spec 0002. Its SQL is generated from the
 * schema declaration in `src/data/schema/`, so this migration and the
 * Supabase one cannot drift apart. See `src/data/local/migrations.ts` for the
 * fingerprint that stops an edit to a declaration changing this migration
 * after it has shipped.
 */
const coreDataModel: Migration = {
  version: 2,
  name: 'core-data-model',
  sql: coreDataModelSql,
};

/**
 * The pull watermark table (spec 0002's `sync_state`), which arrives with the
 * sync functions rather than with the diary. Its SQL is generated from the
 * same declarations, and it is its own migration because migration 2 has
 * shipped and a shipped migration is never edited.
 */
const syncStateTable: Migration = {
  version: 3,
  name: 'sync-state',
  sql: syncStateSql,
};

export const migrations: readonly Migration[] = [initial, coreDataModel, syncStateTable];

/** The version the database should be at once every migration has run. */
export const latestVersion: number = migrations.length;

/** The migrations still to apply to a database currently at `currentVersion`. */
export const pendingMigrations = (currentVersion: number): readonly Migration[] =>
  migrations.filter((migration) => migration.version > currentVersion);
