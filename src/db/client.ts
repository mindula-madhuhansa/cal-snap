import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import type { SqlDatabase, SqlValue } from '@/data/local/database';

import { latestVersion, pendingMigrations, type Migration } from './migrations';

/**
 * The real handle, seen through the narrow port the data layer talks to.
 *
 * The two are the same object; only the types need reconciling. `expo-sqlite`
 * asks for a mutable `SQLiteBindValue[]`, while the port promises `readonly
 * SqlValue[]`, because the data layer never mutates the parameters it is
 * handed. Spreading into a fresh array is what satisfies both, and it keeps
 * the immutability rule where it belongs rather than loosening the port.
 */
export const asSqlDatabase = (db: SQLiteDatabase): SqlDatabase => ({
  runAsync: (sql: string, params: readonly SqlValue[]) => db.runAsync(sql, [...params]),
  getAllAsync: <T>(sql: string, params: readonly SqlValue[]) => db.getAllAsync<T>(sql, [...params]),
  getFirstAsync: <T>(sql: string, params: readonly SqlValue[]) =>
    db.getFirstAsync<T>(sql, [...params]),
  withTransactionAsync: (work: () => Promise<void>) => db.withTransactionAsync(work),
});

/**
 * The fallback name, kept only as the default argument.
 *
 * There is no longer one shared database: spec 0004 gives each account its
 * own file, named for its Clerk identifier, opened on sign in and removed on
 * sign out (see `src/data/local/database-file.ts`). Isolation on the phone is
 * physical, so nothing should open this name in normal use.
 */
export const DATABASE_NAME = 'calsnap.db';

/**
 * Opening the database is an expected place to fail (no disk space, a
 * corrupt file, a migration with a mistake in it), so the outcome is a value
 * rather than a throw and the caller can say something honest on screen.
 */
export type OpenDatabaseResult =
  | {
      readonly kind: 'ready';
      readonly db: SQLiteDatabase;
      readonly version: number;
      /**
       * Whether this file did not exist until now. Spec 0004 (AC-9) needs it:
       * a brand new file for an account means this is a fresh device, so the
       * app holds a restoring screen until the first pull finishes rather
       * than showing an empty diary that fills in underneath the person.
       */
      readonly createdNow: boolean;
    }
  | { readonly kind: 'failed'; readonly message: string };

const readUserVersion = async (db: SQLiteDatabase): Promise<number> => {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
};

/**
 * `PRAGMA user_version` cannot take a bound parameter, so the number is
 * interpolated. It is only ever a migration's own integer version, never
 * anything that came from outside the app.
 */
const applyMigration = async (db: SQLiteDatabase, migration: Migration): Promise<void> => {
  await db.withTransactionAsync(async () => {
    await db.execAsync(migration.sql);
    await db.execAsync(`PRAGMA user_version = ${migration.version}`);
  });
};

/**
 * Opens the database, brings it up to the latest schema version, and hands
 * back the handle. Safe to call on every launch: an up-to-date database
 * applies nothing.
 */
export const openDatabase = async (
  databaseName: string = DATABASE_NAME,
): Promise<OpenDatabaseResult> => {
  try {
    const db = await openDatabaseAsync(databaseName);

    // Foreign keys are off by default in SQLite and have to be asked for on
    // every connection. WAL keeps reads fast while a sync writes.
    await db.execAsync('PRAGMA journal_mode = WAL');
    await db.execAsync('PRAGMA foreign_keys = ON');

    const startingVersion = await readUserVersion(db);

    for (const migration of pendingMigrations(startingVersion)) {
      await applyMigration(db, migration);
    }

    const version = await readUserVersion(db);

    if (version !== latestVersion) {
      return {
        kind: 'failed',
        message: `The database is at schema version ${version}, but the app expects ${latestVersion}.`,
      };
    }

    // A file that reported version 0 before any migration ran had never been
    // opened before, which is what "new for this account" means.
    return { kind: 'ready', db, version, createdNow: startingVersion === 0 };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { kind: 'failed', message: `The local database could not be opened. ${detail}` };
  }
};
