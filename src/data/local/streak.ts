import { shiftDay } from '../calculations/local-day';
import { ok, type DataResult } from '../types';

import type { SqlDatabase } from './database';

/**
 * Consecutive days with at least one live meal, counted back from yesterday,
 * plus today when today already has one.
 *
 * Today is counted only when it has a meal, so an unlogged morning does not
 * read as a broken streak before the day is over. That definition is settled
 * in spec 0002; the streak's screen belongs to feature 9.
 */

/** A cap, so a long running account cannot turn this into an unbounded scan. */
const MAX_DAYS = 3650;

export const computeStreak = async (
  db: SqlDatabase,
  query: { readonly userId: string; readonly today: string },
): Promise<DataResult<number>> => {
  const days = await db.getAllAsync<{ eaten_on: string }>(
    `SELECT DISTINCT eaten_on FROM meals
     WHERE user_id = ? AND deleted_at IS NULL AND eaten_on <= ?
     ORDER BY eaten_on DESC
     LIMIT ?`,
    [query.userId, query.today, MAX_DAYS],
  );

  const logged = new Set(days.map((row) => row.eaten_on));
  const countsToday = logged.has(query.today);

  let streak = countsToday ? 1 : 0;
  let cursor = shiftDay(query.today, -1);

  while (logged.has(cursor) && streak < MAX_DAYS) {
    streak += 1;
    cursor = shiftDay(cursor, -1);
  }

  return ok(streak);
};
