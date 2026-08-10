import type { SqlDatabase } from '@/data/local/database';
import { openUserDatabase, removeUserDatabase } from '@/data/local/database-file';
import { countPendingMeals, countPendingPushes } from '@/data/local/pending';
import { nowIso } from '@/data/local/rows';
import { runSync } from '@/data/remote/sync';
import type { SyncTransport } from '@/data/remote/transport';
import { asSqlDatabase } from '@/db/client';

import { decideSignOut, deadlineFrom, hasExpired, type DrainingRecord } from './drain-rules';
import { clearDraining, readDraining, writeDraining } from './draining';

/**
 * Signing out, which on a health app is a data question and not a session one
 * (spec 0004, AC-11 and AC-11b).
 *
 * The order is fixed: **push first, then remove**. Removing a file with meals
 * still in it that never reached the account is losing someone's diary, and
 * doing that quietly is worse than any message.
 *
 * Three ways it can end:
 *
 * - Everything landed, so the file goes and nothing of that person is left.
 * - Work is owed and they were asked, so they choose: wait, or go anyway.
 * - They chose to go anyway, so the phone becomes signed out **now** and the
 *   account starts draining in the background (`resumeDraining`).
 */

/** The effects this module writes, gathered so a test can hand it fakes. */
export type DrainingStore = {
  read: () => Promise<DrainingRecord | undefined>;
  write: (record: DrainingRecord) => Promise<void>;
  clear: () => Promise<void>;
};

const DEFAULT_STORE: DrainingStore = {
  read: readDraining,
  write: writeDraining,
  clear: clearDraining,
};

export type SignOutOutcome =
  /** Pushed, then removed. Nothing of this account is left on the phone. */
  | { readonly kind: 'removed' }
  /** Work is owed. The number is **meals**, which is what a person counts. */
  | { readonly kind: 'pending'; readonly meals: number }
  /** Signed out on the surface, still pushing underneath, until the deadline. */
  | {
      readonly kind: 'draining';
      readonly meals: number;
      readonly deadline: string;
    }
  | { readonly kind: 'failed'; readonly message: string };

export type SignOutInput = {
  readonly userId: string;
  readonly db: SqlDatabase;
  /** Closes the handle. The file itself only goes when nothing is owed. */
  readonly close: () => Promise<void>;
  readonly transport: SyncTransport;
  /** "Sign out anyway", chosen after being told what is owed. */
  readonly force?: boolean;
  readonly now?: () => string;
  readonly store?: DrainingStore;
};

export const signOutSafely = async (input: SignOutInput): Promise<SignOutOutcome> => {
  const now = input.now ?? (() => nowIso());
  const store = input.store ?? DEFAULT_STORE;

  // Push, and deliberately ignore whether it failed: the count below is the
  // only thing that decides what happens, and it is the truth either way.
  await runSync(input.db, input.transport, 'sign-out');

  const decision = decideSignOut(await countPendingPushes(input.db), input.force === true);

  if (decision.kind === 'remove') {
    // `force` is set because the count above already is the gate, and the two
    // reads should not be able to disagree.
    const removed = await removeUserDatabase(input.userId, input.db, input.close, { force: true });
    return removed.kind === 'removed' ? { kind: 'removed' } : removed;
  }

  const meals = await countPendingMeals(input.db);

  if (decision.kind === 'ask') return { kind: 'pending', meals };

  const deadline = deadlineFrom(now());
  await store.write({ userId: input.userId, deadline });
  await input.close();

  return { kind: 'draining', meals, deadline };
};

export type ResumeOutcome =
  /** Nothing is draining. The common case, and it costs one read. */
  | { readonly kind: 'idle' }
  /** The last rows landed. The caller ends the Clerk session now. */
  | { readonly kind: 'removed' }
  /** Seven days passed. The file went with rows still owed, as designed. */
  | { readonly kind: 'expired' }
  | { readonly kind: 'still-draining'; readonly meals: number };

export type ResumeInput = {
  readonly transport: SyncTransport;
  readonly now?: () => string;
  readonly store?: DrainingStore;
};

/**
 * One attempt at finishing a drain, run on every foreground.
 *
 * Ends in exactly one of three ways, and two of them remove the file: the push
 * succeeded, or the deadline passed. There is no fourth way for a health
 * record to sit on a phone forever, which is the guarantee AC-11b is really
 * about.
 */
export const resumeDraining = async (input: ResumeInput): Promise<ResumeOutcome> => {
  const now = input.now ?? (() => nowIso());
  const store = input.store ?? DEFAULT_STORE;

  const record = await store.read();
  if (record === undefined) return { kind: 'idle' };

  const opened = await openUserDatabase(record.userId);
  if (opened.kind === 'failed') {
    // The file is already gone, or unopenable. Either way there is nothing
    // left to drain and the record should not outlive it.
    await store.clear();
    return { kind: 'removed' };
  }

  const db = asSqlDatabase(opened.db);
  const close = () => opened.db.closeAsync();

  if (hasExpired(record, now())) {
    await removeUserDatabase(record.userId, db, close, { force: true });
    await store.clear();
    return { kind: 'expired' };
  }

  await runSync(db, input.transport, 'sign-out');

  if ((await countPendingPushes(db)) > 0) {
    const meals = await countPendingMeals(db);
    await close();
    return { kind: 'still-draining', meals };
  }

  await removeUserDatabase(record.userId, db, close, { force: true });
  await store.clear();
  return { kind: 'removed' };
};

/**
 * The account signing in again while its own drain is still running: the file
 * is adopted rather than removed, and it drains normally from inside the
 * session (spec 0004, state transitions).
 */
export const adoptDrainingFile = async (
  userId: string,
  store: DrainingStore = DEFAULT_STORE,
): Promise<boolean> => {
  const record = await store.read();
  if (record === undefined || record.userId !== userId) return false;

  await store.clear();
  return true;
};
