import type { SqlDatabase } from './database';

/**
 * How much work has not reached the server yet.
 *
 * These live apart from `database-file.ts` on purpose. That module is one of
 * the two deliberate Expo edges in this folder, and anything importing it
 * cannot run without a phone. These two are plain queries over the narrow
 * `SqlDatabase` port, so they belong where the tests can drive them.
 *
 * There are two counts, and neither is redundant (spec 0004, value sourcing):
 * `countPendingMeals` is the number a person reads, `countPendingPushes` is
 * the number the code gates on before removing a database file.
 */

/** The tables that carry unpushed work. `profiles` included: it syncs too. */
export const SYNCED_TABLES: readonly string[] = [
  'profiles',
  'meal_scans',
  'meals',
  'meal_items',
  'daily_targets',
  'weight_entries',
];

/**
 * How many **meals** are still waiting to reach the server: the number shown
 * to a person signing out (spec 0004, AC-11).
 *
 * Deliberately not `countPendingPushes`. That one sums dirty rows across all
 * six tables, so one saved meal with four items and a scan reports `6`, which
 * is a true number and a useless sentence. A meal counts once if its own row
 * is dirty *or* any of its items is, because either way the meal has not
 * fully landed.
 */
export const countPendingMeals = async (db: SqlDatabase): Promise<number> => {
  const row = await db.getFirstAsync<{ pending: number }>(
    `SELECT COUNT(*) AS pending FROM meals m
      WHERE m.is_dirty = 1
         OR EXISTS (SELECT 1 FROM meal_items i WHERE i.meal_id = m.id AND i.is_dirty = 1)`,
    [],
  );
  return row?.pending ?? 0;
};

/**
 * How many rows are still waiting to reach the server, across every synced
 * table. This is the gate on removing a local database file: it may only go
 * when this returns zero (spec 0004, key invariants).
 */
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
