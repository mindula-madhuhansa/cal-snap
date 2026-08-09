import { deleteDatabaseAsync } from 'expo-sqlite';

import { openDatabase, type OpenDatabaseResult } from '@/db/client';

import type { SqlDatabase } from './database';

/**
 * On the phone, isolation between accounts is physical rather than filtered:
 * each account gets its own SQLite file, opened on sign in and removed on
 * sign out. Two accounts cannot share a file, so a missed `WHERE user_id`
 * cannot leak between them (AC-11).
 *
 * Sign in and sign out themselves belong to scope feature 5. This module is
 * the half the data model owes that feature.
 */

/** The tables that carry unpushed work. `profiles` included: it syncs too. */
const SYNCED_TABLES: readonly string[] = [
  'profiles',
  'meal_scans',
  'meals',
  'meal_items',
  'daily_targets',
  'weight_entries',
];

/**
 * One file per account. The user's identifier is a UUID the server issued, so
 * it is safe in a filename, but it is checked anyway rather than trusted.
 */
export const databaseNameForUser = (userId: string): string => `calsnap-${userId}.db`;

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const openUserDatabase = async (userId: string): Promise<OpenDatabaseResult> => {
  if (!UUID_SHAPE.test(userId)) {
    return { kind: 'failed', message: 'That account identifier is not one this app issued.' };
  }
  return openDatabase(databaseNameForUser(userId));
};

/** How many rows are still waiting to reach the server. */
export const countPendingPushes = async (db: SqlDatabase): Promise<number> => {
  const counts = await Promise.all(
    SYNCED_TABLES.map(async (table) => {
      const row = await db.getFirstAsync<{ pending: number }>(
        `SELECT COUNT(*) AS pending FROM ${table} WHERE is_dirty = 1`,
        [],
      );
      return row?.pending ?? 0;
    }),
  );
  return counts.reduce((total, count) => total + count, 0);
};

export type SignOutResult =
  /** Everything was pushed, so the file is gone and no diary is left behind. */
  | { readonly kind: 'removed' }
  /** Work is still unpushed, so the file stays and the next sign in retries. */
  | { readonly kind: 'kept'; readonly pending: number }
  | { readonly kind: 'failed'; readonly message: string };

/**
 * Signing out removes the local diary, once every dirty row has been pushed.
 *
 * Nothing is kept for convenience. On a shared or family phone the
 * alternative is a full health record sitting on disk indefinitely after
 * someone signs out. If a push is still pending the file stays instead, and
 * the next sign in retries it, because losing unsynced meals would be worse
 * than holding them for a while.
 */
export const signOutAndRemoveDatabase = async (
  userId: string,
  db: SqlDatabase,
  close: () => Promise<void>,
): Promise<SignOutResult> => {
  const pending = await countPendingPushes(db);
  if (pending > 0) return { kind: 'kept', pending };

  try {
    await close();
    await deleteDatabaseAsync(databaseNameForUser(userId));
    return { kind: 'removed' };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { kind: 'failed', message: `Your local data could not be removed. ${detail}` };
  }
};
