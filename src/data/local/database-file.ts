import { deleteDatabaseAsync } from 'expo-sqlite';

import { openDatabase, type OpenDatabaseResult } from '@/db/client';

import type { SqlDatabase } from './database';
import { databaseNameForUser, isClerkUserId } from './database-name';
import { countPendingMeals, countPendingPushes } from './pending';

export { CLERK_USER_ID_SHAPE, databaseNameForUser, isClerkUserId } from './database-name';

/**
 * On the phone, isolation between accounts is physical rather than filtered:
 * each account gets its own SQLite file, opened on sign in and removed on
 * sign out. Two accounts cannot share a file, so a missed `WHERE user_id`
 * cannot leak between them (spec 0002 AC-11; spec 0004 AC-8).
 *
 * This module is one of the two deliberate Expo edges in `src/data/`. The
 * counts it leans on are plain queries and live in `./pending` so the tests
 * can drive them without a phone.
 */

export const openUserDatabase = async (userId: string): Promise<OpenDatabaseResult> => {
  if (!isClerkUserId(userId)) {
    return { kind: 'failed', message: 'That account identifier is not one this app issued.' };
  }
  return openDatabase(databaseNameForUser(userId));
};

export type SignOutResult =
  /** Everything was pushed, so the file is gone and no diary is left behind. */
  | { readonly kind: 'removed' }
  /**
   * Work is still unpushed. The person is told how many *meals* are waiting
   * and chooses to wait or to sign out anyway.
   */
  | { readonly kind: 'pending'; readonly meals: number }
  | { readonly kind: 'failed'; readonly message: string };

/**
 * Removes the local diary for an account, once every dirty row has landed.
 *
 * Nothing is kept for convenience. On a shared or family phone the
 * alternative is a full health record sitting on disk indefinitely after
 * someone signs out.
 *
 * `force` is the "sign out anyway" path: it removes the file even with work
 * unpushed. Slice 2 replaces that with the draining state (spec 0004, AC-11b),
 * which keeps the rows and retries rather than losing them, so `force` is the
 * honest short term behaviour and not the final one.
 */
export const removeUserDatabase = async (
  userId: string,
  db: SqlDatabase,
  close: () => Promise<void>,
  options: { readonly force?: boolean } = {},
): Promise<SignOutResult> => {
  if (!isClerkUserId(userId)) {
    return { kind: 'failed', message: 'That account identifier is not one this app issued.' };
  }

  if (options.force !== true) {
    const pending = await countPendingPushes(db);
    if (pending > 0) return { kind: 'pending', meals: await countPendingMeals(db) };
  }

  try {
    await close();
    await deleteDatabaseAsync(databaseNameForUser(userId));
    return { kind: 'removed' };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { kind: 'failed', message: `Your local data could not be removed. ${detail}` };
  }
};
