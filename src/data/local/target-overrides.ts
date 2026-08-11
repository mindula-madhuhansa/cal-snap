import type { IdSource } from '../ids/uuid';
import { failed, ok, type DataResult } from '../types';

import type { SqlDatabase } from './database';
import { nowIso } from './rows';

/**
 * The daily calorie target a person set for themselves, applying from one
 * local date forward (spec 0006, AC-10).
 *
 * Two rules run through everything here, and both are load bearing:
 *
 *   1. **Never an upsert, never a reused identifier.** Setting an override
 *      tombstones whatever was live for that date and inserts a *fresh*
 *      version 7 row. Reusing a deterministic identifier would make a set,
 *      clear, set sequence a revival of a tombstoned row, and spec 0005's
 *      sticky delete trigger refuses those: the push would come back as the
 *      tombstone, `pushChanges` would write it into SQLite, and the person's
 *      new override would vanish with nothing failing (AC-10b).
 *   2. **More than one live row for a date is legal.** Two offline devices can
 *      each set one, and neither is wrong. So reads order rather than assume,
 *      and `clearOverride` tombstones every live row rather than one.
 */

export type TargetOverride = {
  readonly id: string;
  readonly effectiveFrom: string;
  readonly calories: number;
};

type OverrideRow = {
  readonly id: string;
  readonly effective_from: string;
  readonly calories: number;
};

const toOverride = (row: OverrideRow): TargetOverride => ({
  id: row.id,
  effectiveFrom: row.effective_from,
  calories: row.calories,
});

const OVERRIDE_COLUMNS = 'id, effective_from, calories';

/**
 * The override that applies on one local date: the newest live row whose
 * `effective_from` is on or before it, or nothing.
 *
 * The ordering is explicit all the way down to `id` because two rows can
 * genuinely tie. `effective_from` ties whenever two devices set one for the
 * same day, and `updated_at` can tie too, so `id` is the final tie break that
 * makes this deterministic rather than left to SQLite to resolve arbitrarily
 * (`src/data/AGENTS.md`).
 */
export const resolveOverride = async (
  db: SqlDatabase,
  query: { readonly userId: string; readonly onDate: string },
): Promise<DataResult<TargetOverride | undefined>> => {
  const row = await db.getFirstAsync<OverrideRow>(
    `SELECT ${OVERRIDE_COLUMNS} FROM target_overrides
     WHERE user_id = ? AND effective_from <= ? AND deleted_at IS NULL
     ORDER BY effective_from DESC, updated_at DESC, id DESC
     LIMIT 1`,
    [query.userId, query.onDate],
  );

  return ok(row === null ? undefined : toOverride(row));
};

/** Every live override for a date, newest first. Mostly one; two after an offline clash. */
export const listOverridesOn = async (
  db: SqlDatabase,
  query: { readonly userId: string; readonly effectiveFrom: string },
): Promise<readonly TargetOverride[]> => {
  const rows = await db.getAllAsync<OverrideRow>(
    `SELECT ${OVERRIDE_COLUMNS} FROM target_overrides
     WHERE user_id = ? AND effective_from = ? AND deleted_at IS NULL
     ORDER BY updated_at DESC, id DESC`,
    [query.userId, query.effectiveFrom],
  );

  return rows.map(toOverride);
};

/**
 * Sets the target for one date forward, replacing anything already set for it.
 *
 * The tombstone and the insert are one transaction, so a reader never sees a
 * date with nothing set on it partway through.
 */
export const setOverride = async (
  db: SqlDatabase,
  input: {
    readonly userId: string;
    readonly effectiveFrom: string;
    readonly calories: number;
  },
  ids: IdSource,
): Promise<DataResult<TargetOverride>> => {
  if (!Number.isInteger(input.calories) || input.calories <= 0) {
    return failed('A daily target has to be a whole number of calories above zero.');
  }

  const id = ids.newId();
  const at = nowIso();

  await db.withTransactionAsync(async () => {
    // `is_dirty` and `updated_at` move together on every write here. A row
    // dirtied without its stamp moving would have the person's edit silently
    // overwritten by the push reply (`src/data/AGENTS.md`).
    await db.runAsync(
      `UPDATE target_overrides
       SET deleted_at = ?, updated_at = ?, is_dirty = 1
       WHERE user_id = ? AND effective_from = ? AND deleted_at IS NULL`,
      [at, at, input.userId, input.effectiveFrom],
    );

    await db.runAsync(
      `INSERT INTO target_overrides (
         id, user_id, effective_from, calories,
         created_at, updated_at, deleted_at, is_dirty, synced_at
       ) VALUES (?, ?, ?, ?, ?, ?, NULL, 1, NULL)`,
      [id, input.userId, input.effectiveFrom, input.calories, at, at],
    );
  });

  const written = await db.getFirstAsync<OverrideRow>(
    `SELECT ${OVERRIDE_COLUMNS} FROM target_overrides WHERE id = ?`,
    [id],
  );
  if (written === null) return failed('That daily target could not be saved.');

  return ok(toOverride(written));
};

/**
 * Clears whatever was set for a date, returning later days to the computed
 * number.
 *
 * Tombstones **every** live row for the date, not one, because more than one
 * can legally exist. Clearing one and leaving another would return a number
 * the person thought they had removed.
 */
export const clearOverride = async (
  db: SqlDatabase,
  input: { readonly userId: string; readonly effectiveFrom: string },
): Promise<DataResult<number>> => {
  const live = await listOverridesOn(db, input);
  if (live.length === 0) {
    return failed('There is no target of your own set for that day.');
  }

  const at = nowIso();
  await db.runAsync(
    `UPDATE target_overrides
     SET deleted_at = ?, updated_at = ?, is_dirty = 1
     WHERE user_id = ? AND effective_from = ? AND deleted_at IS NULL`,
    [at, at, input.userId, input.effectiveFrom],
  );

  return ok(live.length);
};
