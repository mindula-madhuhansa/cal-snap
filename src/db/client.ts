import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { latestVersion, pendingMigrations, type Migration } from './migrations';

/**
 * The one on-device database. Every screen reads from here, which is what
 * makes the app instant; the Supabase sync (feature 5 onward) pushes and
 * pulls around it rather than sitting in front of it.
 */
export const DATABASE_NAME = 'calsnap.db';

/**
 * Opening the database is an expected place to fail (no disk space, a
 * corrupt file, a migration with a mistake in it), so the outcome is a value
 * rather than a throw and the caller can say something honest on screen.
 */
export type OpenDatabaseResult =
  | { readonly kind: 'ready'; readonly db: SQLiteDatabase; readonly version: number }
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

    return { kind: 'ready', db, version };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { kind: 'failed', message: `The local database could not be opened. ${detail}` };
  }
};
